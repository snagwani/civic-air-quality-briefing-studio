import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  BriefComparisonDiff,
  GeminiAnalysisResponse,
  GeminiBriefResponse,
  QualityReport,
  ReadingLevel,
  SavedBriefRecord,
  SupportedLanguage,
} from '../types/airQuality';
import { parseAndCleanAirQualityData } from '../lib/dataCleaner';
import { runGeminiAnalysis, runGeminiBrief } from '../lib/geminiClient';
import {
  clearSavedBriefs,
  computeBriefDiff,
  loadSavedBriefs,
  saveBriefRecord,
  syncBriefsFromServer,
} from '../lib/briefComparison';

interface AppContextValue {
  rawInput: string;
  setRawInput: (val: string) => void;
  briefLabel: string;
  setBriefLabel: (val: string) => void;
  parseError: string | null;
  report: QualityReport | null;
  highlightedRowId: string | null;
  setHighlightedRowId: (rowId: string | null) => void;
  analysis: GeminiAnalysisResponse | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisFromCache: boolean;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  readingLevel: ReadingLevel;
  setReadingLevel: (level: ReadingLevel) => void;
  brief: GeminiBriefResponse | null;
  isGeneratingBrief: boolean;
  briefError: string | null;
  briefFromCache: boolean;
  savedBriefs: SavedBriefRecord[];
  comparisonDiff: BriefComparisonDiff | null;
  isBusy: boolean;
  handleRunClean: () => void;
  handleRunAnalysis: () => Promise<void>;
  handleGenerateBrief: () => Promise<void>;
  handleClearHistory: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

/**
 * Provides centralized, memoized application state and asynchronous workflow actions
 * for the Civic Air Quality Briefing Studio.
 */
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rawInput, setRawInput] = useState<string>('');
  const [briefLabel, setBriefLabel] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<GeminiAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisFromCache, setAnalysisFromCache] = useState<boolean>(false);

  const [language, setLanguage] = useState<SupportedLanguage>('English');
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>('Simple');
  const [brief, setBrief] = useState<GeminiBriefResponse | null>(null);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState<boolean>(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefFromCache, setBriefFromCache] = useState<boolean>(false);

  const [savedBriefs, setSavedBriefs] = useState<SavedBriefRecord[]>(() => loadSavedBriefs());
  const [comparisonDiff, setComparisonDiff] = useState<BriefComparisonDiff | null>(null);

  useEffect(() => {
    let active = true;
    void syncBriefsFromServer().then((records) => {
      if (active) setSavedBriefs(records);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleRunClean = useCallback(() => {
    setParseError(null);
    setAnalysisError(null);
    setBriefError(null);
    try {
      const cleanedReport = parseAndCleanAirQualityData(rawInput);
      setReport(cleanedReport);
      setAnalysis(null);
      setBrief(null);
      setHighlightedRowId(null);
    } catch (err: unknown) {
      setReport(null);
      setAnalysis(null);
      setBrief(null);
      setParseError(err instanceof Error ? err.message : String(err));
    }
  }, [rawInput]);

  const handleRunAnalysis = useCallback(async () => {
    if (!report) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await runGeminiAnalysis(report);
      setAnalysis(res.data);
      setAnalysisFromCache(res.fromCache);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAnalyzing(false);
    }
  }, [report]);

  const handleGenerateBrief = useCallback(async () => {
    if (!report || !analysis) return;
    setIsGeneratingBrief(true);
    setBriefError(null);

    const existingList = loadSavedBriefs();
    const previousBrief = existingList.length > 0 ? existingList[0] : null;

    try {
      const res = await runGeminiBrief({
        report,
        analysis,
        language,
        readingLevel,
        previousBrief,
      });

      setBrief(res.data);
      setBriefFromCache(res.fromCache);

      const effectiveLabel =
        briefLabel.trim() ||
        `Ward Brief · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      const newSaved = saveBriefRecord({
        label: effectiveLabel,
        language,
        readingLevel,
        report,
        analysis,
        brief: res.data,
      });

      const updatedList = loadSavedBriefs();
      setSavedBriefs(updatedList);

      if (previousBrief) {
        setComparisonDiff(computeBriefDiff(newSaved, previousBrief));
      } else {
        setComparisonDiff(null);
      }
    } catch (err: unknown) {
      setBriefError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingBrief(false);
    }
  }, [report, analysis, language, readingLevel, briefLabel]);

  const handleClearHistory = useCallback(() => {
    clearSavedBriefs();
    setSavedBriefs([]);
    setComparisonDiff(null);
  }, []);

  const isBusy = isAnalyzing || isGeneratingBrief;

  const contextValue = useMemo<AppContextValue>(
    () => ({
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
    }),
    [
      rawInput,
      briefLabel,
      parseError,
      report,
      highlightedRowId,
      analysis,
      isAnalyzing,
      analysisError,
      analysisFromCache,
      language,
      readingLevel,
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
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

/**
 * Custom hook to access the centralized AppContext state and actions.
 *
 * @returns AppContextValue
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider.');
  }
  return ctx;
}
