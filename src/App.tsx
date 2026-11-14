import { Flame, ShieldCheck, Radio, Activity } from 'lucide-react';
import { AppProvider, useAppContext } from './context/AppContext';
import { DataIntakePanel } from './components/DataIntakePanel';
import { QualityReportPanel } from './components/QualityReportPanel';
import { GeminiAnalysisPanel } from './components/GeminiAnalysisPanel';
import { BriefsAndComparisonPanel } from './components/BriefsAndComparisonPanel';

/**
 * Inner workspace component consuming the memoized AppContext in Atmospheric Dark Mode.
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
    <div className="min-h-screen flex flex-col bg-[#07070c] text-zinc-50 selection:bg-rose-600 selection:text-white">
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-rose-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 bg-[#090910]/90 backdrop-blur-xl border-b border-rose-950/80 shadow-[0_4px_30px_rgba(225,29,72,0.12)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-rose-600 to-red-900 border border-rose-400/50 flex items-center justify-center shadow-[0_0_24px_rgba(225,29,72,0.55)] shrink-0">
              <Flame className="w-6 h-6 text-white" aria-hidden="true" />
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping"
                aria-hidden="true"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Civic Air Quality Briefing Studio
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest bg-rose-950/90 text-rose-200 border border-rose-600/60 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                  CPCB Trust Layer
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                Atmospheric Smog Telemetry · Deterministic Hygiene + Row-Cited Gemini Intelligence
              </p>
            </div>
          </div>

          <nav aria-label="Workflow status steps" className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`px-3 py-1.5 rounded-lg font-mono font-semibold border transition-all ${
                report
                  ? 'bg-rose-950/90 text-rose-100 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.3)]'
                  : 'bg-zinc-900/90 text-zinc-300 border-zinc-800'
              }`}
            >
              01 · INTAKE &amp; CPCB AUDIT {report && '✓'}
            </span>
            <span
              className={`px-3 py-1.5 rounded-lg font-mono font-semibold border transition-all ${
                analysis
                  ? 'bg-rose-950/90 text-rose-100 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.3)]'
                  : 'bg-zinc-900/90 text-zinc-300 border-zinc-800'
              }`}
            >
              02 · GEMINI TELEMETRY {analysis && '✓'}
            </span>
            <span
              className={`px-3 py-1.5 rounded-lg font-mono font-semibold border transition-all ${
                brief
                  ? 'bg-rose-950/90 text-rose-100 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.3)]'
                  : 'bg-zinc-900/90 text-zinc-300 border-zinc-800'
              }`}
            >
              03 · MULTILINGUAL DISPATCH {brief && '✓'}
            </span>
          </nav>
        </div>
      </header>

      <main
        id="main-workspace"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6"
      >
        <div className="rounded-xl bg-gradient-to-r from-[#18070d] via-[#120b14] to-[#18070d] text-rose-100 p-4 border border-rose-800/70 shadow-[0_0_30px_rgba(225,29,72,0.12)] flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <Radio
              className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0 animate-pulse"
              aria-hidden="true"
            />
            <span>
              <strong className="text-white uppercase tracking-wider font-mono">
                Zero-Hallucination Atmospheric Pipeline:
              </strong>{' '}
              Deterministic code normalizes mixed chemical units (<code className="font-mono text-rose-300">ppm</code>,{' '}
              <code className="font-mono text-rose-300">mg/m³</code> → <code className="font-mono text-rose-300">µg/m³</code>)
              and flags sensor spikes before Gemini synthesizes interventions with clickable{' '}
              <code className="font-mono text-rose-200 bg-rose-950 px-1.5 py-0.5 rounded border border-rose-700">
                [R##]
              </code>{' '}
              citations.
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-rose-300 whitespace-nowrap">
            <Activity className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
            <span>DISPATCH: ENGLISH · हिन्दी · मराठी</span>
          </div>
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

      <footer className="bg-[#090910] border-t border-zinc-800/80 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-400 font-mono">
          <span>
            CIVIC AIR QUALITY BRIEFING STUDIO · INDIA CPCB NATIONAL AQI TELEMETRY
          </span>
          <span className="text-rose-400">
            ZOD-VALIDATED GEMINI API · ROW-LEVEL [R##] TRACEABILITY ACTIVE
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
