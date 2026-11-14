import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const CleanedRowInputSchema = z.object({
  rowId: z.string(),
  rawStation: z.string(),
  ward: z.string(),
  normalizedTimestamp: z.string().nullable(),
  pm25UgM3: z.number().nullable(),
  pm10UgM3: z.number().nullable(),
  no2UgM3: z.number().nullable(),
  so2UgM3: z.number().nullable(),
  aqi: z.number().nullable(),
  aqiCategory: z.string(),
  dominantPollutant: z.string(),
  isReliable: z.boolean(),
  issues: z.array(
    z.object({
      type: z.string(),
      field: z.string(),
      message: z.string(),
      severity: z.string(),
    })
  ),
});

export const AnalyzePayloadSchema = z.object({
  mode: z.literal('analyze'),
  overallReliabilityScore: z.number(),
  hasEnoughReliableData: z.boolean(),
  rows: z.array(CleanedRowInputSchema).min(1).max(500),
});

export const GenerateBriefPayloadSchema = z.object({
  mode: z.literal('brief'),
  language: z.enum(['English', 'Hindi', 'Marathi']),
  readingLevel: z.enum(['Simple', 'Detailed']),
  overallReliabilityScore: z.number(),
  hasEnoughReliableData: z.boolean(),
  rows: z.array(CleanedRowInputSchema).min(1).max(500),
  analysisSummary: z.object({
    overallAssessment: z.string(),
    hotspots: z.array(
      z.object({
        location: z.string(),
        severity: z.string(),
        likelyCause: z.string(),
        citedRowIds: z.array(z.string()),
      })
    ),
    actions: z.array(
      z.object({
        audience: z.string(),
        priority: z.string(),
        action: z.string(),
        citedRowIds: z.array(z.string()),
      })
    ),
  }),
  previousBriefSummary: z
    .object({
      label: z.string(),
      averageAqi: z.number().nullable(),
      peakAqi: z.number().nullable(),
      hotspotLocations: z.array(z.string()),
    })
    .nullable()
    .optional(),
});

export const RequestPayloadSchema = z.discriminatedUnion('mode', [
  AnalyzePayloadSchema,
  GenerateBriefPayloadSchema,
]);

const ConfidenceLevelSchema = z.enum([
  'High',
  'Medium',
  'Low',
  'Not Enough Reliable Data',
]);

export const GeminiAnalysisOutputSchema = z.object({
  overallAssessment: z.string(),
  insufficientDataNotice: z.string().nullable(),
  trends: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      citedRowIds: z.array(z.string()).min(1),
      confidence: ConfidenceLevelSchema,
      dataCaveat: z.string().optional(),
    })
  ),
  hotspots: z.array(
    z.object({
      id: z.string(),
      location: z.string(),
      severity: z.enum(['Critical', 'High', 'Moderate', 'Low', 'Uncertain']),
      likelyCause: z.string(),
      explanation: z.string(),
      citedRowIds: z.array(z.string()).min(1),
      confidence: ConfidenceLevelSchema,
    })
  ),
  actions: z.array(
    z.object({
      id: z.string(),
      audience: z.enum(['Ward Officer', 'Housing Society', 'School Principal']),
      priority: z.enum(['Immediate (0-6 hrs)', 'Short-Term (24-48 hrs)', 'Preventive']),
      action: z.string(),
      rationale: z.string(),
      citedRowIds: z.array(z.string()).min(1),
      confidence: ConfidenceLevelSchema,
    })
  ),
});

export const GeminiBriefOutputSchema = z.object({
  language: z.enum(['English', 'Hindi', 'Marathi']),
  readingLevel: z.enum(['Simple', 'Detailed']),
  internalBriefingNote: z.object({
    subject: z.string(),
    executiveSummary: z.string(),
    operationalDirectives: z.array(z.string()).min(1),
    dataReliabilityNote: z.string(),
    citedRowIds: z.array(z.string()),
  }),
  citizenAdvisory: z.object({
    headline: z.string(),
    publicMessage: z.string(),
    dosAndDonts: z.array(z.string()).min(2),
    vulnerableGroups: z.object({
      children: z.string(),
      olderAdults: z.string(),
      sensitiveIndividuals: z.string(),
    }),
    citedRowIds: z.array(z.string()),
  }),
});

function extractCleanJson(text: string): unknown {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  return JSON.parse(candidate);
}

function buildAnalyzePrompt(payload: z.infer<typeof AnalyzePayloadSchema>): string {
  const validRowIds = payload.rows.map((r) => r.rowId).join(', ');
  return `You are the AI Civic Air Quality Analyst for an Indian municipal ward & housing society intelligence system using Central Pollution Control Board (CPCB) standards.

STRICT TRUST LAYER RULES:
1. You must ONLY cite rowIds from this exact list: [${validRowIds}]. Never invent row IDs or external measurements.
2. Every trend, hotspot, and action MUST cite the specific rowIds that justify it.
3. If "hasEnoughReliableData" is false (${payload.hasEnoughReliableData}) or a station has mostly missing/impossible readings, explicitly set confidence to "Not Enough Reliable Data" and state "Not enough reliable data" in insufficientDataNotice and in the finding summary instead of guessing.
4. Provide prioritized, concrete local actions tailored separately for ALL THREE audiences:
   - "Ward Officer" (e.g. water sprinkling on dust corridors, inspecting C&D waste sites, halting open garbage burning, traffic marshals at bottlenecks)
   - "Housing Society" (e.g. rescheduling society sweeping to wet-mopping, restricting diesel generator testing during peak smog hours, RWA WhatsApp alerts for senior citizens)
   - "School Principal" (e.g. moving morning assembly and PT indoors, closing road-facing classroom windows during peak traffic, monitoring students with asthma/inhalers)

CLEANED DATASET (Normalized to µg/m³ with CPCB AQI & Data Quality Flags):
Overall Reliability Score: ${payload.overallReliabilityScore}/100
Has Enough Reliable Data: ${payload.hasEnoughReliableData}
Rows:
${JSON.stringify(payload.rows, null, 2)}

Return ONLY valid JSON matching this exact structure (no markdown fences):
{
  "overallAssessment": "Plain-language summary of ward air quality and data trustworthiness",
  "insufficientDataNotice": null or "Honest statement if reliable data is insufficient in one or more wards",
  "trends": [
    {
      "id": "T1",
      "title": "Short trend title",
      "summary": "Plain language explanation referencing exact readings and timestamps",
      "citedRowIds": ["R01", "R02"],
      "confidence": "High" | "Medium" | "Low" | "Not Enough Reliable Data",
      "dataCaveat": "Optional note about flagged spikes, unit conversions, or missing readings"
    }
  ],
  "hotspots": [
    {
      "id": "H1",
      "location": "Ward / Station name",
      "severity": "Critical" | "High" | "Moderate" | "Low" | "Uncertain",
      "likelyCause": "e.g., Construction dust (high PM10) or vehicular/biomass smoke (high PM2.5/NO2)",
      "explanation": "Why this is flagged and what the readings show",
      "citedRowIds": ["R01"],
      "confidence": "High" | "Medium" | "Low" | "Not Enough Reliable Data"
    }
  ],
  "actions": [
    {
      "id": "A1",
      "audience": "Ward Officer" | "Housing Society" | "School Principal",
      "priority": "Immediate (0-6 hrs)" | "Short-Term (24-48 hrs)" | "Preventive",
      "action": "Specific actionable intervention",
      "rationale": "Why this action fits these specific readings",
      "citedRowIds": ["R01"],
      "confidence": "High" | "Medium" | "Low" | "Not Enough Reliable Data"
    }
  ]
}`;
}

function buildBriefPrompt(payload: z.infer<typeof GenerateBriefPayloadSchema>): string {
  const validRowIds = payload.rows.map((r) => r.rowId).join(', ');
  const langInstruction =
    payload.language === 'Hindi'
      ? 'Write all text fields in natural, clear Hindi (Devanagari script) suited for Indian municipal communication and citizens. Keep row IDs like R01 in Latin script.'
      : payload.language === 'Marathi'
      ? 'Write all text fields in natural, clear Marathi (Devanagari script) suited for Maharashtra municipal wards and housing societies. Keep row IDs like R01 in Latin script.'
      : 'Write all text fields in clear Indian civic English.';

  const levelInstruction =
    payload.readingLevel === 'Simple'
      ? 'Use a Simple reading level: short sentences, zero technical jargon, everyday words that families, security guards, and school staff can immediately understand.'
      : 'Use a Detailed reading level: include specific CPCB AQI numbers, pollutant concentrations (µg/m³), time windows, and structured municipal SOP details.';

  const comparisonContext = payload.previousBriefSummary
    ? `PREVIOUS BRIEF FOR COMPARISON:
Label: ${payload.previousBriefSummary.label}
Previous Average AQI: ${payload.previousBriefSummary.averageAqi ?? 'N/A'}
Previous Peak AQI: ${payload.previousBriefSummary.peakAqi ?? 'N/A'}
Previous Hotspots: ${payload.previousBriefSummary.hotspotLocations.join(', ') || 'None'}
Mention what changed compared to the previous brief in the executiveSummary.`
    : 'This is the baseline brief for the current monitoring window.';

  return `You are generating an official Municipal Internal Briefing Note and a Public Citizen Advisory for an Indian city ward.

LANGUAGE REQUIREMENT: ${langInstruction}
READING LEVEL REQUIREMENT: ${levelInstruction}

STRICT RULES:
1. Cite only valid rowIds from [${validRowIds}].
2. If reliability is low (${payload.overallReliabilityScore}/100) or hasEnoughReliableData is ${payload.hasEnoughReliableData}, explicitly state where sensor readings are missing or unreliable so officials and citizens are not misled.
3. Provide dedicated, empathetic, practical guidance for:
   - children (school play, morning assembly, hydration, breathing signs)
   - olderAdults (morning walks, cardiac/respiratory precautions)
   - sensitiveIndividuals (asthma, COPD, pregnant women, outdoor workers, inhaler readiness)

${comparisonContext}

CURRENT VERIFIED ANALYSIS:
${JSON.stringify(payload.analysisSummary, null, 2)}

CLEANED ROWS:
${JSON.stringify(payload.rows, null, 2)}

Return ONLY valid JSON matching this exact structure (no markdown fences):
{
  "language": "${payload.language}",
  "readingLevel": "${payload.readingLevel}",
  "internalBriefingNote": {
    "subject": "Official Ward Briefing Subject Line",
    "executiveSummary": "Summary of situation, hotspot status, and comparison with previous brief if available",
    "operationalDirectives": [
      "Directive 1 for ward enforcement / sanitation / traffic",
      "Directive 2 for housing societies and schools"
    ],
    "dataReliabilityNote": "Honest assessment of sensor reliability, unit conversions, and any data gaps",
    "citedRowIds": ["R01", "R02"]
  },
  "citizenAdvisory": {
    "headline": "Public Advisory Headline",
    "publicMessage": "Clear explanation of current air quality and when to avoid outdoor exposure",
    "dosAndDonts": [
      "Do: ...",
      "Don't: ..."
    ],
    "vulnerableGroups": {
      "children": "Specific care for children and school activities",
      "olderAdults": "Specific care for senior citizens",
      "sensitiveIndividuals": "Specific care for asthma, COPD, heart patients, and outdoor workers"
    },
    "citedRowIds": ["R01", "R02"]
  }
}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        'Server configuration error: GEMINI_API_KEY is missing in environment variables.',
    });
  }

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

  const ai = new GoogleGenAI({ apiKey });
  const prompt =
    payload.mode === 'analyze'
      ? buildAnalyzePrompt(payload)
      : buildBriefPrompt(payload);

  let lastError = 'Unknown validation error';

  // Try up to 2 times with automatic model fallback (gemini-3.5-flash -> gemini-3.6-flash -> gemini-3.8-flash)
  const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash'];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const retrySuffix =
        attempt === 2
          ? `\n\nIMPORTANT RETRY INSTRUCTION: Your previous response failed schema validation (${lastError}). Return strictly valid JSON matching the required schema with no extra text.`
          : '';

      const modelName = CANDIDATE_MODELS[(attempt - 1) % CANDIDATE_MODELS.length];
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

      if (payload.mode === 'analyze') {
        const validated = GeminiAnalysisOutputSchema.parse(jsonObj);
        // Sanitize citedRowIds so only real rowIds from the input are kept
        const sanitizeIds = (ids: string[]) => {
          const filtered = ids.filter((id) => validRowSet.has(id));
          return filtered.length > 0 ? filtered : [fallbackRowId];
        };

        const cleanedResult = {
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
        };

        return res.status(200).json({
          ok: true,
          attempt,
          data: cleanedResult,
        });
      } else {
        const validated = GeminiBriefOutputSchema.parse(jsonObj);
        const sanitizeIds = (ids: string[]) => {
          const filtered = ids.filter((id) => validRowSet.has(id));
          return filtered.length > 0 ? filtered : [fallbackRowId];
        };

        const cleanedBrief = {
          ...validated,
          internalBriefingNote: {
            ...validated.internalBriefingNote,
            citedRowIds: sanitizeIds(validated.internalBriefingNote.citedRowIds),
          },
          citizenAdvisory: {
            ...validated.citizenAdvisory,
            citedRowIds: sanitizeIds(validated.citizenAdvisory.citedRowIds),
          },
        };

        return res.status(200).json({
          ok: true,
          attempt,
          data: cleanedBrief,
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
