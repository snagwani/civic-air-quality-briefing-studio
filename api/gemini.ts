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
 * Normalizes minor LLM enum casing or synonym variations before strict Zod validation.
 * @param raw - Parsed JSON object from Gemini
 * @param fallbackRowId - Valid fallback row ID if citedRowIds is empty
 * @returns Normalized JSON object ready for Zod schema parsing
 */
function normalizeRawGeminiJson(raw: unknown, fallbackRowId: string): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const normConf = (c: unknown): string => {
    const s = String(c ?? '').toLowerCase();
    if (s.includes('not enough') || s.includes('insufficient')) return 'Not Enough Reliable Data';
    if (s.includes('high')) return 'High';
    return s.includes('low') ? 'Low' : 'Medium';
  };
  const normSeverity = (sev: unknown): string => {
    const s = String(sev ?? '').toLowerCase();
    if (s.includes('crit') || s.includes('severe') || s.includes('very poor')) return 'Critical';
    if (s.includes('high') || s.includes('poor')) return 'High';
    if (s.includes('mod')) return 'Moderate';
    return s.includes('low') || s.includes('good') ? 'Low' : 'Uncertain';
  };
  const normAudience = (aud: unknown): string => {
    const s = String(aud ?? '').toLowerCase();
    if (s.includes('school') || s.includes('principal')) return 'School Principal';
    return s.includes('housing') || s.includes('rwa') || s.includes('society') ? 'Housing Society' : 'Ward Officer';
  };
  const normPriority = (p: unknown): string => {
    const s = String(p ?? '').toLowerCase();
    if (s.includes('imm') || s.includes('0-6') || s.includes('urgent')) return 'Immediate (0-6 hrs)';
    return s.includes('prev') || s.includes('long') ? 'Preventive' : 'Short-Term (24-48 hrs)';
  };
  const normIds = (ids: unknown): string[] =>
    Array.isArray(ids) && ids.length > 0 ? ids.map(String) : [fallbackRowId];

  if (Array.isArray(obj.trends)) {
    obj.trends = obj.trends.map((t: Record<string, unknown>, idx: number) => ({
      ...t, id: String(t.id ?? `T${idx + 1}`), confidence: normConf(t.confidence),
      citedRowIds: normIds(t.citedRowIds), dataCaveat: t.dataCaveat ?? undefined,
    }));
  }
  if (Array.isArray(obj.hotspots)) {
    obj.hotspots = obj.hotspots.map((h: Record<string, unknown>, idx: number) => ({
      ...h, id: String(h.id ?? `H${idx + 1}`), severity: normSeverity(h.severity),
      confidence: normConf(h.confidence), citedRowIds: normIds(h.citedRowIds),
    }));
  }
  if (Array.isArray(obj.actions)) {
    obj.actions = obj.actions.map((a: Record<string, unknown>, idx: number) => ({
      ...a, id: String(a.id ?? `A${idx + 1}`), audience: normAudience(a.audience),
      priority: normPriority(a.priority), confidence: normConf(a.confidence), citedRowIds: normIds(a.citedRowIds),
    }));
  }
  return obj;
}

/**
 * Serverless API handler for authenticated, rate-limited, Zod-validated Gemini analysis and brief generation.
 *
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
  const fallbackRowId = payload.rows[0].rowId;
  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const prompt =
    payload.mode === 'analyze' ? buildAnalyzePrompt(payload) : buildBriefPrompt(payload);

  let lastError = 'Unknown validation error';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const retrySuffix =
        attempt === 2
          ? `\n\nIMPORTANT RETRY INSTRUCTION: Your previous response failed schema validation (${lastError}). Return strictly valid JSON matching the required schema.`
          : '';

      const modelName = config.candidateModels[(attempt - 1) % config.candidateModels.length];
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt + retrySuffix,
        config: { responseMimeType: 'application/json', temperature: 0.2 },
      });

      if (!response.text) throw new Error('Gemini returned an empty response.');
      const jsonObj = normalizeRawGeminiJson(extractCleanJson(response.text), fallbackRowId);
      const sanitizeIds = (ids: string[]) => {
        const filtered = ids.filter((id) => validRowSet.has(id));
        return filtered.length > 0 ? filtered : [fallbackRowId];
      };

      if (payload.mode === 'analyze') {
        const validated = GeminiAnalysisOutputSchema.parse(jsonObj);
        return res.status(200).json({
          ok: true,
          attempt,
          data: {
            ...validated,
            trends: validated.trends.map((t) => ({ ...t, citedRowIds: sanitizeIds(t.citedRowIds) })),
            hotspots: validated.hotspots.map((h) => ({ ...h, citedRowIds: sanitizeIds(h.citedRowIds) })),
            actions: validated.actions.map((a) => ({ ...a, citedRowIds: sanitizeIds(a.citedRowIds) })),
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
              citedRowIds: sanitizeIds(validated.internalBriefingNote.citedRowIds),
            },
            citizenAdvisory: {
              ...validated.citizenAdvisory,
              citedRowIds: sanitizeIds(validated.citizenAdvisory.citedRowIds),
            },
          },
        });
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return res.status(502).json({
    error: `Gemini output failed validation after retry: ${lastError}`,
  });
}
