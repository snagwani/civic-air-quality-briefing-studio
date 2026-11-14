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

/**
 * Builds the structured analysis prompt instructing Gemini to cite exact row IDs
 * and state "Not enough reliable data" when reliability is insufficient.
 *
 * @param payload - Validated analyze request payload
 * @returns Prompt string for Gemini
 */
export function buildAnalyzePrompt(payload: z.infer<typeof AnalyzePayloadSchema>): string {
  const validRowIds = payload.rows.map((r) => r.rowId).join(', ');
  return `You are the AI Civic Air Quality Analyst for an Indian municipal ward & housing society intelligence system using Central Pollution Control Board (CPCB) standards.

STRICT TRUST LAYER RULES:
1. You must ONLY cite rowIds from this exact list: [${validRowIds}]. Never invent row IDs or external measurements.
2. Every trend, hotspot, and action MUST cite the specific rowIds that justify it.
3. If "hasEnoughReliableData" is false (${payload.hasEnoughReliableData}) or a station has mostly missing/impossible readings, explicitly set confidence to "Not Enough Reliable Data" and state "Not enough reliable data" in insufficientDataNotice and in the finding summary instead of guessing.
4. Provide prioritized, concrete local actions tailored separately for ALL THREE audiences:
   - "Ward Officer" (water sprinkling on dust corridors, inspecting C&D waste sites, halting open garbage burning)
   - "Housing Society" (wet-mopping, restricting diesel generator testing during peak smog, RWA alerts for seniors)
   - "School Principal" (moving morning assembly/PT indoors, closing road-facing windows, asthma inhaler readiness)

CLEANED DATASET (Normalized to µg/m³ with CPCB AQI & Data Quality Flags):
Overall Reliability Score: ${payload.overallReliabilityScore}/100
Has Enough Reliable Data: ${payload.hasEnoughReliableData}
Rows:
${JSON.stringify(payload.rows, null, 2)}

Return ONLY valid JSON matching the required schema.`;
}

/**
 * Builds the multilingual internal briefing note and citizen advisory prompt.
 *
 * @param payload - Validated brief request payload
 * @returns Prompt string for Gemini
 */
export function buildBriefPrompt(payload: z.infer<typeof GenerateBriefPayloadSchema>): string {
  const validRowIds = payload.rows.map((r) => r.rowId).join(', ');
  const langInstruction =
    payload.language === 'Hindi'
      ? 'Write all text fields in natural Hindi (Devanagari script) suited for Indian municipal communication. Keep row IDs like R01 in Latin script.'
      : payload.language === 'Marathi'
      ? 'Write all text fields in natural Marathi (Devanagari script) suited for Maharashtra municipal wards. Keep row IDs like R01 in Latin script.'
      : 'Write all text fields in clear Indian civic English.';

  const levelInstruction =
    payload.readingLevel === 'Simple'
      ? 'Use a Simple reading level: short sentences, zero jargon, everyday words.'
      : 'Use a Detailed reading level: include specific CPCB AQI numbers, pollutant concentrations (µg/m³), and municipal SOP details.';

  const comparisonContext = payload.previousBriefSummary
    ? `PREVIOUS BRIEF FOR COMPARISON: Label: ${payload.previousBriefSummary.label}, Prev Avg AQI: ${payload.previousBriefSummary.averageAqi ?? 'N/A'}, Prev Peak AQI: ${payload.previousBriefSummary.peakAqi ?? 'N/A'}. Mention what changed in executiveSummary.`
    : 'This is the baseline brief for the current monitoring window.';

  return `You are generating an official Municipal Internal Briefing Note and a Public Citizen Advisory for an Indian city ward.
LANGUAGE: ${langInstruction}
READING LEVEL: ${levelInstruction}
Cite only valid rowIds from [${validRowIds}]. Provide dedicated care guidance for children, olderAdults, and sensitiveIndividuals.
${comparisonContext}
CURRENT VERIFIED ANALYSIS: ${JSON.stringify(payload.analysisSummary)}
CLEANED ROWS: ${JSON.stringify(payload.rows)}
Return ONLY valid JSON matching the required schema.`;
}
