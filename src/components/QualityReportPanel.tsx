import React, { memo } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Gauge } from 'lucide-react';
import type { QualityReport } from '../types/airQuality';
import { getAqiBadgeStyle } from '../lib/cpcbAqi';
import { NormalizedRowLedger } from './NormalizedRowLedger';

interface QualityReportPanelProps {
  report: QualityReport;
  highlightedRowId: string | null;
}

const CPCB_BANDS = [
  { label: 'GOOD', range: '0–50', color: 'bg-emerald-500/80 text-emerald-950' },
  { label: 'SATISFACTORY', range: '51–100', color: 'bg-lime-500/80 text-lime-950' },
  { label: 'MODERATE', range: '101–200', color: 'bg-amber-400/90 text-amber-950' },
  { label: 'POOR', range: '201–300', color: 'bg-orange-500/90 text-white' },
  { label: 'VERY POOR', range: '301–400', color: 'bg-red-600 text-white' },
  { label: 'SEVERE', range: '401–500', color: 'bg-rose-600 text-white font-black' },
];

/**
 * Renders the deterministic CPCB Data Quality & Normalization Report,
 * Live Atmospheric Hazard Spectrum, Station Reliability Scorecard, and NormalizedRowLedger.
 *
 * @param props - Deterministic QualityReport and highlightedRowId
 * @returns Memoized section component
 */
export const QualityReportPanel: React.FC<QualityReportPanelProps> = memo(({
  report,
  highlightedRowId,
}) => {
  const cityPeakAqi = report.stationSummaries.reduce<number>(
    (max, s) => (s.peakAqi !== null && s.peakAqi > max ? s.peakAqi : max),
    0
  );
  const markerLeftPct = Math.min(98, Math.max(2, Math.round((cityPeakAqi / 500) * 100)));

  return (
    <section
      aria-labelledby="quality-report-heading"
      aria-live="polite"
      className="bg-[#101018]/95 rounded-2xl border border-zinc-800/90 border-t-2 border-t-rose-500 shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-rose-300 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-700/70">
            Deterministic Audit · India CPCB National AQI
          </span>
          <h2 id="quality-report-heading" className="text-lg sm:text-xl font-black text-white mt-2">
            Data Quality &amp; Normalization Report
          </h2>
          <p className="text-sm text-zinc-300">
            All valid measurements normalized to <strong className="text-rose-300 font-mono">µg/m³</strong>.
            Impossible readings and unit conflicts are isolated before AI synthesis.
          </p>
        </div>

        <div className="flex items-center gap-3.5 bg-[#090910] border border-rose-800/70 rounded-xl px-4 py-3 shadow-[0_0_20px_rgba(225,29,72,0.18)]">
          {report.hasEnoughReliableData ? (
            <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0 animate-pulse" aria-hidden="true" />
          )}
          <div>
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              Dataset Trust Score
            </div>
            <div className="text-2xl font-black font-mono text-white">
              {report.overallReliabilityScore}%
              <span className="ml-2 text-xs font-medium text-rose-300">
                ({report.reliableRows}/{report.totalRows} reliable rows)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live CPCB Atmospheric Hazard Spectrum Meter */}
      <div className="rounded-xl bg-[#090910] border border-zinc-800 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-rose-300">
            <Gauge className="w-4 h-4 text-rose-500" aria-hidden="true" />
            Live CPCB Atmospheric Hazard Spectrum (0–500 Scale)
          </span>
          <span className="text-zinc-200">
            Active Peak Telemetry: <strong className="text-rose-400 text-sm">{cityPeakAqi || 'N/A'} AQI</strong>
          </span>
        </div>
        <div className="relative pt-2 pb-1">
          <div className="grid grid-cols-6 gap-1 rounded-lg overflow-hidden text-[10px] font-mono text-center">
            {CPCB_BANDS.map((b) => (
              <div key={b.label} className={`py-1.5 px-1 ${b.color}`}>
                <div className="font-bold truncate">{b.label}</div>
                <div className="opacity-85">{b.range}</div>
              </div>
            ))}
          </div>
          {cityPeakAqi > 0 && (
            <div
              className="absolute -top-0.5 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: `${markerLeftPct}%` }}
            >
              <span className="px-1.5 py-0.5 rounded bg-white text-[#090910] font-mono font-black text-[10px] shadow-md">
                ▲ {cityPeakAqi}
              </span>
            </div>
          )}
        </div>
      </div>

      {!report.hasEnoughReliableData && (
        <div
          role="status"
          className="rounded-xl bg-[#271705] border border-amber-500/80 p-4 flex items-start gap-3 text-amber-100"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-bold text-white">Low Data Reliability Warning (“Not Enough Reliable Data”)</p>
            <p className="mt-0.5 text-xs text-amber-200 leading-relaxed">
              Fewer than 2 reliable rows or overall trust score below 35%. Gemini is locked by the Trust
              Layer not to fabricate trends and will explicitly report{' '}
              <span className="font-semibold text-white">"Not enough reliable data"</span>.
            </p>
          </div>
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="rounded-xl border border-zinc-800 bg-[#090910] p-3.5">
          <div className="text-[11px] uppercase text-zinc-400">Total Rows</div>
          <div className="text-2xl font-black text-white mt-1">{report.totalRows}</div>
        </div>
        <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/30 p-3.5">
          <div className="text-[11px] uppercase text-emerald-300">Reliable Rows</div>
          <div className="text-2xl font-black text-emerald-200 mt-1">{report.reliableRows}</div>
        </div>
        <div className="rounded-xl border border-amber-800/70 bg-amber-950/30 p-3.5">
          <div className="text-[11px] uppercase text-amber-300">Missing Gaps</div>
          <div className="text-2xl font-black text-amber-200 mt-1">{report.missingReadingsCount}</div>
        </div>
        <div className="rounded-xl border border-rose-700/80 bg-rose-950/40 p-3.5">
          <div className="text-[11px] uppercase text-rose-300">Impossible Values</div>
          <div className="text-2xl font-black text-rose-200 mt-1">{report.impossibleValuesCount}</div>
        </div>
        <div className="rounded-xl border border-fuchsia-800/70 bg-fuchsia-950/30 p-3.5">
          <div className="text-[11px] uppercase text-fuchsia-300">Sudden Spikes</div>
          <div className="text-2xl font-black text-fuchsia-200 mt-1">{report.spikesDetectedCount}</div>
        </div>
        <div className="rounded-xl border border-sky-800/70 bg-sky-950/30 p-3.5">
          <div className="text-[11px] uppercase text-sky-300">Unit Conv / Conflict</div>
          <div className="text-2xl font-black text-sky-200 mt-1">
            {report.unitConversionsCount} / {report.unitConflictsCount}
          </div>
        </div>
      </div>

      {/* Station / Ward Reliability Breakdown */}
      <div>
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-rose-300 mb-2.5">
          Station &amp; Ward Atmospheric Reliability Scorecard
        </h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#090910]">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <caption className="sr-only">
              Station and ward reliability scorecard with average AQI, peak AQI, CPCB hazard band and trust score
            </caption>
            <thead>
              <tr className="bg-zinc-900/90 text-zinc-200 border-b border-zinc-800 font-mono text-xs uppercase">
                <th scope="col" className="py-3 px-3 font-bold">Ward</th>
                <th scope="col" className="py-3 px-3 font-bold">Station / Node</th>
                <th scope="col" className="py-3 px-3 font-bold">Reliable</th>
                <th scope="col" className="py-3 px-3 font-bold">Avg AQI</th>
                <th scope="col" className="py-3 px-3 font-bold">Peak AQI</th>
                <th scope="col" className="py-3 px-3 font-bold">CPCB Hazard Band</th>
                <th scope="col" className="py-3 px-3 font-bold">Flags (Gap/Imp/Spk/Unit)</th>
                <th scope="col" className="py-3 px-3 font-bold">Trust Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {report.stationSummaries.map((st) => (
                <tr key={`${st.ward}-${st.station}`} className="hover:bg-zinc-900/60">
                  <td className="py-2.5 px-3 font-bold text-white">{st.ward}</td>
                  <td className="py-2.5 px-3 text-zinc-300">{st.station}</td>
                  <td className="py-2.5 px-3 font-mono text-zinc-200">{st.reliableRows}/{st.totalRows}</td>
                  <td className="py-2.5 px-3 font-mono font-black text-rose-300">{st.averageAqi ?? 'N/A'}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-white">{st.peakAqi ?? 'N/A'}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${getAqiBadgeStyle(st.dominantCategory)}`}>
                      {st.dominantCategory}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-zinc-300">
                    {st.missingCount} / {st.impossibleCount} / {st.spikeCount} / {st.unitConversions + st.unitConflicts}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-zinc-800 overflow-hidden" aria-hidden="true">
                        <div
                          className={`h-full ${st.reliabilityScore >= 75 ? 'bg-emerald-500' : st.reliabilityScore >= 50 ? 'bg-amber-500' : 'bg-rose-600'}`}
                          style={{ width: `${st.reliabilityScore}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-xs text-white">{st.reliabilityScore}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <NormalizedRowLedger rows={report.rows} highlightedRowId={highlightedRowId} />
    </section>
  );
});
