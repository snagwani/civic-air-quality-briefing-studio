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
 * with clickable row-level citation badges.
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
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Cited Rows:
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
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-teal-50 text-teal-900 border border-teal-300 hover:bg-teal-200 cursor-pointer"
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
        ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
        : conf === 'Medium'
        ? 'bg-amber-100 text-amber-950 border-amber-300'
        : conf === 'Low'
        ? 'bg-orange-100 text-orange-950 border-orange-300'
        : 'bg-red-100 text-red-950 border-red-300';
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${style}`}>
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
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
            Step 2 · Live Gemini API + Zod Schema Validation
          </span>
          <h2
            id="gemini-analysis-heading"
            className="text-lg sm:text-xl font-bold text-slate-900 mt-1.5"
          >
            Traceable Trends, Hotspots &amp; Role-Based Interventions
          </h2>
          <p className="text-sm text-slate-600">
            Sends cleaned rows ({report.reliableRows} reliable of {report.totalRows}) to Gemini.
            Every claim is validated with Zod and linked to exact row IDs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRunAnalysis}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-sm shadow-xs disabled:opacity-50 cursor-pointer"
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
          className="rounded-lg bg-red-50 border border-red-300 p-4 flex items-start gap-3 text-red-950"
        >
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-bold">Live Gemini Analysis Error</p>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
        </div>
      )}

      {!analysis && !isLoading && !error && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            Ready to analyze {report.totalRows} normalized sensor rows across{' '}
            {report.stationSummaries.length} stations.
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Click <strong>Run Live Gemini Analysis</strong> above to invoke{' '}
            <code className="font-mono bg-white px-1 py-0.5 rounded border">/api/gemini</code>.
          </p>
        </div>
      )}

      {analysis && (
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-900">
                <CheckCircle className="w-4 h-4 text-teal-700" aria-hidden="true" />
                Zod-Verified Gemini Synthesis {fromCache ? '(Cached Repeat Call)' : '(Live API)'}
              </span>
            </div>
            <p className="text-sm text-slate-900 leading-relaxed">{analysis.overallAssessment}</p>

            {analysis.insufficientDataNotice && (
              <div className="mt-3 rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-950">
                <strong className="font-bold">Data Honesty Flag: </strong>
                {analysis.insufficientDataNotice}
              </div>
            )}
          </div>

          {/* Trends & Hotspots Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Trends */}
            <div className="space-y-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800">
                <TrendingUp className="w-4 h-4 text-indigo-700" aria-hidden="true" />
                Key Air Quality Trends ({analysis.trends.length})
              </h3>
              {analysis.trends.map((trend) => (
                <article
                  key={trend.id}
                  className="rounded-lg border border-slate-200 p-4 bg-white shadow-2xs space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{trend.title}</h4>
                    {renderConfidenceBadge(trend.confidence)}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {trend.summary}
                  </p>
                  {trend.dataCaveat && (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                      <strong>Caveat:</strong> {trend.dataCaveat}
                    </p>
                  )}
                  {renderCitationBadges(trend.citedRowIds)}
                </article>
              ))}
            </div>

            {/* Hotspots */}
            <div className="space-y-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800">
                <MapPin className="w-4 h-4 text-rose-700" aria-hidden="true" />
                Identified Ward Hotspots ({analysis.hotspots.length})
              </h3>
              {analysis.hotspots.map((spot) => (
                <article
                  key={spot.id}
                  className="rounded-lg border border-slate-200 p-4 bg-white shadow-2xs space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{spot.location}</h4>
                      <span className="text-xs font-medium text-slate-600">
                        Likely Source: {spot.likelyCause}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold border ${
                          spot.severity === 'Critical'
                            ? 'bg-rose-950 text-white border-rose-800'
                            : spot.severity === 'High'
                            ? 'bg-red-100 text-red-900 border-red-300'
                            : spot.severity === 'Moderate'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}
                      >
                        {spot.severity}
                      </span>
                      {renderConfidenceBadge(spot.confidence)}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
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
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        selectedAudience === aud
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
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
                    className="rounded-xl border border-slate-200 p-4 bg-slate-50/60 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-300">
                          <Icon className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                          {act.audience}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-950 border border-indigo-200">
                          {act.priority}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">
                        {act.action}
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed">{act.rationale}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
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
