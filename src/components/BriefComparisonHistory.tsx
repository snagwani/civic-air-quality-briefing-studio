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
 * Wrapped in React.memo to prevent unnecessary re-renders while users edit input text.
 */
export const BriefComparisonHistory: React.FC<BriefComparisonHistoryProps> = memo(
  ({ savedBriefs, comparisonDiff, onClearHistory }) => {
    return (
      <div className="pt-4 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-700" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">
              What Changed vs. Previous Brief (Server + localStorage Sync)
            </h3>
          </div>

          {savedBriefs.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-red-700 px-2.5 py-1 rounded border border-slate-300 hover:border-red-300 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              Clear Saved History ({savedBriefs.length})
            </button>
          )}
        </div>

        {!comparisonDiff ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 flex items-center gap-3 text-xs sm:text-sm text-slate-700">
            <History className="w-5 h-5 text-slate-500 shrink-0" aria-hidden="true" />
            <div>
              {savedBriefs.length === 0 ? (
                <span>
                  No briefs saved yet. Generate your first brief above to establish a baseline
                  (persisted to <code className="font-mono">/api/records</code> and{' '}
                  <code className="font-mono">localStorage</code>).
                </span>
              ) : (
                <span>
                  Baseline brief <strong>“{savedBriefs[0].label}”</strong> is synced. Edit the
                  sensor table or upload a second shift CSV and generate another brief to see exact
                  AQI deltas, ward category shifts, and new/resolved hotspots.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span>
                Comparing Current Brief:{' '}
                <strong className="text-slate-900">{comparisonDiff.currentLabel}</strong> vs.
                Previous Brief:{' '}
                <strong className="text-slate-900">{comparisonDiff.previousLabel}</strong>
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                {new Date(comparisonDiff.previousCreatedAt).toLocaleTimeString()} →{' '}
                {new Date(comparisonDiff.currentCreatedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-white border border-slate-200 p-3">
                <div className="text-xs text-slate-600 font-medium">Average CPCB AQI Shift</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                  {comparisonDiff.avgAqiDelta === null ? (
                    'N/A'
                  ) : comparisonDiff.avgAqiDelta > 0 ? (
                    <span className="text-red-800 inline-flex items-center gap-1">
                      <ArrowUpRight className="w-4 h-4" aria-hidden="true" />+
                      {comparisonDiff.avgAqiDelta} AQI (Worsened)
                    </span>
                  ) : comparisonDiff.avgAqiDelta < 0 ? (
                    <span className="text-emerald-800 inline-flex items-center gap-1">
                      <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                      {comparisonDiff.avgAqiDelta} AQI (Improved)
                    </span>
                  ) : (
                    <span className="text-slate-700 inline-flex items-center gap-1">
                      <Minus className="w-4 h-4" aria-hidden="true" />0 AQI (Unchanged)
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-white border border-slate-200 p-3">
                <div className="text-xs text-slate-600 font-medium">Peak Hotspot AQI Shift</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">
                  {comparisonDiff.peakAqiDelta === null
                    ? 'N/A'
                    : `${comparisonDiff.peakAqiDelta > 0 ? '+' : ''}${comparisonDiff.peakAqiDelta} AQI`}
                </div>
              </div>

              <div className="rounded-lg bg-white border border-slate-200 p-3">
                <div className="text-xs text-slate-600 font-medium">Dataset Trust Score Delta</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">
                  {comparisonDiff.reliabilityDelta > 0 ? '+' : ''}
                  {comparisonDiff.reliabilityDelta}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-white border border-slate-200 p-3">
                <strong className="font-bold text-slate-900 block mb-1">
                  New Hotspots Escalated:
                </strong>
                {comparisonDiff.newHotspots.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5 text-red-900 font-medium">
                    {comparisonDiff.newHotspots.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-600">No new hotspot locations escalated.</span>
                )}
              </div>

              <div className="rounded-lg bg-white border border-slate-200 p-3">
                <strong className="font-bold text-slate-900 block mb-1">
                  Resolved / De-escalated Hotspots:
                </strong>
                {comparisonDiff.resolvedHotspots.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-0.5 text-emerald-900 font-medium">
                    {comparisonDiff.resolvedHotspots.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-600">No previous hotspots resolved yet.</span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-200">
                    <th scope="col" className="py-2 px-3 font-semibold">Ward</th>
                    <th scope="col" className="py-2 px-3 font-semibold">Previous Avg AQI</th>
                    <th scope="col" className="py-2 px-3 font-semibold">Current Avg AQI</th>
                    <th scope="col" className="py-2 px-3 font-semibold">Net Change</th>
                    <th scope="col" className="py-2 px-3 font-semibold">Category Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {comparisonDiff.wardChanges.map((wc) => (
                    <tr key={wc.ward}>
                      <td className="py-2 px-3 font-semibold text-slate-900">{wc.ward}</td>
                      <td className="py-2 px-3 font-mono">{wc.previousAqi ?? 'N/A'}</td>
                      <td className="py-2 px-3 font-mono font-bold">{wc.currentAqi ?? 'N/A'}</td>
                      <td className="py-2 px-3 font-mono font-semibold">
                        {wc.delta === null ? (
                          '—'
                        ) : wc.delta > 0 ? (
                          <span className="text-red-800">+{wc.delta}</span>
                        ) : wc.delta < 0 ? (
                          <span className="text-emerald-800">{wc.delta}</span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {wc.previousCategory} → <strong>{wc.currentCategory}</strong>
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
