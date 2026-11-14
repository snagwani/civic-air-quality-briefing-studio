import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getServerConfig } from './config';
import { enforceApiSecurity } from './security';
import {
  AnalyzePayloadSchema,
  GenerateBriefPayloadSchema,
  RequestPayloadSchema,
  GeminiAnalysisOutputSchema,
  GeminiBriefOutputSchema,
  buildAnalyzePrompt,
  buildBriefPrompt,
} from './prompts';

export {
  AnalyzePayloadSchema,
  GenerateBriefPayloadSchema,
  RequestPayloadSchema,
  GeminiAnalysisOutputSchema,
  GeminiBriefOutputSchema,
};

/**
 * Extracts and parses JSON from an LLM response string, stripping optional markdown fences.
 *
 * @param text - Raw response text from Gemini
 * @returns Parsed JSON value
 */
function extractCleanJson(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
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
      error:
        'Server configuration error: GEMINI_API_KEY is missing in environment variables.',
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
    payload.mode === 'analyze'
      ? buildAnalyzePrompt(payload)
      : buildBriefPrompt(payload);

  let lastError = 'Unknown validation error';

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const retrySuffix =
        attempt === 2
          ? `\n\nIMPORTANT RETRY INSTRUCTION: Your previous response failed schema validation (${lastError}). Return strictly valid JSON matching the required schema with no extra text.`
          : '';

      const modelName =
        config.candidateModels[(attempt - 1) % config.candidateModels.length];
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt + retrySuffix,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Gemini returned an empty response.');
      }

      const jsonObj = extractCleanJson(rawText);
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
            trends: validated.trends.map((t) => ({
              ...t,
              citedRowIds: sanitizeIds(t.citedRowIds),
            })),
            hotspots: validated.hotspots.map((h) => ({
              ...h,
              citedRowIds: sanitizeIds(h.citedRowIds),
            })),
            actions: validated.actions.map((a) => ({
              ...a,
              citedRowIds: sanitizeIds(a.citedRowIds),
            })),
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
