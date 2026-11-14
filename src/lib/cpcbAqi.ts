import type { AqiCategory } from '../types/airQuality';

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

const PM25_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
  { cLow: 30.001, cHigh: 60, iLow: 51, iHigh: 100 },
  { cLow: 60.001, cHigh: 90, iLow: 101, iHigh: 200 },
  { cLow: 90.001, cHigh: 120, iLow: 201, iHigh: 300 },
  { cLow: 120.001, cHigh: 250, iLow: 301, iHigh: 400 },
  { cLow: 250.001, cHigh: 500, iLow: 401, iHigh: 500 },
];

const PM10_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50.001, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100.001, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 250.001, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 350.001, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 430.001, cHigh: 600, iLow: 401, iHigh: 500 },
];

const NO2_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40.001, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80.001, cHigh: 180, iLow: 101, iHigh: 200 },
  { cLow: 180.001, cHigh: 280, iLow: 201, iHigh: 300 },
  { cLow: 280.001, cHigh: 400, iLow: 301, iHigh: 400 },
  { cLow: 400.001, cHigh: 800, iLow: 401, iHigh: 500 },
];

const SO2_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40.001, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80.001, cHigh: 380, iLow: 101, iHigh: 200 },
  { cLow: 380.001, cHigh: 800, iLow: 201, iHigh: 300 },
  { cLow: 800.001, cHigh: 1600, iLow: 301, iHigh: 400 },
  { cLow: 1600.001, cHigh: 2400, iLow: 401, iHigh: 500 },
];

/**
 * Performs piecewise linear interpolation across India CPCB breakpoint tables.
 *
 * @param value - Pollutant concentration in µg/m³
 * @param breakpoints - CPCB breakpoint table for the specific pollutant
 * @returns Rounded CPCB sub-index (0 to 500)
 */
function interpolateSubIndex(value: number, breakpoints: Breakpoint[]): number {
  if (value < 0) return 0;
  for (const bp of breakpoints) {
    if (value >= bp.cLow && value <= bp.cHigh) {
      const subIndex =
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (value - bp.cLow) + bp.iLow;
      return Math.round(subIndex);
    }
  }
  return 500;
}

/**
 * Calculates the India CPCB sub-index for PM2.5 concentration in µg/m³.
 *
 * @param pm25UgM3 - PM2.5 reading in µg/m³ or null
 * @returns CPCB sub-index or null if reading is missing/invalid
 */
export function calculatePm25SubIndex(pm25UgM3: number | null): number | null {
  if (pm25UgM3 === null || Number.isNaN(pm25UgM3) || pm25UgM3 < 0) return null;
  return interpolateSubIndex(pm25UgM3, PM25_BREAKPOINTS);
}

/**
 * Calculates the India CPCB sub-index for PM10 concentration in µg/m³.
 *
 * @param pm10UgM3 - PM10 reading in µg/m³ or null
 * @returns CPCB sub-index or null if reading is missing/invalid
 */
export function calculatePm10SubIndex(pm10UgM3: number | null): number | null {
  if (pm10UgM3 === null || Number.isNaN(pm10UgM3) || pm10UgM3 < 0) return null;
  return interpolateSubIndex(pm10UgM3, PM10_BREAKPOINTS);
}

/**
 * Calculates the India CPCB sub-index for NO₂ concentration in µg/m³.
 *
 * @param no2UgM3 - NO₂ reading in µg/m³ or null
 * @returns CPCB sub-index or null if reading is missing/invalid
 */
export function calculateNo2SubIndex(no2UgM3: number | null): number | null {
  if (no2UgM3 === null || Number.isNaN(no2UgM3) || no2UgM3 < 0) return null;
  return interpolateSubIndex(no2UgM3, NO2_BREAKPOINTS);
}

/**
 * Calculates the India CPCB sub-index for SO₂ concentration in µg/m³.
 *
 * @param so2UgM3 - SO₂ reading in µg/m³ or null
 * @returns CPCB sub-index or null if reading is missing/invalid
 */
export function calculateSo2SubIndex(so2UgM3: number | null): number | null {
  if (so2UgM3 === null || Number.isNaN(so2UgM3) || so2UgM3 < 0) return null;
  return interpolateSubIndex(so2UgM3, SO2_BREAKPOINTS);
}

/**
 * Maps a numeric CPCB AQI value to its official 6-band India CPCB category.
 *
 * @param aqi - Numeric CPCB AQI (0–500) or null
 * @returns Official AqiCategory string
 */
export function getCpcbAqiCategory(aqi: number | null): AqiCategory {
  if (aqi === null || Number.isNaN(aqi) || aqi < 0) return 'Insufficient Data';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

/**
 * Returns WCAG AA/AAA compliant Tailwind badge classes for a given CPCB AQI category.
 *
 * @param category - CPCB AqiCategory
 * @returns Tailwind CSS class string
 */
export function getAqiBadgeStyle(category: AqiCategory): string {
  switch (category) {
    case 'Good':
      return 'bg-emerald-100 text-emerald-950 border-emerald-300';
    case 'Satisfactory':
      return 'bg-lime-100 text-lime-950 border-lime-300';
    case 'Moderate':
      return 'bg-amber-100 text-amber-950 border-amber-300';
    case 'Poor':
      return 'bg-orange-100 text-orange-950 border-orange-300';
    case 'Very Poor':
      return 'bg-red-100 text-red-950 border-red-300';
    case 'Severe':
      return 'bg-rose-950 text-white border-rose-800';
    default:
      return 'bg-slate-200 text-slate-900 border-slate-300';
  }
}

/**
 * Computes overall row AQI, category, and dominant pollutant as the maximum sub-index across measured pollutants.
 *
 * @param params - Normalized concentrations for PM2.5, PM10, NO2, and SO2 in µg/m³
 * @returns Sub-indices, overall AQI, CPCB category, and dominant pollutant
 */
export function computeOverallRowAqi(params: {
  pm25UgM3: number | null;
  pm10UgM3: number | null;
  no2UgM3: number | null;
  so2UgM3: number | null;
}): {
  subIndexPm25: number | null;
  subIndexPm10: number | null;
  aqi: number | null;
  category: AqiCategory;
  dominantPollutant: 'PM2.5' | 'PM10' | 'NO2' | 'SO2' | 'None';
} {
  const subIndexPm25 = calculatePm25SubIndex(params.pm25UgM3);
  const subIndexPm10 = calculatePm10SubIndex(params.pm10UgM3);
  const subIndexNo2 = calculateNo2SubIndex(params.no2UgM3);
  const subIndexSo2 = calculateSo2SubIndex(params.so2UgM3);

  const candidates: Array<{
    name: 'PM2.5' | 'PM10' | 'NO2' | 'SO2';
    value: number;
  }> = [];

  if (subIndexPm25 !== null) candidates.push({ name: 'PM2.5', value: subIndexPm25 });
  if (subIndexPm10 !== null) candidates.push({ name: 'PM10', value: subIndexPm10 });
  if (subIndexNo2 !== null) candidates.push({ name: 'NO2', value: subIndexNo2 });
  if (subIndexSo2 !== null) candidates.push({ name: 'SO2', value: subIndexSo2 });

  if (candidates.length === 0) {
    return {
      subIndexPm25: null,
      subIndexPm10: null,
      aqi: null,
      category: 'Insufficient Data',
      dominantPollutant: 'None',
    };
  }

  candidates.sort((a, b) => b.value - a.value);
  const top = candidates[0];

  return {
    subIndexPm25,
    subIndexPm10,
    aqi: top.value,
    category: getCpcbAqiCategory(top.value),
    dominantPollutant: top.name,
  };
}
