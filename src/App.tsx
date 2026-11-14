import { Wind, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AppProvider, useAppContext } from './context/AppContext';
import { DataIntakePanel } from './components/DataIntakePanel';
import { QualityReportPanel } from './components/QualityReportPanel';
import { GeminiAnalysisPanel } from './components/GeminiAnalysisPanel';
import { BriefsAndComparisonPanel } from './components/BriefsAndComparisonPanel';

/**
 * Inner workspace component consuming the memoized AppContext.
 */
function StudioWorkspace() {
  const {
    rawInput,
    setRawInput,
    briefLabel,
    setBriefLabel,
    parseError,
    report,
    highlightedRowId,
    setHighlightedRowId,
    analysis,
    isAnalyzing,
    analysisError,
    analysisFromCache,
    language,
    setLanguage,
    readingLevel,
    setReadingLevel,
    brief,
    isGeneratingBrief,
    briefError,
    briefFromCache,
    savedBriefs,
    comparisonDiff,
    isBusy,
    handleRunClean,
    handleRunAnalysis,
    handleGenerateBrief,
    handleClearHistory,
  } = useAppContext();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-teal-800 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Skip to main content
      </a>

      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700 flex items-center justify-center shadow-xs shrink-0">
              <Wind className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Civic Air Quality Briefing Studio
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider bg-teal-950 text-teal-200 border border-teal-700 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  CPCB Trust Layer
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Deterministic Data Hygiene + Row-Cited Gemini Intelligence for Indian Wards,
                Housing Societies &amp; Schools
              </p>
            </div>
          </div>

          <nav aria-label="Workflow status steps" className="flex items-center gap-2 text-xs">
            <span
              className={`px-2.5 py-1 rounded-md font-medium border ${
                report
                  ? 'bg-teal-900/80 text-teal-100 border-teal-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              1. Intake &amp; CPCB Audit {report && '✓'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-md font-medium border ${
                analysis
                  ? 'bg-teal-900/80 text-teal-100 border-teal-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              2. Gemini Analysis {analysis && '✓'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-md font-medium border ${
                brief
                  ? 'bg-teal-900/80 text-teal-100 border-teal-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              3. Multilingual Briefs {brief && '✓'}
            </span>
          </nav>
        </div>
      </header>

      <main
        id="main-workspace"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6"
      >
        <div className="rounded-xl bg-teal-950 text-teal-50 p-4 border border-teal-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <CheckCircle2
              className="w-4 h-4 text-teal-400 shrink-0 mt-0.5 sm:mt-0"
              aria-hidden="true"
            />
            <span>
              <strong>Zero-Hallucination Civic Pipeline:</strong> Deterministic code calculates
              unit conversions, CPCB AQI sub-indices, and station reliability scores. Gemini
              interprets trends and writes advisories with clickable{' '}
              <code className="font-mono">[R##]</code> row citations.
            </span>
          </div>
          <span className="text-teal-300 font-mono whitespace-nowrap">
            Languages: English · हिन्दी · मराठी
          </span>
        </div>

        <DataIntakePanel
          rawInput={rawInput}
          onRawInputChange={setRawInput}
          briefLabel={briefLabel}
          onBriefLabelChange={setBriefLabel}
          onRunClean={handleRunClean}
          parseError={parseError}
          isBusy={isBusy}
        />

        {report && (
          <QualityReportPanel report={report} highlightedRowId={highlightedRowId} />
        )}

        {report && (
          <GeminiAnalysisPanel
            report={report}
            analysis={analysis}
            isLoading={isAnalyzing}
            error={analysisError}
            fromCache={analysisFromCache}
            onRunAnalysis={handleRunAnalysis}
            onSelectRowId={setHighlightedRowId}
          />
        )}

        {report && (
          <BriefsAndComparisonPanel
            language={language}
            onLanguageChange={setLanguage}
            readingLevel={readingLevel}
            onReadingLevelChange={setReadingLevel}
            brief={brief}
            isLoading={isGeneratingBrief}
            error={briefError}
            fromCache={briefFromCache}
            canGenerate={Boolean(analysis)}
            onGenerateBrief={handleGenerateBrief}
            savedBriefs={savedBriefs}
            comparisonDiff={comparisonDiff}
            onClearHistory={handleClearHistory}
            onSelectRowId={setHighlightedRowId}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Civic Air Quality Briefing Studio · Built with India CPCB Standards &amp; Live Gemini
            API
          </span>
          <span>
            All AI responses validated with Zod schemas · Row-level citation traceability enabled
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Root application component wrapping StudioWorkspace in the centralized AppProvider.
 */
export function App() {
  return (
    <AppProvider>
      <StudioWorkspace />
    </AppProvider>
  );
}

export default App;
