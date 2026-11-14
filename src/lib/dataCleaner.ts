import type {
  CleanedRow,
  QualityReport,
  RowIssue,
  StationQualitySummary,
} from '../types/airQuality';
import { computeOverallRowAqi, getCpcbAqiCategory } from './cpcbAqi';

const MAX_INPUT_BYTES = 512 * 1024; // 512 KB limit
const MAX_ROWS = 500;

const MISSING_TOKENS = new Set([
  '',
  'na',
  'n/a',
  'null',
  'none',
  'nan',
  '-',
  '--',
  'missing',
  'err',
  'error',
  '#n/a',
  '-999',
  '-9999',
]);

// Molecular weights at 25°C and 1 atm (molar volume = 24.45 L/mol)
const MOLAR_VOLUME = 24.45;
const MW_NO2 = 46.0055;
const MW_SO2 = 64.066;

function detectDelimiter(headerLine: string): string {
  const counts: Array<{ char: string; count: number }> = [
    { char: ',', count: (headerLine.match(/,/g) || []).length },
    { char: '\t', count: (headerLine.match(/\t/g) || []).length },
    { char: ';', count: (headerLine.match(/;/g) || []).length },
    { char: '|', count: (headerLine.match(/\|/g) || []).length },
  ];
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].char : ',';
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Normalizes a heterogeneous timestamp string (DD/MM/YYYY, DD-MM-YYYY, or ISO 8601)
 * into a canonical `YYYY-MM-DD HH:mm` format.
 *
 * @param raw - Raw timestamp string from CSV/TSV cell
 * @returns Normalized timestamp string or null if missing/unparseable
 */
export function normalizeDateString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || MISSING_TOKENS.has(trimmed.toLowerCase())) return null;

  // Match DD/MM/YYYY or DD-MM-YYYY with optional HH:mm
  const dmyMatch = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyMatch) {
    const first = parseInt(dmyMatch[1], 10);
    const second = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;

    // In India DD/MM/YYYY is standard; if second > 12 and first <= 12, swap as MM/DD/YYYY
    let day = first;
    let month = second;
    if (month > 12 && day <= 12) {
      day = second;
      month = first;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && minute <= 59) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const hh = String(hour).padStart(2, '0');
      const min = String(minute).padStart(2, '0');
      return `${year}-${mm}-${dd} ${hh}:${min}`;
    }
    return null;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD with optional time
  const ymdMatch = trimmed.match(
    /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:Z|[+-]\d{2}:?\d{2})?)?$/
  );
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && hour <= 23 && minute <= 59) {
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const hh = String(hour).padStart(2, '0');
      const min = String(minute).padStart(2, '0');
      return `${year}-${mm}-${dd} ${hh}:${min}`;
    }
    return null;
  }

  // Fallback Date.parse for formats like "14 Nov 2026 08:00"
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const year = d.getFullYear();
    if (year >= 2000 && year <= 2100) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${mm}-${dd} ${hh}:${min}`;
    }
  }

  return null;
}

interface ParsedMeasurement {
  valueUgM3: number | null;
  detectedUnit: string;
  converted: boolean;
  unitConflict: boolean;
  impossible: boolean;
  missing: boolean;
  note?: string;
}

/**
 * Parses a raw pollutant cell string, normalizes units (`mg/m³`, `ppm`, `ppb` -> `µg/m³`),
 * flags physical unit conflicts, and validates against physical sensor ceiling bounds.
 *
 * @param rawCell - Raw cell string (e.g., "0.145 mg/m3", "0.032 ppm", "-18", "NA")
 * @param rowUnitHint - Default unit specified in the row's Units column or header
 * @param pollutant - Pollutant identifier ('PM2.5' | 'PM10' | 'NO2' | 'SO2')
 * @returns ParsedMeasurement containing normalized µg/m³ value and audit flags
 */
export function parseAndNormalizePollutant(
  rawCell: string | undefined,
  rowUnitHint: string,
  pollutant: 'PM2.5' | 'PM10' | 'NO2' | 'SO2'
): ParsedMeasurement {
  const cell = (rawCell ?? '').trim();
  if (!cell || MISSING_TOKENS.has(cell.toLowerCase())) {
    return {
      valueUgM3: null,
      detectedUnit: rowUnitHint || 'µg/m³',
      converted: false,
      unitConflict: false,
      impossible: false,
      missing: true,
    };
  }

  // Extract number and optional inline unit e.g. "142 ug/m3", "0.08 ppm", "0.18 mg/m3", "-15"
  const match = cell.match(/^([+-]?\d+(?:\.\d+)?)\s*([a-zA-Zµμ/³3]+)?$/);
  if (!match) {
    return {
      valueUgM3: null,
      detectedUnit: 'unknown',
      converted: false,
      unitConflict: false,
      impossible: true,
      missing: false,
      note: `Unparseable numeric reading "${cell}"`,
    };
  }

  const rawNum = parseFloat(match[1]);
  const inlineUnitRaw = (match[2] || '').toLowerCase();
  const columnUnitRaw = (rowUnitHint || '').toLowerCase();

  // Check sentinel negative values like -999
  if (rawNum === -999 || rawNum === -9999) {
    return {
      valueUgM3: null,
      detectedUnit: 'µg/m³',
      converted: false,
      unitConflict: false,
      impossible: false,
      missing: true,
    };
  }

  if (rawNum < 0) {
    return {
      valueUgM3: null,
      detectedUnit: inlineUnitRaw || columnUnitRaw || 'µg/m³',
      converted: false,
      unitConflict: false,
      impossible: true,
      missing: false,
      note: `Negative concentration (${rawNum}) is physically impossible`,
    };
  }

  const effectiveUnit = inlineUnitRaw || columnUnitRaw || 'ug/m3';
  const normInline = inlineUnitRaw ? normalizeUnitToken(inlineUnitRaw) : null;
  const normColumn = columnUnitRaw ? normalizeUnitToken(columnUnitRaw) : null;

  // A true unit conflict occurs only when the unit is unknown or physically incompatible with the pollutant
  // (e.g., particulate matter PM2.5/PM10 reported in gas volume ratio ppm/ppb).
  // Valid convertible units (like inline mg/m3 or gas ppm when the table default column says ug/m3) are unit conversions, not conflicts.
  const hasConflict =
    normInline === 'unknown' ||
    ((pollutant === 'PM2.5' || pollutant === 'PM10') &&
      (normInline === 'ppm' || normInline === 'ppb' || normColumn === 'ppm' || normColumn === 'ppb'));

  const normUnit = normalizeUnitToken(effectiveUnit);

  let valueUgM3 = rawNum;
  let converted = false;
  let unitConflict = hasConflict;
  let note: string | undefined;

  if (normUnit === 'mg/m3') {
    valueUgM3 = Math.round(rawNum * 1000 * 100) / 100;
    converted = true;
    note = `Converted ${rawNum} mg/m³ → ${valueUgM3} µg/m³`;
  } else if (normUnit === 'ppm') {
    if (pollutant === 'NO2') {
      valueUgM3 = Math.round(((rawNum * 1000 * MW_NO2) / MOLAR_VOLUME) * 10) / 10;
      converted = true;
      note = `Converted ${rawNum} ppm NO₂ → ${valueUgM3} µg/m³`;
    } else if (pollutant === 'SO2') {
      valueUgM3 = Math.round(((rawNum * 1000 * MW_SO2) / MOLAR_VOLUME) * 10) / 10;
      converted = true;
      note = `Converted ${rawNum} ppm SO₂ → ${valueUgM3} µg/m³`;
    } else {
      // PM2.5 or PM10 reported in ppm or mg/m3 confusion:
      // Particulate matter cannot physically be measured in gas volume ratio (ppm),
      // though low-cost sensors sometimes mislabel mg/m³ as ppm when values are < 2.
      unitConflict = true;
      if (rawNum <= 2) {
        valueUgM3 = Math.round(rawNum * 1000 * 10) / 10;
        converted = true;
        note = `${pollutant} had gas unit "ppm" (${rawNum}); treated as mg/m³ (${valueUgM3} µg/m³) and flagged unit conflict`;
      } else {
        valueUgM3 = rawNum;
        note = `${pollutant} had invalid unit "ppm" (${rawNum}); retained numeric value as µg/m³ and flagged unit conflict`;
      }
    }
  } else if (normUnit === 'ppb') {
    if (pollutant === 'NO2') {
      valueUgM3 = Math.round(((rawNum * MW_NO2) / MOLAR_VOLUME) * 10) / 10;
      converted = true;
      note = `Converted ${rawNum} ppb NO₂ → ${valueUgM3} µg/m³`;
    } else if (pollutant === 'SO2') {
      valueUgM3 = Math.round(((rawNum * MW_SO2) / MOLAR_VOLUME) * 10) / 10;
      converted = true;
      note = `Converted ${rawNum} ppb SO₂ → ${valueUgM3} µg/m³`;
    } else {
      unitConflict = true;
      note = `${pollutant} had gas unit "ppb"; flagged unit conflict`;
    }
  }

  // Check upper physical plausibility limits (ambient air quality sensor bounds)
  const maxLimit = pollutant === 'PM10' ? 2000 : pollutant === 'PM2.5' ? 1500 : 2500;
  if (valueUgM3 > maxLimit) {
    return {
      valueUgM3: null,
      detectedUnit: effectiveUnit,
      converted,
      unitConflict,
      impossible: true,
      missing: false,
      note: `${pollutant} value (${valueUgM3} µg/m³) exceeds sensor physical ceiling (${maxLimit} µg/m³)`,
    };
  }

  return {
    valueUgM3: Math.round(valueUgM3 * 10) / 10,
    detectedUnit: normUnit === 'ug/m3' ? 'µg/m³' : effectiveUnit,
    converted,
    unitConflict,
    impossible: false,
    missing: false,
    note,
  };
}

function normalizeUnitToken(u: string): 'ug/m3' | 'mg/m3' | 'ppm' | 'ppb' | 'unknown' {
  const clean = u.replace(/\s+/g, '').toLowerCase();
  if (
    clean.includes('ug/m3') ||
    clean.includes('µg/m3') ||
    clean.includes('μg/m3') ||
    clean.includes('ug/m³') ||
    clean.includes('µg/m³') ||
    clean.includes('μg/m³') ||
    clean === 'ug' ||
    clean === 'µg'
  ) {
    return 'ug/m3';
  }
  if (clean.includes('mg/m3') || clean.includes('mg/m³') || clean === 'mg') {
    return 'mg/m3';
  }
  if (clean.includes('ppm')) return 'ppm';
  if (clean.includes('ppb')) return 'ppb';
  return 'unknown';
}

interface ColumnMap {
  wardIdx: number;
  stationIdx: number;
  timestampIdx: number;
  pm25Idx: number;
  pm10Idx: number;
  no2Idx: number;
  so2Idx: number;
  unitIdx: number;
  pm25HeaderUnit: string;
  pm10HeaderUnit: string;
  no2HeaderUnit: string;
  so2HeaderUnit: string;
}

function extractHeaderUnit(header: string): string {
  const lower = header.toLowerCase();
  if (lower.includes('ppm')) return 'ppm';
  if (lower.includes('ppb')) return 'ppb';
  if (lower.includes('mg/m')) return 'mg/m3';
  if (lower.includes('ug/m') || lower.includes('µg/m') || lower.includes('μg/m')) return 'ug/m3';
  return '';
}

function mapColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {
    wardIdx: -1,
    stationIdx: -1,
    timestampIdx: -1,
    pm25Idx: -1,
    pm10Idx: -1,
    no2Idx: -1,
    so2Idx: -1,
    unitIdx: -1,
    pm25HeaderUnit: '',
    pm10HeaderUnit: '',
    no2HeaderUnit: '',
    so2HeaderUnit: '',
  };

  headers.forEach((rawH, idx) => {
    const h = rawH.toLowerCase().trim();
    if (map.wardIdx === -1 && (h.includes('ward') || h.includes('zone') || h.includes('sector'))) {
      map.wardIdx = idx;
    } else if (
      map.stationIdx === -1 &&
      (h.includes('station') ||
        h.includes('location') ||
        h.includes('site') ||
        h.includes('society') ||
        h.includes('area') ||
        h.includes('name'))
    ) {
      map.stationIdx = idx;
    } else if (
      map.timestampIdx === -1 &&
      (h.includes('time') || h.includes('date') || h.includes('recorded') || h.includes('hour'))
    ) {
      map.timestampIdx = idx;
    } else if (
      map.pm25Idx === -1 &&
      (h.includes('pm2.5') || h.includes('pm25') || h.includes('pm 2.5') || h.includes('pm_25'))
    ) {
      map.pm25Idx = idx;
      map.pm25HeaderUnit = extractHeaderUnit(rawH);
    } else if (
      map.pm10Idx === -1 &&
      (h.includes('pm10') || h.includes('pm 10') || h.includes('pm_10'))
    ) {
      map.pm10Idx = idx;
      map.pm10HeaderUnit = extractHeaderUnit(rawH);
    } else if (map.no2Idx === -1 && (h.includes('no2') || h.includes('no₂'))) {
      map.no2Idx = idx;
      map.no2HeaderUnit = extractHeaderUnit(rawH);
    } else if (map.so2Idx === -1 && (h.includes('so2') || h.includes('so₂'))) {
      map.so2Idx = idx;
      map.so2HeaderUnit = extractHeaderUnit(rawH);
    } else if (map.unitIdx === -1 && (h === 'unit' || h === 'units' || h.includes('uom'))) {
      map.unitIdx = idx;
    }
  });

  return map;
}

/**
 * Deterministically parses, normalizes, and audits a raw CSV/TSV air quality table in O(N) time.
 * Assigns traceable row IDs (`R01`..`R##`), computes India CPCB AQI sub-indices, detects station spikes,
 * and builds a comprehensive QualityReport.
 *
 * @param rawInput - Raw CSV, TSV, or semicolon-delimited table text
 * @returns Complete deterministic QualityReport
 */
export function parseAndCleanAirQualityData(rawInput: string): QualityReport {
  if (!rawInput || !rawInput.trim()) {
    throw new Error('Input is empty. Please paste a CSV/table or upload a file with air quality readings.');
  }

  if (new Blob([rawInput]).size > MAX_INPUT_BYTES) {
    throw new Error('Input exceeds the 512 KB size limit. Please upload a smaller dataset.');
  }

  const lines = rawInput
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) {
    throw new Error(
      'At least one header row and one data row are required. Check that your input is formatted as a table or CSV.'
    );
  }

  if (lines.length - 1 > MAX_ROWS) {
    throw new Error(`Dataset contains ${lines.length - 1} rows, exceeding the maximum limit of ${MAX_ROWS} rows.`);
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimitedLine(lines[0], delimiter);
  const colMap = mapColumns(headers);

  if (colMap.pm25Idx === -1 && colMap.pm10Idx === -1 && colMap.no2Idx === -1 && colMap.so2Idx === -1) {
    throw new Error(
      'Could not detect any pollutant columns (expected at least one of PM2.5, PM10, NO2, or SO2 in the header row).'
    );
  }

  const rows: CleanedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitDelimitedLine(lines[i], delimiter);
    if (cells.every((c) => c === '')) continue;

    const rowId = `R${String(rows.length + 1).padStart(2, '0')}`;
    const rawWard = colMap.wardIdx >= 0 ? cells[colMap.wardIdx] || '' : '';
    const rawStation = colMap.stationIdx >= 0 ? cells[colMap.stationIdx] || '' : '';
    const ward = rawWard.trim() || (rawStation.trim() ? inferWardFromStation(rawStation.trim()) : 'Unspecified Ward');
    const station = rawStation.trim() || ward;
    const rawTimestamp = colMap.timestampIdx >= 0 ? cells[colMap.timestampIdx] || '' : '';
    const rowUnitCell = colMap.unitIdx >= 0 ? cells[colMap.unitIdx] || '' : '';

    const issues: RowIssue[] = [];

    const normalizedTimestamp = normalizeDateString(rawTimestamp);
    if (!normalizedTimestamp) {
      issues.push({
        type: 'INVALID_DATE',
        field: 'timestamp',
        message: rawTimestamp
          ? `Unrecognized or invalid date "${rawTimestamp}"`
          : 'Missing timestamp',
        severity: 'warning',
      });
    }

    const pm25Res =
      colMap.pm25Idx >= 0
        ? parseAndNormalizePollutant(
            cells[colMap.pm25Idx],
            rowUnitCell || colMap.pm25HeaderUnit,
            'PM2.5'
          )
        : null;

    const pm10Res =
      colMap.pm10Idx >= 0
        ? parseAndNormalizePollutant(
            cells[colMap.pm10Idx],
            rowUnitCell || colMap.pm10HeaderUnit,
            'PM10'
          )
        : null;

    const no2Res =
      colMap.no2Idx >= 0
        ? parseAndNormalizePollutant(
            cells[colMap.no2Idx],
            rowUnitCell || colMap.no2HeaderUnit,
            'NO2'
          )
        : null;

    const so2Res =
      colMap.so2Idx >= 0
        ? parseAndNormalizePollutant(
            cells[colMap.so2Idx],
            rowUnitCell || colMap.so2HeaderUnit,
            'SO2'
          )
        : null;

    const recordPollutantIssues = (name: string, res: ParsedMeasurement | null) => {
      if (!res) return;
      if (res.missing) {
        issues.push({
          type: 'MISSING_READING',
          field: name,
          message: `${name} reading is missing`,
          severity: 'warning',
        });
      }
      if (res.impossible) {
        issues.push({
          type: 'IMPOSSIBLE_VALUE',
          field: name,
          message: res.note || `${name} has an impossible value`,
          severity: 'error',
        });
      }
      if (res.unitConflict) {
        issues.push({
          type: 'UNIT_CONFLICT',
          field: name,
          message: res.note || `${name} unit conflict detected`,
          severity: 'warning',
        });
      } else if (res.converted && res.note) {
        issues.push({
          type: 'UNIT_CONVERTED',
          field: name,
          message: res.note,
          severity: 'info',
        });
      }
    };

    recordPollutantIssues('PM2.5', pm25Res);
    recordPollutantIssues('PM10', pm10Res);
    recordPollutantIssues('NO2', no2Res);
    recordPollutantIssues('SO2', so2Res);

    const pm25UgM3 = pm25Res?.valueUgM3 ?? null;
    const pm10UgM3 = pm10Res?.valueUgM3 ?? null;
    const no2UgM3 = no2Res?.valueUgM3 ?? null;
    const so2UgM3 = so2Res?.valueUgM3 ?? null;

    // Physical consistency check: PM2.5 is a subset of PM10; if PM2.5 > PM10 * 1.05, flag conflict
    if (pm25UgM3 !== null && pm10UgM3 !== null && pm25UgM3 > pm10UgM3 * 1.05) {
      issues.push({
        type: 'IMPOSSIBLE_VALUE',
        field: 'PM2.5/PM10',
        message: `PM2.5 (${pm25UgM3} µg/m³) exceeds PM10 (${pm10UgM3} µg/m³), which is physically inconsistent`,
        severity: 'error',
      });
    }

    const aqiComputation = computeOverallRowAqi({
      pm25UgM3,
      pm10UgM3,
      no2UgM3,
      so2UgM3,
    });

    const hasParticulateOrGas =
      pm25UgM3 !== null || pm10UgM3 !== null || no2UgM3 !== null || so2UgM3 !== null;
    const hasHardError = issues.some((iss) => iss.severity === 'error');

    rows.push({
      rowId,
      rawStation: station,
      ward,
      rawTimestamp,
      normalizedTimestamp,
      pm25UgM3,
      pm10UgM3,
      no2UgM3,
      so2UgM3,
      originalUnits: rowUnitCell || 'µg/m³',
      subIndexPm25: aqiComputation.subIndexPm25,
      subIndexPm10: aqiComputation.subIndexPm10,
      aqi: hasHardError ? null : aqiComputation.aqi,
      aqiCategory: hasHardError ? 'Insufficient Data' : aqiComputation.category,
      dominantPollutant: hasHardError ? 'None' : aqiComputation.dominantPollutant,
      isReliable: hasParticulateOrGas && !hasHardError,
      issues,
    });
  }

  // Second pass: Spike detection per station/ward
  detectStationSpikes(rows);

  return buildQualityReport(rows);
}

function inferWardFromStation(station: string): string {
  const match = station.match(/(ward\s*[a-z0-9-]+|sector\s*\d+|zone\s*[a-z0-9-]+)/i);
  return match ? match[1] : station;
}

function detectStationSpikes(rows: CleanedRow[]): void {
  const byStation = new Map<string, CleanedRow[]>();
  for (const r of rows) {
    const key = `${r.ward}::${r.rawStation}`.toLowerCase();
    const list = byStation.get(key) || [];
    list.push(r);
    byStation.set(key, list);
  }

  for (const stationRows of byStation.values()) {
    const validPm25 = stationRows
      .filter((r) => r.pm25UgM3 !== null && r.isReliable)
      .map((r) => r.pm25UgM3 as number)
      .sort((a, b) => a - b);

    if (validPm25.length >= 3) {
      const median = validPm25[Math.floor(validPm25.length / 2)];
      for (const r of stationRows) {
        if (
          r.pm25UgM3 !== null &&
          median > 0 &&
          r.pm25UgM3 >= median * 2.6 &&
          r.pm25UgM3 - median >= 120
        ) {
          r.issues.push({
            type: 'SPIKE_DETECTED',
            field: 'PM2.5',
            message: `Sudden PM2.5 spike (${r.pm25UgM3} µg/m³ vs station median ${median} µg/m³)`,
            severity: 'warning',
          });
        }
      }
    }

    const validPm10 = stationRows
      .filter((r) => r.pm10UgM3 !== null && r.isReliable)
      .map((r) => r.pm10UgM3 as number)
      .sort((a, b) => a - b);

    if (validPm10.length >= 3) {
      const median10 = validPm10[Math.floor(validPm10.length / 2)];
      for (const r of stationRows) {
        const alreadySpiked = r.issues.some((i) => i.type === 'SPIKE_DETECTED');
        if (
          !alreadySpiked &&
          r.pm10UgM3 !== null &&
          median10 > 0 &&
          r.pm10UgM3 >= median10 * 2.6 &&
          r.pm10UgM3 - median10 >= 180
        ) {
          r.issues.push({
            type: 'SPIKE_DETECTED',
            field: 'PM10',
            message: `Sudden PM10 spike (${r.pm10UgM3} µg/m³ vs station median ${median10} µg/m³)`,
            severity: 'warning',
          });
        }
      }
    }
  }
}

function scoreRowReliability(row: CleanedRow): number {
  if (!row.isReliable) return 0;
  let score = 100;
  for (const issue of row.issues) {
    if (issue.type === 'MISSING_READING') score -= 18;
    else if (issue.type === 'UNIT_CONFLICT') score -= 25;
    else if (issue.type === 'INVALID_DATE') score -= 15;
    else if (issue.type === 'SPIKE_DETECTED') score -= 10;
    else if (issue.type === 'UNIT_CONVERTED') score -= 3;
  }
  return Math.max(20, score);
}

function buildQualityReport(rows: CleanedRow[]): QualityReport {
  let missingReadingsCount = 0;
  let impossibleValuesCount = 0;
  let spikesDetectedCount = 0;
  let unitConversionsCount = 0;
  let unitConflictsCount = 0;
  let invalidDatesCount = 0;

  const stationGroups = new Map<string, CleanedRow[]>();

  for (const row of rows) {
    for (const iss of row.issues) {
      if (iss.type === 'MISSING_READING') missingReadingsCount++;
      if (iss.type === 'IMPOSSIBLE_VALUE') impossibleValuesCount++;
      if (iss.type === 'SPIKE_DETECTED') spikesDetectedCount++;
      if (iss.type === 'UNIT_CONVERTED') unitConversionsCount++;
      if (iss.type === 'UNIT_CONFLICT') unitConflictsCount++;
      if (iss.type === 'INVALID_DATE') invalidDatesCount++;
    }

    const key = `${row.ward}|||${row.rawStation}`;
    const group = stationGroups.get(key) || [];
    group.push(row);
    stationGroups.set(key, group);
  }

  const stationSummaries: StationQualitySummary[] = [];

  for (const [key, groupRows] of stationGroups.entries()) {
    const [ward, station] = key.split('|||');
    const reliableInGroup = groupRows.filter((r) => r.isReliable);
    const aqiValues = reliableInGroup
      .map((r) => r.aqi)
      .filter((a): a is number => a !== null);

    const avgAqi =
      aqiValues.length > 0
        ? Math.round(aqiValues.reduce((acc, v) => acc + v, 0) / aqiValues.length)
        : null;
    const peakAqi = aqiValues.length > 0 ? Math.max(...aqiValues) : null;

    const avgRowScore =
      groupRows.length > 0
        ? Math.round(
            groupRows.reduce((acc, r) => acc + scoreRowReliability(r), 0) / groupRows.length
          )
        : 0;

    stationSummaries.push({
      ward,
      station,
      totalRows: groupRows.length,
      reliableRows: reliableInGroup.length,
      missingCount: groupRows.reduce(
        (acc, r) => acc + r.issues.filter((i) => i.type === 'MISSING_READING').length,
        0
      ),
      impossibleCount: groupRows.reduce(
        (acc, r) => acc + r.issues.filter((i) => i.type === 'IMPOSSIBLE_VALUE').length,
        0
      ),
      spikeCount: groupRows.reduce(
        (acc, r) => acc + r.issues.filter((i) => i.type === 'SPIKE_DETECTED').length,
        0
      ),
      unitConversions: groupRows.reduce(
        (acc, r) => acc + r.issues.filter((i) => i.type === 'UNIT_CONVERTED').length,
        0
      ),
      unitConflicts: groupRows.reduce(
        (acc, r) => acc + r.issues.filter((i) => i.type === 'UNIT_CONFLICT').length,
        0
      ),
      reliabilityScore: avgRowScore,
      averageAqi: avgAqi,
      peakAqi,
      dominantCategory: getCpcbAqiCategory(avgAqi),
    });
  }

  const reliableRows = rows.filter((r) => r.isReliable).length;
  const flaggedRows = rows.filter((r) => r.issues.length > 0).length;
  const overallReliabilityScore =
    rows.length > 0
      ? Math.round(rows.reduce((acc, r) => acc + scoreRowReliability(r), 0) / rows.length)
      : 0;

  // Require at least 2 reliable rows and >= 35% reliability score to make strong trend claims
  const hasEnoughReliableData = reliableRows >= 2 && overallReliabilityScore >= 35;

  return {
    totalRows: rows.length,
    reliableRows,
    flaggedRows,
    overallReliabilityScore,
    missingReadingsCount,
    impossibleValuesCount,
    spikesDetectedCount,
    unitConversionsCount,
    unitConflictsCount,
    invalidDatesCount,
    hasEnoughReliableData,
    stationSummaries,
    rows,
  };
}
