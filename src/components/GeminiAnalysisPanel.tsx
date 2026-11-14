import React, { memo, useMemo, useState } from 'react';
import {
  Cpu,
  AlertCircle,
  TrendingUp,
  MapPin,
  Building2,
  GraduationCap,
  Shield,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import type { GeminiAnalysisResponse, QualityReport } from '../types/airQuality';

interface GeminiAnalysisPanelProps {
  report: QualityReport;
  analysis: GeminiAnalysisResponse | null;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
  onRunAnalysis: () => void;
  onSelectRowId: (rowId: string) => void;
}

/**
 * Renders Zod-validated Gemini analysis findings (trends, hotspots, and stakeholder actions)
 * with clickable row-level citation badges in Atmospheric Crimson Dark Mode.
 */
export const GeminiAnalysisPanel: React.FC<GeminiAnalysisPanelProps> = memo(({
  report,
  analysis,
  isLoading,
  error,
  fromCache,
  onRunAnalysis,
  onSelectRowId,
}) => {
  const [selectedAudience, setSelectedAudience] = useState<
    'All' | 'Ward Officer' | 'Housing Society' | 'School Principal'
  >('All');

  const renderCitationBadges = (rowIds: string[]) => (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
        Cited Telemetry:
      </span>
      {rowIds.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            onSelectRowId(id);
            const el = document.getElementById(`ledger-row-${id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-950 text-rose-200 border border-rose-600/80 hover:bg-rose-700 hover:text-white cursor-pointer transition-colors"
          title={`Jump to row ${id} in Normalized Row Ledger`}
        >
          [{id}]
        </button>
      ))}
    </div>
  );

  const renderConfidenceBadge = (conf: string) => {
    const style =
      conf === 'High'
        ? 'bg-emerald-950/90 text-emerald-200 border-emerald-600/70'
        : conf === 'Medium'
        ? 'bg-amber-950/90 text-amber-200 border-amber-600/70'
        : conf === 'Low'
        ? 'bg-orange-950/90 text-orange-200 border-orange-600/70'
        : 'bg-rose-950 text-rose-200 border-rose-500';
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${style}`}>
        Confidence: {conf}
      </span>
    );
  };

  const filteredActions = useMemo(
    () =>
      analysis?.actions.filter(
        (a) => selectedAudience === 'All' || a.audience === selectedAudience
      ) ?? [],
    [analysis, selectedAudience]
  );

  return (
    <section
      aria-labelledby="gemini-analysis-heading"
      aria-live="polite"
      aria-busy={isLoading}
      className="bg-[#101018]/95 rounded-2xl border border-zinc-800/90 border-t-2 border-t-rose-600 shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-rose-300 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-700/70">
            Step 02 · Live Gemini API + Strict Zod Schema Gate
          </span>
          <h2
            id="gemini-analysis-heading"
            className="text-lg sm:text-xl font-black text-white mt-2"
          >
            Traceable Trends, Smog Hotspots &amp; Stakeholder Interventions
          </h2>
          <p className="text-sm text-zinc-300">
            Analyzes {report.reliableRows} verified sensor rows (of {report.totalRows} total) via
            live Gemini API. Every finding is bound to clickable <code className="font-mono text-rose-300">[R##]</code> citations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-sm shadow-[0_0_24px_rgba(225,29,72,0.5)] border border-rose-400/40 disabled:opacity-50 cursor-pointer transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Running Live Gemini Analysis…
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" aria-hidden="true" />
                {analysis ? 'Re-Run Gemini Analysis' : 'Run Live Gemini Analysis'}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl bg-[#2a0610] border border-rose-500 p-4 flex items-start gap-3 text-rose-100 shadow-[0_0_20px_rgba(225,29,72,0.25)]"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-bold text-white">Live Gemini Analysis Error</p>
            <p className="mt-0.5 text-xs text-rose-200">{error}</p>
          </div>
        </div>
      )}

      {!analysis && !isLoading && !error && (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-[#090910] p-6 text-center">
          <p className="text-sm font-semibold text-zinc-200">
            Ready to synthesize {report.totalRows} normalized telemetry rows across{' '}
            {report.stationSummaries.length} municipal stations.
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Click <strong className="text-rose-300">Run Live Gemini Analysis</strong> above to invoke{' '}
            <code className="font-mono bg-zinc-900 text-rose-300 px-1.5 py-0.5 rounded border border-zinc-700">/api/gemini</code>.
          </p>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="rounded-xl bg-[#090910] border border-rose-900/70 p-4 shadow-[0_0_25px_rgba(225,29,72,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
                <CheckCircle className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                Zod-Verified Gemini Synthesis {fromCache ? '(LRU Cache Hit)' : '(Live Gemini API)'}
              </span>
            </div>
            <p className="text-sm text-zinc-100 leading-relaxed">{analysis.overallAssessment}</p>

            {analysis.insufficientDataNotice && (
              <div className="mt-3 rounded-lg bg-[#271705] border border-amber-500/80 p-3 text-xs text-amber-200">
                <strong className="font-bold text-white">Data Honesty Flag: </strong>
                {analysis.insufficientDataNotice}
              </div>
            )}
          </div>

          {/* Trends & Hotspots Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h3 className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-rose-300">
                <TrendingUp className="w-4 h-4 text-rose-500" aria-hidden="true" />
                Key Atmospheric Trends ({analysis.trends.length})
              </h3>
              {analysis.trends.map((trend) => (
                <article
                  key={trend.id}
                  className="rounded-xl border border-zinc-800 p-4 bg-[#090910] space-y-2.5 hover:border-rose-800/70 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-bold text-white text-sm">{trend.title}</h4>
                    {renderConfidenceBadge(trend.confidence)}
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    {trend.summary}
                  </p>
                  {trend.dataCaveat && (
                    <p className="text-xs text-amber-200 bg-[#271705] border border-amber-700/70 rounded-lg px-2.5 py-1.5">
                      <strong className="text-amber-300">Telemetry Caveat:</strong> {trend.dataCaveat}
                    </p>
                  )}
                  {renderCitationBadges(trend.citedRowIds)}
                </article>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-rose-300">
                <MapPin className="w-4 h-4 text-rose-500" aria-hidden="true" />
                Identified Ward Smog Hotspots ({analysis.hotspots.length})
              </h3>
              {analysis.hotspots.map((spot) => (
                <article
                  key={spot.id}
                  className="rounded-xl border border-rose-950/90 p-4 bg-[#090910] space-y-2.5 shadow-[0_0_20px_rgba(225,29,72,0.08)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white text-sm">{spot.location}</h4>
                      <span className="text-xs font-mono text-rose-300">
                        Emission Vector: {spot.likelyCause}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${
                          spot.severity === 'Critical'
                            ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_12px_rgba(225,29,72,0.5)]'
                            : spot.severity === 'High'
                            ? 'bg-red-950 text-red-200 border-red-500/80'
                            : spot.severity === 'Moderate'
                            ? 'bg-amber-950 text-amber-200 border-amber-500/80'
                            : 'bg-zinc-900 text-zinc-200 border-zinc-700'
                        }`}
                      >
                        {spot.severity}
                      </span>
                      {renderConfidenceBadge(spot.confidence)}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    {spot.explanation}
                  </p>
                  {renderCitationBadges(spot.citedRowIds)}
                </article>
              ))}
            </div>
          </div>

          {/* Prioritized Local Actions by Audience */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-rose-300">
                Prioritized Local Interventions by Stakeholder Role
              </h3>
              <div
                role="group"
                aria-label="Filter actions by stakeholder audience"
                className="flex flex-wrap gap-1.5"
              >
                {(['All', 'Ward Officer', 'Housing Society', 'School Principal'] as const).map(
                  (aud) => (
                    <button
                      key={aud}
                      type="button"
                      onClick={() => setSelectedAudience(aud)}
                      aria-pressed={selectedAudience === aud}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                        selectedAudience === aud
                          ? 'bg-rose-700 text-white border-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.4)]'
                          : 'bg-[#090910] text-zinc-300 border-zinc-700 hover:border-rose-700'
                      }`}
                    >
                      {aud}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredActions.map((act) => {
                const Icon =
                  act.audience === 'Ward Officer'
                    ? Shield
                    : act.audience === 'Housing Society'
                    ? Building2
                    : GraduationCap;

                return (
                  <article
                    key={act.id}
                    className="rounded-xl border border-zinc-800 p-4 bg-[#090910] flex flex-col justify-between space-y-3 hover:border-rose-800/80 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-white bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-700">
                          <Icon className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                          {act.audience}
                        </span>
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-950/90 text-rose-200 border border-rose-700/80">
                          {act.priority}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm leading-snug">
                        {act.action}
                      </h4>
                      <p className="text-xs text-zinc-300 leading-relaxed">{act.rationale}</p>
                    </div>
                    <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                      {renderConfidenceBadge(act.confidence)}
                      {renderCitationBadges(act.citedRowIds)}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
