import React, { memo } from 'react';
import { FileText, Loader2, AlertCircle } from 'lucide-react';
import type {
  BriefComparisonDiff,
  GeminiBriefResponse,
  ReadingLevel,
  SavedBriefRecord,
  SupportedLanguage,
} from '../types/airQuality';
import { BriefDocumentCards } from './BriefDocumentCards';
import { BriefComparisonHistory } from './BriefComparisonHistory';

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

/**
 * Renders Step 03 Multilingual Civic Dispatch controls, active brief status,
 * delegated BriefDocumentCards, and BriefComparisonHistory.
 *
 * @param props - Language/level state, brief data, and longitudinal diff history
 * @returns Memoized section component
 */
export const BriefsAndComparisonPanel: React.FC<BriefsAndComparisonPanelProps> = memo(
  ({
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
    return (
      <section
        aria-labelledby="briefs-panel-heading"
        aria-live="polite"
        aria-busy={isLoading}
        className="bg-[#101018]/95 rounded-2xl border border-zinc-800/90 border-t-2 border-t-rose-600 shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-5 sm:p-6 space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-zinc-800/80">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-rose-300 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-700/70">
              Step 03 · Multilingual Civic Dispatch &amp; Longitudinal Diff
            </span>
            <h2
              id="briefs-panel-heading"
              className="text-lg sm:text-xl font-black text-white mt-2"
            >
              Internal Briefing Note, Citizen Advisory &amp; Brief-to-Brief Diff
            </h2>
            <p className="text-sm text-zinc-300">
              Generates official dispatches in English, Hindi (हिन्दी), or Marathi (मराठी) at Simple
              or Detailed reading levels with dedicated care for vulnerable groups.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="brief-language-select"
                className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 mb-1"
              >
                Language
              </label>
              <select
                id="brief-language-select"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
                disabled={isLoading}
                className="rounded-lg border border-zinc-700 bg-[#090910] px-3 py-2 text-sm font-semibold text-white focus:border-rose-500"
              >
                <option value="English">English (Civic Standard)</option>
                <option value="Hindi">हिन्दी (Hindi)</option>
                <option value="Marathi">मराठी (Marathi)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="brief-reading-level-select"
                className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 mb-1"
              >
                Reading Level
              </label>
              <select
                id="brief-reading-level-select"
                value={readingLevel}
                onChange={(e) => onReadingLevelChange(e.target.value as ReadingLevel)}
                disabled={isLoading}
                className="rounded-lg border border-zinc-700 bg-[#090910] px-3 py-2 text-sm font-semibold text-white focus:border-rose-500"
              >
                <option value="Simple">Simple (Everyday Public Clarity)</option>
                <option value="Detailed">Detailed (Technical &amp; CPCB SOP)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onGenerateBrief}
              disabled={!canGenerate || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-sm shadow-[0_0_24px_rgba(225,29,72,0.45)] border border-rose-400/40 disabled:opacity-50 cursor-pointer transition-all"
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
          <div className="rounded-xl border border-dashed border-zinc-700 bg-[#090910] p-5 text-center text-sm text-zinc-300">
            Complete <strong className="text-rose-300">Step 2 (Live Gemini Analysis)</strong> first
            so the municipal briefing note and citizen advisory synthesize verified hotspots.
          </div>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl bg-[#2a0610] border border-rose-500 p-4 flex items-start gap-3 text-rose-100"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-bold text-white">Brief Generation Failed</p>
              <p className="mt-0.5 text-xs text-rose-200">{error}</p>
            </div>
          </div>
        )}

        {brief && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300 bg-[#090910] px-4 py-2.5 rounded-xl border border-zinc-800 font-mono">
              <span>
                ACTIVE DISPATCH: <strong className="text-white">{brief.language}</strong> · LEVEL:{' '}
                <strong className="text-rose-300">{brief.readingLevel}</strong>
              </span>
              <span className="font-semibold text-emerald-300">
                {fromCache
                  ? 'SERVED FROM BOUNDED LRU CACHE'
                  : 'LIVE GEMINI API · SYNCED TO /api/records + localStorage'}
              </span>
            </div>

            <BriefDocumentCards brief={brief} onSelectRowId={onSelectRowId} />
          </div>
        )}

        <BriefComparisonHistory
          savedBriefs={savedBriefs}
          comparisonDiff={comparisonDiff}
          onClearHistory={onClearHistory}
        />
      </section>
    );
  }
);
