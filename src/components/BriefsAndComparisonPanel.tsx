import React from 'react';
import {
  FileText,
  Megaphone,
  Baby,
  HeartPulse,
  UserCheck,
  GitCompare,
  Loader2,
  AlertCircle,
  History,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import type {
  BriefComparisonDiff,
  GeminiBriefResponse,
  ReadingLevel,
  SavedBriefRecord,
  SupportedLanguage,
} from '../types/airQuality';

interface BriefsAndComparisonPanelProps {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  readingLevel: ReadingLevel;
  onReadingLevelChange: (level: ReadingLevel) => void;
  brief: GeminiBriefResponse | null;
  isLoading: boolean;
  error: string | null;
  fromCache: boolean;
  canGenerate: boolean;
  onGenerateBrief: () => void;
  savedBriefs: SavedBriefRecord[];
  comparisonDiff: BriefComparisonDiff | null;
  onClearHistory: () => void;
  onSelectRowId: (rowId: string) => void;
}

export const BriefsAndComparisonPanel: React.FC<BriefsAndComparisonPanelProps> = ({
  language,
  onLanguageChange,
  readingLevel,
  onReadingLevelChange,
  brief,
  isLoading,
  error,
  fromCache,
  canGenerate,
  onGenerateBrief,
  savedBriefs,
  comparisonDiff,
  onClearHistory,
  onSelectRowId,
}) => {
  const renderCitations = (ids: string[]) => (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-200/70">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Traceable Data Rows:
      </span>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            onSelectRowId(id);
            const el = document.getElementById(`ledger-row-${id}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-teal-50 text-teal-900 border border-teal-300 hover:bg-teal-200 cursor-pointer"
        >
          [{id}]
        </button>
      ))}
    </div>
  );

  return (
    <section
      aria-labelledby="briefs-panel-heading"
      aria-live="polite"
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Step 3 · Multilingual Briefs &amp; Longitudinal Change Tracking
          </span>
          <h2 id="briefs-panel-heading" className="text-lg sm:text-xl font-bold text-slate-900 mt-1.5">
            Internal Briefing Note, Citizen Advisory &amp; Brief-to-Brief Diff
          </h2>
          <p className="text-sm text-slate-600">
            Generates official communications in English, Hindi, or Marathi at Simple or Detailed
            reading levels, with dedicated protection for children, older adults, and sensitive groups.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="brief-language-select"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1"
            >
              Language
            </label>
            <select
              id="brief-language-select"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
              disabled={isLoading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-teal-700"
            >
              <option value="English">English (Civic Standard)</option>
              <option value="Hindi">हिन्दी (Hindi)</option>
              <option value="Marathi">मराठी (Marathi)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="brief-reading-level-select"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1"
            >
              Reading Level
            </label>
            <select
              id="brief-reading-level-select"
              value={readingLevel}
              onChange={(e) => onReadingLevelChange(e.target.value as ReadingLevel)}
              disabled={isLoading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-teal-700"
            >
              <option value="Simple">Simple (Everyday Public Clarity)</option>
              <option value="Detailed">Detailed (Technical &amp; CPCB SOP)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onGenerateBrief}
            disabled={!canGenerate || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Generating {language} Brief…
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" aria-hidden="true" />
                Generate {language} ({readingLevel}) Brief
              </>
            )}
          </button>
        </div>
      </div>

      {!canGenerate && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600">
          Complete <strong>Step 2 (Live Gemini Analysis)</strong> first so the briefing note and
          citizen advisory can synthesize verified hotspots and role-based actions.
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg bg-red-50 border border-red-300 p-4 flex items-start gap-3 text-red-950"
        >
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-bold">Brief Generation Failed</p>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
        </div>
      )}

      {brief && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200">
            <span>
              Active Brief Language: <strong className="text-slate-900">{brief.language}</strong> ·
              Reading Level: <strong className="text-slate-900">{brief.readingLevel}</strong>
            </span>
            <span className="font-semibold text-teal-800">
              {fromCache ? 'Served from Session Cache' : 'Generated Live via Gemini API & Saved to localStorage'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Internal Municipal Briefing Note */}
            <article className="rounded-xl border border-slate-300 bg-slate-50/70 p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <FileText className="w-4 h-4 text-slate-800" aria-hidden="true" />
                  Internal Municipal &amp; RWA Briefing Note
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {brief.internalBriefingNote.subject}
                  </h3>
                  <p className="text-sm text-slate-800 mt-2 leading-relaxed">
                    {brief.internalBriefingNote.executiveSummary}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                    Operational Directives
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-800">
                    {brief.internalBriefingNote.operationalDirectives.map((dir, i) => (
                      <li key={i}>{dir}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg bg-amber-50/90 border border-amber-300 p-3 text-xs text-amber-950">
                  <strong className="font-bold block mb-0.5">
                    Data Audit &amp; Sensor Reliability Note:
                  </strong>
                  {brief.internalBriefingNote.dataReliabilityNote}
                </div>
              </div>

              {renderCitations(brief.internalBriefingNote.citedRowIds)}
            </article>

            {/* Public Citizen Advisory */}
            <article className="rounded-xl border border-teal-300 bg-teal-50/30 p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-900">
                  <Megaphone className="w-4 h-4 text-teal-800" aria-hidden="true" />
                  Public Citizen &amp; Housing Society Advisory
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {brief.citizenAdvisory.headline}
                  </h3>
                  <p className="text-sm text-slate-800 mt-2 leading-relaxed">
                    {brief.citizenAdvisory.publicMessage}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                    Citizen Do’s &amp; Don’ts
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-800">
                    {brief.citizenAdvisory.dosAndDonts.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Extra Care for Vulnerable Groups */}
                <div className="space-y-2.5 pt-1">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-teal-950">
                    Extra Care for Vulnerable Groups
                  </h4>

                  <div className="rounded-lg bg-white border border-slate-200 p-3 flex items-start gap-2.5">
                    <Baby className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-xs">
                      <strong className="font-bold text-slate-900 block">
                        Children &amp; School Students
                      </strong>
                      <span className="text-slate-700">
                        {brief.citizenAdvisory.vulnerableGroups.children}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200 p-3 flex items-start gap-2.5">
                    <UserCheck
                      className="w-4 h-4 text-amber-700 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="text-xs">
                      <strong className="font-bold text-slate-900 block">
                        Older Adults &amp; Senior Citizens
                      </strong>
                      <span className="text-slate-700">
                        {brief.citizenAdvisory.vulnerableGroups.olderAdults}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white border border-slate-200 p-3 flex items-start gap-2.5">
                    <HeartPulse
                      className="w-4 h-4 text-rose-700 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="text-xs">
                      <strong className="font-bold text-slate-900 block">
                        People Sensitive to Poor Air (Asthma, COPD, Heart Conditions, Outdoor Workers)
                      </strong>
                      <span className="text-slate-700">
                        {brief.citizenAdvisory.vulnerableGroups.sensitiveIndividuals}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {renderCitations(brief.citizenAdvisory.citedRowIds)}
            </article>
          </div>
        </div>
      )}

      {/* Change Tracking vs Previous Brief */}
      <div className="pt-4 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-indigo-700" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-900">
              What Changed vs. Previous Brief (localStorage History)
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
                  No briefs saved in <code className="font-mono">localStorage</code> yet. Generate
                  your first brief above to establish a baseline.
                </span>
              ) : (
                <span>
                  Baseline brief <strong>“{savedBriefs[0].label}”</strong> is saved in{' '}
                  <code className="font-mono">localStorage</code>. Edit the sensor table or upload a
                  second shift CSV and generate another brief to see exact AQI deltas, ward category
                  shifts, and new/resolved hotspots.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span>
                Comparing Current Brief: <strong className="text-slate-900">{comparisonDiff.currentLabel}</strong>{' '}
                vs. Previous Brief: <strong className="text-slate-900">{comparisonDiff.previousLabel}</strong>
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

            {/* Ward-by-Ward AQI Change Table */}
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
    </section>
  );
};
