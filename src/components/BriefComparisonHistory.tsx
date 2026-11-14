import React, { memo } from 'react';
import {
  GitCompare,
  History,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import type { BriefComparisonDiff, SavedBriefRecord } from '../types/airQuality';

interface BriefComparisonHistoryProps {
  savedBriefs: SavedBriefRecord[];
  comparisonDiff: BriefComparisonDiff | null;
  onClearHistory: () => void;
}

/**
 * Displays longitudinal brief-to-brief comparison diffs (Average AQI delta, Peak AQI delta,
 * Dataset Trust Score delta, new/resolved hotspots, and ward-by-ward category transitions).
 */
export const BriefComparisonHistory: React.FC<BriefComparisonHistoryProps> = memo(
  ({ savedBriefs, comparisonDiff, onClearHistory }) => {
    return (
      <div className="pt-4 border-t border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-rose-500" aria-hidden="true" />
            <h3 className="text-base font-bold text-white">
              What Changed vs. Previous Brief (Server + localStorage Sync)
            </h3>
          </div>

          {savedBriefs.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-zinc-300 hover:text-rose-300 px-2.5 py-1 rounded border border-zinc-700 hover:border-rose-600 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Clear Saved History ({savedBriefs.length})
            </button>
          )}
        </div>

        {!comparisonDiff ? (
          <div className="rounded-xl bg-[#090910] border border-zinc-800 p-4 flex items-center gap-3 text-xs sm:text-sm text-zinc-300">
            <History className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />
            <div>
              {savedBriefs.length === 0 ? (
                <span>
                  No briefs saved yet. Generate your first brief above to establish a baseline
                  (persisted to <code className="font-mono text-rose-300">/api/records</code> and{' '}
                  <code className="font-mono text-rose-300">localStorage</code>).
                </span>
              ) : (
                <span>
                  Baseline brief <strong className="text-white">“{savedBriefs[0].label}”</strong> is
                  synced. Click <strong className="text-amber-300">2. Follow-Up Shift (Diff Test)</strong>{' '}
                  in Step 1, run audit + analysis, and generate a second brief to see exact ward AQI
                  deltas.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-rose-900/70 bg-[#090910] p-4 space-y-4 shadow-[0_0_25px_rgba(225,29,72,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
              <span>
                Comparing Current Brief:{' '}
                <strong className="text-white">{comparisonDiff.currentLabel}</strong> vs. Previous
                Brief: <strong className="text-rose-300">{comparisonDiff.previousLabel}</strong>
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                {new Date(comparisonDiff.previousCreatedAt).toLocaleTimeString()} →{' '}
                {new Date(comparisonDiff.currentCreatedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              <div className="rounded-lg bg-[#101018] border border-zinc-800 p-3">
                <div className="text-xs text-zinc-400">Average CPCB AQI Shift</div>
                <div className="text-lg font-bold text-white mt-0.5 flex items-center gap-1">
                  {comparisonDiff.avgAqiDelta === null ? (
                    'N/A'
                  ) : comparisonDiff.avgAqiDelta > 0 ? (
                    <span className="text-rose-400 inline-flex items-center gap-1">
                      <ArrowUpRight className="w-4 h-4" aria-hidden="true" />+
                      {comparisonDiff.avgAqiDelta} AQI (Worsened)
                    </span>
                  ) : comparisonDiff.avgAqiDelta < 0 ? (
                    <span className="text-emerald-400 inline-flex items-center gap-1">
                      <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                      {comparisonDiff.avgAqiDelta} AQI (Improved)
                    </span>
                  ) : (
                    <span className="text-zinc-300 inline-flex items-center gap-1">
                      <Minus className="w-4 h-4" aria-hidden="true" />0 AQI (Unchanged)
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-[#101018] border border-zinc-800 p-3">
                <div className="text-xs text-zinc-400">Peak Hotspot AQI Shift</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {comparisonDiff.peakAqiDelta === null
                    ? 'N/A'
                    : `${comparisonDiff.peakAqiDelta > 0 ? '+' : ''}${comparisonDiff.peakAqiDelta} AQI`}
                </div>
              </div>

              <div className="rounded-lg bg-[#101018] border border-zinc-800 p-3">
                <div className="text-xs text-zinc-400">Dataset Trust Score Delta</div>
                <div className="text-lg font-bold text-white mt-0.5">
                  {comparisonDiff.reliabilityDelta > 0 ? '+' : ''}
                  {comparisonDiff.reliabilityDelta}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-[#101018] border border-zinc-800 p-3">
                <strong className="font-bold text-rose-300 block mb-1 font-mono uppercase">
                  New Hotspots Escalated:
                </strong>
                {comparisonDiff.newHotspots.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5 text-rose-200 font-medium">
                    {comparisonDiff.newHotspots.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-zinc-400">No new hotspot locations escalated.</span>
                )}
              </div>

              <div className="rounded-lg bg-[#101018] border border-zinc-800 p-3">
                <strong className="font-bold text-emerald-300 block mb-1 font-mono uppercase">
                  Resolved / De-escalated Hotspots:
                </strong>
                {comparisonDiff.resolvedHotspots.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5 text-emerald-200 font-medium">
                    {comparisonDiff.resolvedHotspots.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-zinc-400">No previous hotspots resolved yet.</span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-[#101018]">
              <table className="w-full text-left border-collapse text-xs">
                <caption className="sr-only">
                  Ward-by-ward average AQI change between the previous and current brief
                </caption>
                <thead>
                  <tr className="bg-zinc-900 text-zinc-200 border-b border-zinc-800 font-mono uppercase">
                    <th scope="col" className="py-2.5 px-3 font-bold">Ward</th>
                    <th scope="col" className="py-2.5 px-3 font-bold">Previous Avg AQI</th>
                    <th scope="col" className="py-2.5 px-3 font-bold">Current Avg AQI</th>
                    <th scope="col" className="py-2.5 px-3 font-bold">Net Change</th>
                    <th scope="col" className="py-2.5 px-3 font-bold">Category Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {comparisonDiff.wardChanges.map((wc) => (
                    <tr key={wc.ward} className="hover:bg-zinc-900/50">
                      <td className="py-2 px-3 font-bold text-white">{wc.ward}</td>
                      <td className="py-2 px-3 font-mono text-zinc-300">
                        {wc.previousAqi ?? 'N/A'}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-white">
                        {wc.currentAqi ?? 'N/A'}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold">
                        {wc.delta === null ? (
                          '—'
                        ) : wc.delta > 0 ? (
                          <span className="text-rose-400">+{wc.delta} AQI</span>
                        ) : wc.delta < 0 ? (
                          <span className="text-emerald-400">{wc.delta} AQI</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-2 px-3 text-zinc-200">
                        {wc.previousCategory} →{' '}
                        <strong className="text-rose-300">{wc.currentCategory}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }
);
