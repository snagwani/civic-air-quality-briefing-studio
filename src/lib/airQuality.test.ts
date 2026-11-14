import { describe, expect, it } from 'vitest';
import {
  calculatePm25SubIndex,
  calculatePm10SubIndex,
  computeOverallRowAqi,
  getCpcbAqiCategory,
} from './cpcbAqi';
import {
  normalizeDateString,
  parseAndCleanAirQualityData,
  parseAndNormalizePollutant,
} from './dataCleaner';
import {
  AnalyzePayloadSchema,
  GeminiAnalysisOutputSchema,
  GeminiBriefOutputSchema,
  RequestPayloadSchema,
} from '../../api/gemini';

describe('India CPCB AQI Logic (cpcbAqi.ts)', () => {
  it('computes accurate CPCB sub-indices and categories across all 6 bands', () => {
    expect(calculatePm25SubIndex(15)).toBe(25);
    expect(getCpcbAqiCategory(25)).toBe('Good');

    expect(calculatePm25SubIndex(45)).toBe(75);
    expect(getCpcbAqiCategory(75)).toBe('Satisfactory');

    expect(calculatePm10SubIndex(175)).toBe(150);
    expect(getCpcbAqiCategory(150)).toBe('Moderate');

    expect(calculatePm25SubIndex(105)).toBe(250);
    expect(getCpcbAqiCategory(250)).toBe('Poor');

    expect(calculatePm25SubIndex(185)).toBe(350);
    expect(getCpcbAqiCategory(350)).toBe('Very Poor');

    expect(calculatePm25SubIndex(350)).toBe(441);
    expect(getCpcbAqiCategory(441)).toBe('Severe');
  });

  it('selects dominant pollutant as the maximum sub-index', () => {
    const res = computeOverallRowAqi({
      pm25UgM3: 110, // Poor (~267)
      pm10UgM3: 140, // Moderate (~127)
      no2UgM3: 40, // Good (50)
      so2UgM3: 20, // Good (25)
    });
    expect(res.dominantPollutant).toBe('PM2.5');
    expect(res.category).toBe('Poor');
    expect(res.aqi).toBeGreaterThan(200);
  });
});

describe('Deterministic Parsing, Unit Normalization & Quality Scoring (dataCleaner.ts)', () => {
  it('normalizes Indian DD/MM/YYYY and ISO timestamps and flags invalid dates', () => {
    expect(normalizeDateString('14/11/2026 08:30')).toBe('2026-11-14 08:30');
    expect(normalizeDateString('2026-11-14T09:15:00')).toBe('2026-11-14 09:15');
    expect(normalizeDateString('not-a-date')).toBeNull();
  });

  it('converts mg/m³ and gas ppm to µg/m³ and flags particulate ppm unit conflicts', () => {
    const mgRes = parseAndNormalizePollutant('0.145 mg/m3', 'ug/m3', 'PM2.5');
    expect(mgRes.valueUgM3).toBe(145);
    expect(mgRes.converted).toBe(true);

    const no2Ppm = parseAndNormalizePollutant('0.05 ppm', 'ug/m3', 'NO2');
    expect(no2Ppm.valueUgM3).toBeCloseTo(94.1, 1);
    expect(no2Ppm.converted).toBe(true);

    const pmPpmConflict = parseAndNormalizePollutant('218 ppm', 'ug/m3', 'PM2.5');
    expect(pmPpmConflict.unitConflict).toBe(true);
    expect(pmPpmConflict.valueUgM3).toBe(218);
  });

  it('flags negative values and out-of-range ceiling spikes as impossible', () => {
    const neg = parseAndNormalizePollutant('-18', 'ug/m3', 'PM2.5');
    expect(neg.impossible).toBe(true);
    expect(neg.valueUgM3).toBeNull();

    const ceiling = parseAndNormalizePollutant('5400', 'ug/m3', 'PM2.5');
    expect(ceiling.impossible).toBe(true);
    expect(ceiling.valueUgM3).toBeNull();
  });

  it('produces a complete QualityReport with row IDs, spike detection, and station scores', () => {
    const csv = [
      'Ward,Station,Timestamp,PM2.5,PM10,NO2,SO2,Units',
      'Ward K-West,Andheri RWA,14/11/2026 07:00,60,120,40,15,ug/m3',
      'Ward K-West,Andheri RWA,14/11/2026 08:00,65,130,42,16,ug/m3',
      'Ward K-West,Andheri RWA,14/11/2026 09:00,260,350,60,20,ug/m3',
      'Ward H-East,Bandra School,14/11/2026 09:00,-12,NA,50,18,ug/m3',
    ].join('\n');

    const report = parseAndCleanAirQualityData(csv);
    expect(report.totalRows).toBe(4);
    expect(report.rows[0].rowId).toBe('R01');
    expect(report.rows[2].rowId).toBe('R03');
    // R03 has a PM2.5 spike (260 vs median 65)
    expect(report.spikesDetectedCount).toBeGreaterThanOrEqual(1);
    // R04 has negative PM2.5 and missing PM10
    expect(report.impossibleValuesCount).toBe(1);
    expect(report.missingReadingsCount).toBe(1);
    expect(report.rows[3].isReliable).toBe(false);
    expect(report.hasEnoughReliableData).toBe(true);
  });
});

describe('API Route & Gemini Schema Validation (api/gemini.ts)', () => {
  it('validates analyze request payloads and rejects empty rows', () => {
    const bad = AnalyzePayloadSchema.safeParse({
      mode: 'analyze',
      overallReliabilityScore: 80,
      hasEnoughReliableData: true,
      rows: [],
    });
    expect(bad.success).toBe(false);

    const good = RequestPayloadSchema.safeParse({
      mode: 'analyze',
      overallReliabilityScore: 85,
      hasEnoughReliableData: true,
      rows: [
        {
          rowId: 'R01',
          rawStation: 'Andheri RWA',
          ward: 'Ward K-West',
          normalizedTimestamp: '2026-11-14 08:00',
          pm25UgM3: 95,
          pm10UgM3: 180,
          no2UgM3: 45,
          so2UgM3: 14,
          aqi: 217,
          aqiCategory: 'Poor',
          dominantPollutant: 'PM2.5',
          isReliable: true,
          issues: [],
        },
      ],
    });
    expect(good.success).toBe(true);
  });

  it('validates GeminiAnalysisOutputSchema and GeminiBriefOutputSchema', () => {
    const validAnalysis = GeminiAnalysisOutputSchema.safeParse({
      overallAssessment: 'Ward K-West shows Poor air quality driven by morning PM2.5.',
      insufficientDataNotice: null,
      trends: [
        {
          id: 'T1',
          title: 'Morning PM2.5 accumulation',
          summary: 'PM2.5 rose from 88 to 295 ug/m3 between 07:00 and 09:00.',
          citedRowIds: ['R01', 'R03'],
          confidence: 'High',
        },
      ],
      hotspots: [
        {
          id: 'H1',
          location: 'Ward K-West - Andheri RWA',
          severity: 'High',
          likelyCause: 'Vehicular congestion & dust',
          explanation: 'Peak AQI exceeded 300 at 09:00.',
          citedRowIds: ['R03'],
          confidence: 'High',
        },
      ],
      actions: [
        {
          id: 'A1',
          audience: 'Ward Officer',
          priority: 'Immediate (0-6 hrs)',
          action: 'Deploy misting tankers along Lokhandwala main road.',
          rationale: 'Suppresses resuspended road dust.',
          citedRowIds: ['R03'],
          confidence: 'High',
        },
      ],
    });
    expect(validAnalysis.success).toBe(true);

    const validBrief = GeminiBriefOutputSchema.safeParse({
      language: 'Hindi',
      readingLevel: 'Simple',
      internalBriefingNote: {
        subject: 'वार्ड के-वेस्ट वायु गुणवत्ता ब्रीफिंग',
        executiveSummary: 'सुबह के समय पीएम2.5 का स्तर बढ़ा है।',
        operationalDirectives: ['पानी का छिड़काव तुरंत शुरू करें।'],
        dataReliabilityNote: 'सेंसर डेटा 85% विश्वसनीय है।',
        citedRowIds: ['R01'],
      },
      citizenAdvisory: {
        headline: 'नागरिकों के लिए वायु गुणवत्ता सलाह',
        publicMessage: 'सुबह धुंध के समय बाहरी व्यायाम से बचें।',
        dosAndDonts: ['मास्क पहनें', 'कचरा न जलाएं'],
        vulnerableGroups: {
          children: 'बच्चों को इंडोर खेल कराएं।',
          olderAdults: 'बुजुर्ग सुबह की सैर टालें।',
          sensitiveIndividuals: 'अस्थमा रोगी इनहेलर साथ रखें।',
        },
        citedRowIds: ['R01'],
      },
    });
    expect(validBrief.success).toBe(true);
  });
});
