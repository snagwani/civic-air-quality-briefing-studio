import {
  GeminiAnalysisResponseSchema,
  GeminiBriefResponseSchema,
  type GeminiAnalysisResponse,
  type GeminiBriefResponse,
  type QualityReport,
  type ReadingLevel,
  type SavedBriefRecord,
  type SupportedLanguage,
} from '../types/airQuality';

const analysisCache = new Map<string, GeminiAnalysisResponse>();
const briefCache = new Map<string, GeminiBriefResponse>();

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export async function runGeminiAnalysis(
  report: QualityReport
): Promise<{ data: GeminiAnalysisResponse; fromCache: boolean }> {
  const payload = {
    mode: 'analyze' as const,
    overallReliabilityScore: report.overallReliabilityScore,
    hasEnoughReliableData: report.hasEnoughReliableData,
    rows: report.rows.map((r) => ({
      rowId: r.rowId,
      rawStation: r.rawStation,
      ward: r.ward,
      normalizedTimestamp: r.normalizedTimestamp,
      pm25UgM3: r.pm25UgM3,
      pm10UgM3: r.pm10UgM3,
      no2UgM3: r.no2UgM3,
      so2UgM3: r.so2UgM3,
      aqi: r.aqi,
      aqiCategory: r.aqiCategory,
      dominantPollutant: r.dominantPollutant,
      isReliable: r.isReliable,
      issues: r.issues,
    })),
  };

  const cacheKey = hashString(JSON.stringify(payload));
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  let response: Response;
  try {
    response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      'Network error while connecting to /api/gemini. Please check your internet connection or serverless API status.'
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Server returned status ${response.status} with a non-JSON response. Ensure the /api/gemini serverless route is active.`
    );
  }

  if (!response.ok || !body.ok) {
    const errMsg =
      typeof body.error === 'string'
        ? body.error
        : `Gemini analysis failed with HTTP status ${response.status}.`;
    throw new Error(errMsg);
  }

  const parsed = GeminiAnalysisResponseSchema.safeParse(body.data);
  if (!parsed.success) {
    throw new Error(
      `Client-side Zod validation failed for Gemini response: ${parsed.error.issues
        .map((i) => i.message)
        .join(', ')}`
    );
  }

  analysisCache.set(cacheKey, parsed.data);
  return { data: parsed.data, fromCache: false };
}

export async function runGeminiBrief(params: {
  report: QualityReport;
  analysis: GeminiAnalysisResponse;
  language: SupportedLanguage;
  readingLevel: ReadingLevel;
  previousBrief: SavedBriefRecord | null;
}): Promise<{ data: GeminiBriefResponse; fromCache: boolean }> {
  const payload = {
    mode: 'brief' as const,
    language: params.language,
    readingLevel: params.readingLevel,
    overallReliabilityScore: params.report.overallReliabilityScore,
    hasEnoughReliableData: params.report.hasEnoughReliableData,
    rows: params.report.rows.map((r) => ({
      rowId: r.rowId,
      rawStation: r.rawStation,
      ward: r.ward,
      normalizedTimestamp: r.normalizedTimestamp,
      pm25UgM3: r.pm25UgM3,
      pm10UgM3: r.pm10UgM3,
      no2UgM3: r.no2UgM3,
      so2UgM3: r.so2UgM3,
      aqi: r.aqi,
      aqiCategory: r.aqiCategory,
      dominantPollutant: r.dominantPollutant,
      isReliable: r.isReliable,
      issues: r.issues,
    })),
    analysisSummary: {
      overallAssessment: params.analysis.overallAssessment,
      hotspots: params.analysis.hotspots.map((h) => ({
        location: h.location,
        severity: h.severity,
        likelyCause: h.likelyCause,
        citedRowIds: h.citedRowIds,
      })),
      actions: params.analysis.actions.map((a) => ({
        audience: a.audience,
        priority: a.priority,
        action: a.action,
        citedRowIds: a.citedRowIds,
      })),
    },
    previousBriefSummary: params.previousBrief
      ? {
          label: params.previousBrief.label,
          averageAqi: params.previousBrief.averageAqi,
          peakAqi: params.previousBrief.peakAqi,
          hotspotLocations: params.previousBrief.hotspotLocations,
        }
      : null,
  };

  const cacheKey = hashString(JSON.stringify(payload));
  const cached = briefCache.get(cacheKey);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  let response: Response;
  try {
    response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      'Network error while connecting to /api/gemini. Please check your internet connection or serverless API status.'
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Server returned status ${response.status} with a non-JSON response. Ensure the /api/gemini serverless route is active.`
    );
  }

  if (!response.ok || !body.ok) {
    const errMsg =
      typeof body.error === 'string'
        ? body.error
        : `Brief generation failed with HTTP status ${response.status}.`;
    throw new Error(errMsg);
  }

  const parsed = GeminiBriefResponseSchema.safeParse(body.data);
  if (!parsed.success) {
    throw new Error(
      `Client-side Zod validation failed for Brief response: ${parsed.error.issues
        .map((i) => i.message)
        .join(', ')}`
    );
  }

  briefCache.set(cacheKey, parsed.data);
  return { data: parsed.data, fromCache: false };
}
