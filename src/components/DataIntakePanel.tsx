import React, { memo, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import rawSampleCsv from '../../test-data/messy-ward-readings.csv?raw';

interface DataIntakePanelProps {
  rawInput: string;
  onRawInputChange: (val: string) => void;
  briefLabel: string;
  onBriefLabelChange: (val: string) => void;
  onRunClean: () => void;
  parseError: string | null;
  isBusy: boolean;
}

/**
 * Provides CSV/TSV paste and file upload controls for raw sensor intake,
 * including size/extension validation and one-click `/test-data` loading.
 */
export const DataIntakePanel: React.FC<DataIntakePanelProps> = memo(({
  rawInput,
  onRawInputChange,
  briefLabel,
  onBriefLabelChange,
  onRunClean,
  parseError,
  isBusy,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 512 * 1024) {
      setFileError('Uploaded file exceeds the 512 KB size limit.');
      return;
    }

    const validExt = /\.(csv|tsv|txt)$/i.test(file.name);
    if (!validExt) {
      setFileError('Unsupported file format. Please upload a .csv, .tsv, or .txt table file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      onRawInputChange(content);
      if (!briefLabel.trim()) {
        onBriefLabelChange(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.onerror = () => {
      setFileError('Could not read the selected file.');
    };
    reader.readAsText(file);
  };

  const handleLoadTestInput = () => {
    setFileError(null);
    onRawInputChange(rawSampleCsv.trim());
    if (!briefLabel.trim()) {
      onBriefLabelChange('Morning Ward Shift (Test Input)');
    }
  };

  return (
    <section
      aria-labelledby="intake-heading"
      className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
            Step 1 · Deterministic Trust Layer
          </span>
          <h2 id="intake-heading" className="text-lg sm:text-xl font-bold text-slate-900 mt-1.5">
            Raw Air Quality Data Intake &amp; Normalization
          </h2>
          <p className="text-sm text-slate-600">
            Paste a CSV/TSV table or upload sensor logs. Deterministic code normalizes units (µg/m³,
            mg/m³, ppm, ppb), dates, and CPCB AQI categories before AI sees a single row.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLoadTestInput}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
            title="Loads /test-data/messy-ward-readings.csv into the input box as test input"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-800" aria-hidden="true" />
            Load Test Input CSV (/test-data)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-700" aria-hidden="true" />
            Upload CSV / TSV
          </button>
          <input
            ref={fileInputRef}
            id="csv-file-upload"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            onChange={handleFileUpload}
            className="sr-only"
            aria-label="Upload CSV or TSV air quality file"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label
            htmlFor="brief-session-label"
            className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1"
          >
            Brief / Monitoring Window Label
          </label>
          <input
            id="brief-session-label"
            type="text"
            value={briefLabel}
            onChange={(e) => onBriefLabelChange(e.target.value)}
            placeholder="e.g., Ward K-West & H-East · 14 Nov Morning Shift"
            disabled={isBusy}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setFileError(null);
              onRawInputChange('');
            }}
            disabled={isBusy || !rawInput}
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-xs font-medium px-3 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Clear Input
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor="raw-csv-textarea"
          className="block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-1"
        >
          Raw Sensor Table (CSV, TSV, or Semicolon-separated)
        </label>
        <textarea
          id="raw-csv-textarea"
          rows={7}
          value={rawInput}
          onChange={(e) => onRawInputChange(e.target.value)}
          disabled={isBusy}
          placeholder={`Ward,Station,Timestamp,PM2.5,PM10,NO2,SO2,Units\nWard K-West,Andheri RWA Gate,14/11/2026 08:00,96,178,0.032 ppm,21,ug/m3`}
          className="w-full font-mono text-xs rounded-lg border border-slate-300 p-3 text-slate-900 bg-slate-50/60 placeholder:text-slate-400 focus:bg-white focus:border-teal-700"
        />
        <p className="mt-1 text-xs text-slate-600">
          Supports mixed units (<code className="bg-slate-100 px-1 rounded">ug/m3</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">mg/m3</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">ppm</code>,{' '}
          <code className="bg-slate-100 px-1 rounded">ppb</code>), Indian dates (
          <code className="bg-slate-100 px-1 rounded">DD/MM/YYYY</code>) &amp; ISO timestamps. Max
          500 rows / 512 KB.
        </p>
      </div>

      {(fileError || parseError) && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-lg bg-red-50 border border-red-300 p-3.5 flex items-start gap-2.5 text-red-900 text-sm"
        >
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">Data Intake Validation Error</p>
            <p className="text-xs mt-0.5">{fileError || parseError}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-600">
          Every parsed row receives a traceable ID (<code className="font-mono font-semibold">R01</code>
          , <code className="font-mono font-semibold">R02</code>…) that Gemini must cite.
        </p>
        <button
          type="button"
          onClick={onRunClean}
          disabled={isBusy}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm shadow-xs disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          Parse, Normalize &amp; Audit Data Quality
        </button>
      </div>
    </section>
  );
});
