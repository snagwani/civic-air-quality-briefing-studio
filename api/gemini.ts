import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getServerConfig } from './config.js';
import { enforceApiSecurity } from './security.js';
import {
  AnalyzePayloadSchema,
  GenerateBriefPayloadSchema,
  RequestPayloadSchema,
  GeminiAnalysisOutputSchema,
  GeminiBriefOutputSchema,
  buildAnalyzePrompt,
  buildBriefPrompt,
} from './prompts.js';

export {
  AnalyzePayloadSchema,
  GenerateBriefPayloadSchema,
  RequestPayloadSchema,
  GeminiAnalysisOutputSchema,
  GeminiBriefOutputSchema,
};

/**
 * Extracts and parses JSON from an LLM response string, stripping optional markdown fences.
 * @param text - Raw response text from Gemini
 * @returns Parsed JSON value
 */
function extractCleanJson(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fencedMatch ? fencedMatch[1].trim() : trimmed);
}

/**
 * Canonicalizes recognizable enum spellings and strips null optionals before strict Zod validation.
 * Never invents content: unrecognized or missing values are left as-is so validation fails,
 * the request is retried, and an honest error is surfaced instead of fabricated output.
 * @param raw - Parsed JSON object from Gemini
 * @param meta - Request mode and requested language/readingLevel (echoed, not guessed)
 * @returns Normalized JSON object ready for Zod schema parsing
 */
function normalizeRawGeminiJson(
  raw: unknown,
  meta: { mode: 'analyze' | 'brief'; language?: string; readingLevel?: string }
): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const pick = (value: unknown, rules: Array<[RegExp, string]>): unknown => {
    const s = String(value ?? '').toLowerCase();
    const hit = rules.find(([re]) => re.test(s));
    return hit ? hit[1] : value;
  };
  const normConf = (c: unknown) =>
    pick(c, [
      [/not enough|insufficient/, 'Not Enough Reliable Data'],
      [/^high/, 'High'],
      [/^medium|^moderate/, 'Medium'],
      [/^low/, 'Low'],
    ]);
  const normSeverity = (v: unknown) =>
    pick(v, [
      [/^crit|^severe/, 'Critical'],
      [/^high/, 'High'],
      [/^mod/, 'Moderate'],
      [/^low/, 'Low'],
      [/^uncertain/, 'Uncertain'],
    ]);
  const normAudience = (v: unknown) =>
    pick(v, [
      [/school|principal/, 'School Principal'],
      [/housing|rwa|society/, 'Housing Society'],
      [/ward|officer/, 'Ward Officer'],
    ]);
  const normPriority = (v: unknown) =>
    pick(v, [
      [/^imm|0-6|urgent/, 'Immediate (0-6 hrs)'],
      [/^short|24-48/, 'Short-Term (24-48 hrs)'],
      [/^prev/, 'Preventive'],
    ]);
  const optional = (v: unknown) => (v === null || v === '' ? undefined : v);

  if (meta.mode === 'analyze') {
    const mapList = (list: unknown, prefix: string, fn: (i: Record<string, unknown>) => Record<string, unknown>) =>
      Array.isArray(list)
        ? list.map((item: Record<string, unknown>, idx: number) => ({
            ...fn(item),
            id: String(item.id ?? `${prefix}${idx + 1}`),
          }))
        : list;
    obj.trends = mapList(obj.trends, 'T', (t) => ({
      ...t,
      confidence: normConf(t.confidence),
      dataCaveat: optional(t.dataCaveat),
    }));
    obj.hotspots = mapList(obj.hotspots, 'H', (h) => ({
      ...h,
      severity: normSeverity(h.severity),
      confidence: normConf(h.confidence),
    }));
    obj.actions = mapList(obj.actions, 'A', (a) => ({
      ...a,
      audience: normAudience(a.audience),
      priority: normPriority(a.priority),
      confidence: normConf(a.confidence),
    }));
  } else {
    obj.language = meta.language;
    obj.readingLevel = meta.readingLevel;
  }
  return obj;
}

/**
 * Keeps only citations that exist in the submitted dataset. Never fabricates a citation:
 * if a finding ends up with none, the response is rejected so the call retries honestly.
 * @param ids - Row IDs cited by Gemini
 * @param validRowSet - Row IDs present in the request payload
 * @param requireOne - Whether at least one valid citation is mandatory
 * @returns Valid cited row IDs
 */
function keepValidCitations(ids: string[], validRowSet: Set<string>, requireOne: boolean): string[] {
  const filtered = ids.filter((id) => validRowSet.has(id));
  if (requireOne && filtered.length === 0) {
    throw new Error('A finding cited no valid row IDs from the submitted dataset.');
  }
  return filtered;
}

/**
 * Detects transient upstream Gemini capacity errors (HTTP 503 / 429) that are safe to retry.
 * @param err - Error thrown by the Gemini SDK, or its message string
 * @returns True when the error is a temporary overload or quota spike
 */
function isTransientUpstreamError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err);
  return /"code":\s*(503|429)|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(text);
}

/**
 * Calls Gemini once, retrying briefly with backoff on transient 503/429 capacity spikes.
 * @param ai - Initialized GoogleGenAI client
 * @param model - Gemini model name
 * @param contents - Prompt text
 * @returns Raw response text from Gemini
 */
async function generateWithTransientRetry(
  ai: GoogleGenAI,
  model: string,
  contents: string
): Promise<string | undefined> {
  const maxTries = 3;
  for (let i = 1; ; i++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });
      return response.text;
    } catch (err: unknown) {
      if (i >= maxTries || !isTransientUpstreamError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1200 * i));
    }
  }
}

/**
 * Serverless API handler for authenticated, rate-limited, Zod-validated Gemini analysis and brief generation.
 * @param req - Incoming Vercel serverless request
 * @param res - Outgoing Vercel serverless response
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  const config = getServerConfig();
  if (!config) {
    return res.status(500).json({
      error: 'Server configuration error: GEMINI_API_KEY is missing in environment variables.',
    });
  }
  const passedSecurity = enforceApiSecurity(req, res, {
    expectedToken: config.apiAccessToken,
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMaxRequests,
  });
  if (!passedSecurity) return;

  const parsedPayload = RequestPayloadSchema.safeParse(req.body);
  if (!parsedPayload.success) {
    return res.status(400).json({
      error: 'Invalid request payload.',
      details: parsedPayload.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }

  const payload = parsedPayload.data;
  const validRowSet = new Set(payload.rows.map((r) => r.rowId));
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const prompt = payload.mode === 'analyze' ? buildAnalyzePrompt(payload) : buildBriefPrompt(payload);
  let lastError = 'Unknown validation error';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const retrySuffix =
        attempt === 2
          ? `\n\nIMPORTANT RETRY INSTRUCTION: Your previous response failed schema validation (${lastError}). Return strictly valid JSON matching the required schema.`
          : '';
      const modelName = config.candidateModels[(attempt - 1) % config.candidateModels.length];
      const responseText = await generateWithTransientRetry(ai, modelName, prompt + retrySuffix);
      if (!responseText) throw new Error('Gemini returned an empty response.');
      const jsonObj = normalizeRawGeminiJson(extractCleanJson(responseText), {
        mode: payload.mode,
        language: payload.mode === 'brief' ? payload.language : undefined,
        readingLevel: payload.mode === 'brief' ? payload.readingLevel : undefined,
      });
      if (payload.mode === 'analyze') {
        const validated = GeminiAnalysisOutputSchema.parse(jsonObj);
        return res.status(200).json({
          ok: true,
          attempt,
          data: {
            ...validated,
            trends: validated.trends.map((t) => ({ ...t, citedRowIds: keepValidCitations(t.citedRowIds, validRowSet, true) })),
            hotspots: validated.hotspots.map((h) => ({ ...h, citedRowIds: keepValidCitations(h.citedRowIds, validRowSet, true) })),
            actions: validated.actions.map((a) => ({ ...a, citedRowIds: keepValidCitations(a.citedRowIds, validRowSet, true) })),
          },
        });
      } else {
        const validated = GeminiBriefOutputSchema.parse(jsonObj);
        return res.status(200).json({
          ok: true,
          attempt,
          data: {
            ...validated,
            internalBriefingNote: {
              ...validated.internalBriefingNote,
              citedRowIds: keepValidCitations(validated.internalBriefingNote.citedRowIds, validRowSet, false),
            },
            citizenAdvisory: {
              ...validated.citizenAdvisory,
              citedRowIds: keepValidCitations(validated.citizenAdvisory.citedRowIds, validRowSet, false),
            },
          },
        });
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  if (isTransientUpstreamError(lastError)) {
    return res.status(503).json({
      error: 'Gemini is temporarily overloaded (high demand). Please click the button again in a few seconds.',
    });
  }
  return res.status(502).json({
    error: `Gemini output failed validation after retry: ${lastError}`,
  });
}
