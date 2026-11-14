import type {
  BriefComparisonDiff,
  GeminiAnalysisResponse,
  GeminiBriefResponse,
  QualityReport,
  ReadingLevel,
  SavedBriefRecord,
  SupportedLanguage,
} from '../types/airQuality';

const STORAGE_KEY = 'civic_aq_briefs_v1';

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
  return record;
}

export function clearSavedBriefs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

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
