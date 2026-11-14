import React, { memo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Flame,
} from 'lucide-react';
import type { QualityReport } from '../types/airQuality';
import { getAqiBadgeStyle } from '../lib/cpcbAqi';

interface QualityReportPanelProps {
  report: QualityReport;
  highlightedRowId: string | null;
}

/**
 * Renders the deterministic CPCB Data Quality & Normalization Report,
 * Station Reliability Scorecard, and Normalized Row Ledger with row-ID highlighting.
 */
export const QualityReportPanel: React.FC<QualityReportPanelProps> = memo(({
  report,
  highlightedRowId,
}) => {
  return (
    <section
      aria-labelledby="quality-report-heading"
      aria-live="polite"
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-300">
            Deterministic Audit · India CPCB National AQI
          </span>
          <h2 id="quality-report-heading" className="text-lg sm:text-xl font-bold text-slate-900 mt-1.5">
            Data Quality &amp; Normalization Report
          </h2>
          <p className="text-sm text-slate-600">
            All valid measurements converted to standard <strong className="font-semibold">µg/m³</strong>.
            Impossible readings and unit conflicts are flagged and isolated before AI interpretation.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          {report.hasEnoughReliableData ? (
            <ShieldCheck className="w-8 h-8 text-teal-700 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="w-8 h-8 text-amber-700 shrink-0" aria-hidden="true" />
          )}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Dataset Trust Score
            </div>
            <div className="text-2xl font-extrabold text-slate-900">
              {report.overallReliabilityScore}%
              <span className="ml-2 text-xs font-medium text-slate-600">
                ({report.reliableRows}/{report.totalRows} reliable rows)
              </span>
            </div>
          </div>
        </div>
      </div>

      {!report.hasEnoughReliableData && (
        <div
          role="status"
          className="rounded-lg bg-amber-50 border border-amber-300 p-4 flex items-start gap-3 text-amber-950"
        >
          <AlertTriangle className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-bold">Low Data Reliability Warning (“Not Enough Reliable Data”)</p>
            <p className="mt-0.5 text-xs leading-relaxed">
              Fewer than 2 reliable rows or overall trust score below 35%. Gemini is instructed by the
              Trust Layer not to guess trends and will explicitly report{' '}
              <span className="font-semibold">"Not enough reliable data"</span> where sensor readings
              are missing or physically impossible.
            </p>
          </div>
        </div>
      )}

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="text-xs font-medium text-slate-600">Total Rows</div>
          <div className="text-xl font-bold text-slate-900 mt-0.5">{report.totalRows}</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="text-xs font-medium text-emerald-900">Reliable Rows</div>
          <div className="text-xl font-bold text-emerald-950 mt-0.5">{report.reliableRows}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <div className="text-xs font-medium text-amber-900">Missing Readings</div>
          <div className="text-xl font-bold text-amber-950 mt-0.5">
            {report.missingReadingsCount}
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
          <div className="text-xs font-medium text-red-900">Impossible Values</div>
          <div className="text-xl font-bold text-red-950 mt-0.5">
            {report.impossibleValuesCount}
          </div>
        </div>
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
          <div className="text-xs font-medium text-purple-900">Sudden Spikes</div>
          <div className="text-xl font-bold text-purple-950 mt-0.5">
            {report.spikesDetectedCount}
          </div>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
          <div className="text-xs font-medium text-sky-900">Unit Conversions / Conflicts</div>
          <div className="text-xl font-bold text-sky-950 mt-0.5">
            {report.unitConversionsCount} / {report.unitConflictsCount}
          </div>
        </div>
      </div>

      {/* Station / Ward Reliability Breakdown */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mb-2.5">
          Station &amp; Ward Reliability Scorecard
        </h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                <th scope="col" className="py-2.5 px-3 font-semibold">Ward</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">Station / Location</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">Reliable / Total</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">Avg CPCB AQI</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">Peak AQI</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">CPCB Category</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">Flags (Gap / Imp / Spike / Unit)</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">Reliability Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.stationSummaries.map((st) => (
                <tr key={`${st.ward}-${st.station}`} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{st.ward}</td>
                  <td className="py-2.5 px-3 text-slate-700">{st.station}</td>
                  <td className="py-2.5 px-3 font-mono">
                    {st.reliableRows}/{st.totalRows}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    {st.averageAqi ?? 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-800">
                    {st.peakAqi ?? 'N/A'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold border ${getAqiBadgeStyle(
                        st.dominantCategory
                      )}`}
                    >
                      {st.dominantCategory}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-700">
                    {st.missingCount} / {st.impossibleCount} / {st.spikeCount} /{' '}
                    {st.unitConversions + st.unitConflicts}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-16 h-2 rounded-full bg-slate-200 overflow-hidden"
                        aria-hidden="true"
                      >
                        <div
                          className={`h-full ${
                            st.reliabilityScore >= 75
                              ? 'bg-teal-700'
                              : st.reliabilityScore >= 50
                              ? 'bg-amber-600'
                              : 'bg-red-600'
                          }`}
                          style={{ width: `${st.reliabilityScore}%` }}
                        />
                      </div>
                      <span className="font-mono font-semibold text-xs text-slate-900">
                        {st.reliabilityScore}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Normalized Row-by-Row Traceability Table */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">
            Normalized Row Ledger (Traceable Citation IDs)
          </h3>
          <span className="text-xs text-slate-600">
            Click any <code className="font-mono bg-slate-100 px-1 rounded">R##</code> badge in the AI
            findings below to highlight the underlying sensor row here.
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-800 border-b border-slate-200 z-10">
              <tr>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">Row ID</th>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">Ward &amp; Station</th>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">Normalized Timestamp</th>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">PM2.5 (µg/m³)</th>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">PM10 (µg/m³)</th>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">NO₂ (µg/m³)</th>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">SO₂ (µg/m³)</th>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">CPCB AQI</th>
                <th scope="col" className="py-2.5 px-2.5 font-semibold">Trust Audit &amp; Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.rows.map((row) => {
                const isHighlighted = highlightedRowId === row.rowId;
                return (
                  <tr
                    key={row.rowId}
                    id={`ledger-row-${row.rowId}`}
                    className={`transition-colors ${
                      isHighlighted
                        ? 'bg-teal-100/90 ring-2 ring-inset ring-teal-700'
                        : !row.isReliable
                        ? 'bg-red-50/40'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-2 px-2.5 font-mono font-bold text-teal-900 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-teal-50 border border-teal-300">
                        {row.rowId}
                      </span>
                    </td>
                    <td className="py-2 px-2.5">
                      <div className="font-semibold text-slate-900">{row.ward}</div>
                      <div className="text-slate-600">{row.rawStation}</div>
                    </td>
                    <td className="py-2 px-2.5 font-mono text-slate-800 whitespace-nowrap">
                      {row.normalizedTimestamp ?? (
                        <span className="text-amber-800 font-sans italic">
                          Invalid ({row.rawTimestamp || 'empty'})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 font-mono">
                      {row.pm25UgM3 !== null ? row.pm25UgM3 : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-2.5 font-mono">
                      {row.pm10UgM3 !== null ? row.pm10UgM3 : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-2.5 font-mono">
                      {row.no2UgM3 !== null ? row.no2UgM3 : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-2.5 font-mono">
                      {row.so2UgM3 !== null ? row.so2UgM3 : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      {row.aqi !== null ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-semibold border ${getAqiBadgeStyle(
                            row.aqiCategory
                          )}`}
                        >
                          {row.aqi} · {row.aqiCategory}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-300 font-medium">
                          Excluded (Unreliable)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5">
                      {row.issues.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Verified Clean
                        </span>
                      ) : (
                        <ul className="space-y-1">
                          {row.issues.map((iss, idx) => (
                            <li
                              key={`${row.rowId}-iss-${idx}`}
                              className={`inline-flex items-center gap-1 mr-1.5 px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                                iss.severity === 'error'
                                  ? 'bg-red-100 text-red-950 border-red-300'
                                  : iss.type === 'SPIKE_DETECTED'
                                  ? 'bg-purple-100 text-purple-950 border-purple-300'
                                  : iss.type === 'UNIT_CONVERTED'
                                  ? 'bg-sky-100 text-sky-950 border-sky-300'
                                  : 'bg-amber-100 text-amber-950 border-amber-300'
                              }`}
                            >
                              {iss.type === 'UNIT_CONVERTED' && (
                                <ArrowRightLeft className="w-3 h-3 shrink-0" aria-hidden="true" />
                              )}
                              {iss.type === 'SPIKE_DETECTED' && (
                                <Flame className="w-3 h-3 shrink-0" aria-hidden="true" />
                              )}
                              {iss.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
});
