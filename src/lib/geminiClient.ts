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
import { getClientConfig } from './config';
import { BoundedLruCache, hashPayloadKey } from './lruCache';

const clientConfig = getClientConfig();
const analysisCache = new BoundedLruCache<GeminiAnalysisResponse>(
  clientConfig.lruCacheMaxEntries,
  clientConfig.lruCacheTtlMs
);
const briefCache = new BoundedLruCache<GeminiBriefResponse>(
  clientConfig.lruCacheMaxEntries,
  clientConfig.lruCacheTtlMs
);

/**
 * Executes an authenticated JSON POST request with an AbortController timeout wrapper.
 * Distinguishes network timeouts (AbortError), rate limits (429), auth errors (401), and server faults.
 *
 * @param url - Target API endpoint path
 * @param payload - Serializable request body
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Parsed JSON response object
 */
async function postWithTimeout(
  url: string,
  payload: unknown,
  timeoutMs = clientConfig.requestTimeoutMs
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientConfig.sessionToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timerId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${Math.round(timeoutMs / 1000)}s. Please retry.`
      );
    }
    throw new Error(
      'Network error while connecting to /api/gemini. Please check your internet connection or serverless API status.'
    );
  } finally {
    clearTimeout(timerId);
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Server returned status ${response.status} with a non-JSON response. Ensure the /api/gemini serverless route is active.`
    );
  }

  if (response.status === 429) {
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : 'Rate limit exceeded (HTTP 429). Please wait before retrying.'
    );
  }

  if (response.status === 401) {
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : 'Unauthorized request (HTTP 401): Invalid session token.'
    );
  }

  if (!response.ok || !body.ok) {
    const errMsg =
      typeof body.error === 'string'
        ? body.error
        : `Gemini request failed with HTTP status ${response.status}.`;
    throw new Error(errMsg);
  }

  return body;
}

/**
 * Sends deterministically cleaned air quality rows to Gemini for trend, hotspot, and role-action synthesis.
 * Uses BoundedLruCache to serve repeat identical queries in O(1) without redundant LLM token consumption.
 *
 * @param report - Deterministic QualityReport containing normalized rows and reliability scores
 * @returns Validated GeminiAnalysisResponse and cache hit indicator
 */
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

  const cacheKey = hashPayloadKey(JSON.stringify(payload));
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  const body = await postWithTimeout(clientConfig.apiEndpoint, payload);
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

/**
 * Generates an internal municipal briefing note and public citizen advisory in the target language and reading level.
 *
 * @param params - Report, verified analysis, target language, reading level, and optional previous brief
 * @returns Validated GeminiBriefResponse and cache hit indicator
 */
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

  const cacheKey = hashPayloadKey(JSON.stringify(payload));
  const cached = briefCache.get(cacheKey);
  if (cached) {
    return { data: cached, fromCache: true };
  }

  const body = await postWithTimeout(clientConfig.apiEndpoint, payload);
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
