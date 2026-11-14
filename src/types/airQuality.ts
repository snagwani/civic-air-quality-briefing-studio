import { z } from 'zod';

export type AqiCategory =
  | 'Good'
  | 'Satisfactory'
  | 'Moderate'
  | 'Poor'
  | 'Very Poor'
  | 'Severe'
  | 'Insufficient Data';

export type RowIssueType =
  | 'MISSING_READING'
  | 'IMPOSSIBLE_VALUE'
  | 'SPIKE_DETECTED'
  | 'UNIT_CONVERTED'
  | 'UNIT_CONFLICT'
  | 'INVALID_DATE';

export interface RowIssue {
  type: RowIssueType;
  field: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface CleanedRow {
  rowId: string; // e.g. "R01"
  rawStation: string;
  ward: string;
  rawTimestamp: string;
  normalizedTimestamp: string | null;
  pm25UgM3: number | null;
  pm10UgM3: number | null;
  no2UgM3: number | null;
  so2UgM3: number | null;
  originalUnits: string;
  subIndexPm25: number | null;
  subIndexPm10: number | null;
  aqi: number | null;
  aqiCategory: AqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'None';
  isReliable: boolean;
  issues: RowIssue[];
}

export interface StationQualitySummary {
  ward: string;
  station: string;
  totalRows: number;
  reliableRows: number;
  missingCount: number;
  impossibleCount: number;
  spikeCount: number;
  unitConversions: number;
  unitConflicts: number;
  reliabilityScore: number; // 0 to 100
  averageAqi: number | null;
  peakAqi: number | null;
  dominantCategory: AqiCategory;
}

export interface QualityReport {
  totalRows: number;
  reliableRows: number;
  flaggedRows: number;
  overallReliabilityScore: number; // 0 to 100
  missingReadingsCount: number;
  impossibleValuesCount: number;
  spikesDetectedCount: number;
  unitConversionsCount: number;
  unitConflictsCount: number;
  invalidDatesCount: number;
  hasEnoughReliableData: boolean;
  stationSummaries: StationQualitySummary[];
  rows: CleanedRow[];
}

// Zod Schemas for Feature 2: Gemini Structured Analysis
export const ConfidenceLevelSchema = z.enum([
  'High',
  'Medium',
  'Low',
  'Not Enough Reliable Data',
]);

export const TrendFindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  citedRowIds: z.array(z.string()).min(1),
  confidence: ConfidenceLevelSchema,
  dataCaveat: z.string().optional(),
});

export const HotspotFindingSchema = z.object({
  id: z.string(),
  location: z.string(),
  severity: z.enum(['Critical', 'High', 'Moderate', 'Low', 'Uncertain']),
  likelyCause: z.string(),
  explanation: z.string(),
  citedRowIds: z.array(z.string()).min(1),
  confidence: ConfidenceLevelSchema,
});

export const AudienceActionSchema = z.object({
  id: z.string(),
  audience: z.enum(['Ward Officer', 'Housing Society', 'School Principal']),
  priority: z.enum(['Immediate (0-6 hrs)', 'Short-Term (24-48 hrs)', 'Preventive']),
  action: z.string(),
  rationale: z.string(),
  citedRowIds: z.array(z.string()).min(1),
  confidence: ConfidenceLevelSchema,
});

export const GeminiAnalysisResponseSchema = z.object({
  overallAssessment: z.string(),
  insufficientDataNotice: z.string().nullable(),
  trends: z.array(TrendFindingSchema),
  hotspots: z.array(HotspotFindingSchema),
  actions: z.array(AudienceActionSchema),
});

export type GeminiAnalysisResponse = z.infer<typeof GeminiAnalysisResponseSchema>;

// Zod Schemas for Feature 3: Multilingual Briefs & Citizen Advisory
export type SupportedLanguage = 'English' | 'Hindi' | 'Marathi';
export type ReadingLevel = 'Simple' | 'Detailed';

export const VulnerableGroupCareSchema = z.object({
  children: z.string(),
  olderAdults: z.string(),
  sensitiveIndividuals: z.string(),
});

export const SingleLanguageBriefSchema = z.object({
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
    vulnerableGroups: VulnerableGroupCareSchema,
    citedRowIds: z.array(z.string()),
  }),
});

export const GeminiBriefResponseSchema = z.object({
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
    vulnerableGroups: VulnerableGroupCareSchema,
    citedRowIds: z.array(z.string()),
  }),
});

export type GeminiBriefResponse = z.infer<typeof GeminiBriefResponseSchema>;

export interface SavedBriefRecord {
  id: string;
  createdAt: string;
  label: string;
  language: SupportedLanguage;
  readingLevel: ReadingLevel;
  overallReliabilityScore: number;
  averageAqi: number | null;
  peakAqi: number | null;
  reliableRowsCount: number;
  totalRowsCount: number;
  wardBreakdown: Record<string, { avgAqi: number | null; category: AqiCategory; reliability: number }>;
  hotspotLocations: string[];
  analysis: GeminiAnalysisResponse;
  brief: GeminiBriefResponse;
}

export interface BriefComparisonDiff {
  previousId: string;
  previousCreatedAt: string;
  previousLabel: string;
  currentId: string;
  currentCreatedAt: string;
  currentLabel: string;
  avgAqiDelta: number | null;
  peakAqiDelta: number | null;
  reliabilityDelta: number;
  newHotspots: string[];
  resolvedHotspots: string[];
  wardChanges: Array<{
    ward: string;
    previousAqi: number | null;
    currentAqi: number | null;
    delta: number | null;
    previousCategory: AqiCategory;
    currentCategory: AqiCategory;
  }>;
  actionCountDelta: number;
}
