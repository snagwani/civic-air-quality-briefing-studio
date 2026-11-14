import React, { memo } from 'react';
import { CheckCircle2, ArrowRightLeft, Flame } from 'lucide-react';
import type { CleanedRow } from '../types/airQuality';
import { getAqiBadgeStyle } from '../lib/cpcbAqi';

interface NormalizedRowLedgerProps {
  rows: CleanedRow[];
  highlightedRowId: string | null;
}

/**
 * Renders the Normalized Row Telemetry Ledger table with traceable [R##] citation IDs
 * and crimson row illumination when a citation badge is selected.
 *
 * @param props - Cleaned sensor rows and currently highlighted row ID
 * @returns Memoized ledger table component
 */
export const NormalizedRowLedger: React.FC<NormalizedRowLedgerProps> = memo(
  ({ rows, highlightedRowId }) => {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-rose-300">
            Normalized Row Telemetry Ledger (Traceable [R##] Citation IDs)
          </h3>
          <span className="text-xs text-zinc-300">
            Click any{' '}
            <code className="font-mono text-rose-300 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-700">
              [R##]
            </code>{' '}
            badge below to illuminate the row.
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#090910] max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-zinc-900 text-zinc-200 border-b border-zinc-800 z-10 font-mono uppercase">
              <tr>
                <th scope="col" className="py-2.5 px-2.5 font-bold">Row ID</th>
                <th scope="col" className="py-2.5 px-2.5 font-bold">Ward &amp; Station</th>
                <th scope="col" className="py-2.5 px-2.5 font-bold">Timestamp</th>
                <th scope="col" className="py-2.5 px-2.5 font-bold">PM2.5 (µg/m³)</th>
                <th scope="col" className="py-2.5 px-2.5 font-bold">PM10 (µg/m³)</th>
                <th scope="col" className="py-2.5 px-2.5 font-bold">NO₂ (µg/m³)</th>
                <th scope="col" className="py-2.5 px-2.5 font-bold">SO₂ (µg/m³)</th>
                <th scope="col" className="py-2.5 px-2.5 font-bold">CPCB AQI</th>
                <th scope="col" className="py-2.5 px-2.5 font-bold">Telemetry Audit &amp; Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.map((row) => {
                const isHighlighted = highlightedRowId === row.rowId;
                return (
                  <tr
                    key={row.rowId}
                    id={`ledger-row-${row.rowId}`}
                    className={`transition-all ${
                      isHighlighted
                        ? 'bg-rose-950/90 ring-2 ring-inset ring-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.4)]'
                        : !row.isReliable
                        ? 'bg-red-950/25'
                        : 'hover:bg-zinc-900/60'
                    }`}
                  >
                    <td className="py-2 px-2.5 font-mono font-bold whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-rose-950 text-rose-200 border border-rose-600/70">
                        {row.rowId}
                      </span>
                    </td>
                    <td className="py-2 px-2.5">
                      <div className="font-bold text-white">{row.ward}</div>
                      <div className="text-zinc-400">{row.rawStation}</div>
                    </td>
                    <td className="py-2 px-2.5 font-mono text-zinc-200 whitespace-nowrap">
                      {row.normalizedTimestamp ?? (
                        <span className="text-amber-300 font-sans italic">
                          Invalid ({row.rawTimestamp || 'empty'})
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5 font-mono text-zinc-100">
                      {row.pm25UgM3 ?? <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-2 px-2.5 font-mono text-zinc-100">
                      {row.pm10UgM3 ?? <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-2 px-2.5 font-mono text-zinc-100">
                      {row.no2UgM3 ?? <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-2 px-2.5 font-mono text-zinc-100">
                      {row.so2UgM3 ?? <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="py-2 px-2.5 whitespace-nowrap font-mono">
                      {row.aqi !== null ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-bold border ${getAqiBadgeStyle(
                            row.aqiCategory
                          )}`}
                        >
                          {row.aqi} · {row.aqiCategory}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded bg-rose-950/90 text-rose-200 border border-rose-600 font-semibold">
                          Excluded (Corrupt)
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2.5">
                      {row.issues.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300 font-mono font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Verified Clean
                        </span>
                      ) : (
                        <ul className="space-y-1">
                          {row.issues.map((iss, idx) => (
                            <li
                              key={`${row.rowId}-iss-${idx}`}
                              className={`inline-flex items-center gap-1 mr-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                                iss.severity === 'error'
                                  ? 'bg-rose-950 text-rose-200 border-rose-600/80'
                                  : iss.type === 'SPIKE_DETECTED'
                                  ? 'bg-fuchsia-950 text-fuchsia-200 border-fuchsia-600/80'
                                  : iss.type === 'UNIT_CONVERTED'
                                  ? 'bg-sky-950 text-sky-200 border-sky-600/80'
                                  : 'bg-amber-950 text-amber-200 border-amber-600/80'
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
    );
  }
);
