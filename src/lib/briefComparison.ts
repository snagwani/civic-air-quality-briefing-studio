import type {
  BriefComparisonDiff,
  GeminiAnalysisResponse,
  GeminiBriefResponse,
  QualityReport,
  ReadingLevel,
  SavedBriefRecord,
  SupportedLanguage,
} from '../types/airQuality';
import { getClientConfig } from './config';

const STORAGE_KEY = 'civic_aq_briefs_v1';
const clientConfig = getClientConfig();

/**
 * Loads saved air quality briefs synchronously from browser localStorage cache.
 *
 * @returns Array of SavedBriefRecord sorted newest-first
 */
export function loadSavedBriefs(): SavedBriefRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Asynchronously fetches persisted brief records from the backend `/api/records` endpoint
 * and merges them with localStorage to ensure cross-device continuity.
 *
 * @returns Merged list of SavedBriefRecord sorted newest-first
 */
export async function syncBriefsFromServer(): Promise<SavedBriefRecord[]> {
  const local = loadSavedBriefs();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(clientConfig.recordsEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${clientConfig.sessionToken}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return local;
    const data = (await response.json()) as { ok?: boolean; records?: SavedBriefRecord[] };
    if (!data.ok || !Array.isArray(data.records)) return local;

    const mergedMap = new Map<string, SavedBriefRecord>();
    for (const item of [...data.records, ...local]) {
      if (item && typeof item.id === 'string' && !mergedMap.has(item.id)) {
        mergedMap.set(item.id, item);
      }
    }
    const merged = Array.from(mergedMap.values())
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 15);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return local;
  }
}

/**
 * Persists a newly generated brief record to both localStorage and the serverless `/api/records` backend.
 *
 * @param params - Brief metadata, quality report, Gemini analysis, and generated multilingual brief
 * @returns Newly created SavedBriefRecord
 */
export function saveBriefRecord(params: {
  label: string;
  language: SupportedLanguage;
  readingLevel: ReadingLevel;
  report: QualityReport;
  analysis: GeminiAnalysisResponse;
  brief: GeminiBriefResponse;
}): SavedBriefRecord {
  const existing = loadSavedBriefs();

  const reliableAqis = params.report.rows
    .filter((r) => r.isReliable && r.aqi !== null)
    .map((r) => r.aqi as number);

  const averageAqi =
    reliableAqis.length > 0
      ? Math.round(reliableAqis.reduce((acc, v) => acc + v, 0) / reliableAqis.length)
      : null;
  const peakAqi = reliableAqis.length > 0 ? Math.max(...reliableAqis) : null;

  const wardBreakdown: SavedBriefRecord['wardBreakdown'] = {};
  for (const st of params.report.stationSummaries) {
    wardBreakdown[st.ward] = {
      avgAqi: st.averageAqi,
      category: st.dominantCategory,
      reliability: st.reliabilityScore,
    };
  }

  const record: SavedBriefRecord = {
    id: `BRIEF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    label: params.label,
    language: params.language,
    readingLevel: params.readingLevel,
    overallReliabilityScore: params.report.overallReliabilityScore,
    averageAqi,
    peakAqi,
    reliableRowsCount: params.report.reliableRows,
    totalRowsCount: params.report.totalRows,
    wardBreakdown,
    hotspotLocations: params.analysis.hotspots.map((h) => h.location),
    analysis: params.analysis,
    brief: params.brief,
  };

  const updated = [record, ...existing].slice(0, 15);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }

  // Non-blocking background sync to persistent serverless backend (/api/records)
  void fetch(clientConfig.recordsEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${clientConfig.sessionToken}`,
    },
    body: JSON.stringify(record),
  }).catch(() => undefined);

  return record;
}

/**
 * Clears saved brief history from both localStorage and the serverless `/api/records` backend.
 */
export function clearSavedBriefs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
  void fetch(clientConfig.recordsEndpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${clientConfig.sessionToken}`,
    },
  }).catch(() => undefined);
}

/**
 * Computes deterministic longitudinal differences between the current brief and the previous baseline brief.
 *
 * @param current - Newly generated SavedBriefRecord
 * @param previous - Previous baseline SavedBriefRecord
 * @returns Structured BriefComparisonDiff with AQI deltas, ward shifts, and new/resolved hotspots
 */
export function computeBriefDiff(
  current: SavedBriefRecord,
  previous: SavedBriefRecord
): BriefComparisonDiff {
  const avgAqiDelta =
    current.averageAqi !== null && previous.averageAqi !== null
      ? current.averageAqi - previous.averageAqi
      : null;

  const peakAqiDelta =
    current.peakAqi !== null && previous.peakAqi !== null
      ? current.peakAqi - previous.peakAqi
      : null;

  const reliabilityDelta =
    current.overallReliabilityScore - previous.overallReliabilityScore;

  const prevHotspotsLower = new Set(previous.hotspotLocations.map((h) => h.toLowerCase()));
  const currHotspotsLower = new Set(current.hotspotLocations.map((h) => h.toLowerCase()));

  const newHotspots = current.hotspotLocations.filter(
    (h) => !prevHotspotsLower.has(h.toLowerCase())
  );
  const resolvedHotspots = previous.hotspotLocations.filter(
    (h) => !currHotspotsLower.has(h.toLowerCase())
  );

  const allWards = new Set([
    ...Object.keys(previous.wardBreakdown),
    ...Object.keys(current.wardBreakdown),
  ]);

  const wardChanges: BriefComparisonDiff['wardChanges'] = [];
  for (const ward of allWards) {
    const prevW = previous.wardBreakdown[ward];
    const currW = current.wardBreakdown[ward];
    const prevAqi = prevW?.avgAqi ?? null;
    const currAqi = currW?.avgAqi ?? null;
    wardChanges.push({
      ward,
      previousAqi: prevAqi,
      currentAqi: currAqi,
      delta: prevAqi !== null && currAqi !== null ? currAqi - prevAqi : null,
      previousCategory: prevW?.category ?? 'Insufficient Data',
      currentCategory: currW?.category ?? 'Insufficient Data',
    });
  }

  return {
    previousId: previous.id,
    previousCreatedAt: previous.createdAt,
    previousLabel: previous.label,
    currentId: current.id,
    currentCreatedAt: current.createdAt,
    currentLabel: current.label,
    avgAqiDelta,
    peakAqiDelta,
    reliabilityDelta,
    newHotspots,
    resolvedHotspots,
    wardChanges,
    actionCountDelta: current.analysis.actions.length - previous.analysis.actions.length,
  };
}
