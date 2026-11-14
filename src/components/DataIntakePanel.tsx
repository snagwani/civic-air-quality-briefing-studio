import React, { memo, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Trash2, Sparkles, AlertCircle, Flame, GitCompare } from 'lucide-react';
import rawSampleCsv from '../../test-data/messy-ward-readings.csv?raw';

const FOLLOW_UP_SHIFT_CSV = `Ward,Station,Timestamp,PM2.5,PM10,NO2,SO2,Units
Ward K-West,Andheri Lokhandwala RWA Gate,14/11/2026 18:00,52,118,34,14,ug/m3
Ward K-West,Andheri Lokhandwala RWA Gate,14/11/2026 19:00,48,110,31,12,ug/m3
Ward H-East,Bandra Kurla Municipal School,14/11/2026 18:00,86,165,44,16,ug/m3
Ward H-East,Bandra Kurla Municipal School,14/11/2026 19:00,79,154,40,15,ug/m3
Ward M-East,Govandi Shivaji Nagar Depot,14/11/2026 18:00,168,310,76,29,ug/m3
Ward M-East,Govandi Shivaji Nagar Depot,14/11/2026 19:00,154,295,72,26,ug/m3
Ward D,Malabar Hill Reservoir Garden,14/11/2026 18:00,24,48,19,8,ug/m3`;

const CORRUPT_SPARSE_CSV = `Ward,Station,Timestamp,PM2.5,PM10,NO2,SO2,Units
Ward M-East,Govandi Shivaji Nagar Depot,invalid-date,-45,NA,NA,NA,ug/m3
Ward M-East,Govandi Shivaji Nagar Depot,14/11/2026 10:00,6200,NA,-12,NA,ug/m3
Ward H-East,Bandra Kurla Municipal School,bad-time,NA,NA,NA,NA,ug/m3
Ward K-West,Andheri Lokhandwala RWA Gate,14/11/2026 10:00,142,230,54,18,ug/m3`;

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
 * including size/extension validation and one-click `/test-data` scenario presets.
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

  return (
    <section
      aria-labelledby="intake-heading"
      className="bg-[#101018]/95 rounded-2xl border border-zinc-800/90 border-t-2 border-t-rose-600 shadow-[0_12px_40px_rgba(0,0,0,0.65)] p-5 sm:p-6"
    >
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-zinc-800/80">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-rose-300 bg-rose-950/80 px-3 py-1 rounded-full border border-rose-700/70">
            Step 01 · Deterministic Sensor Hygiene Engine
          </span>
          <h2 id="intake-heading" className="text-lg sm:text-xl font-black text-white mt-2">
            Raw Air Quality Telemetry Intake &amp; CPCB Normalization
          </h2>
          <p className="text-sm text-zinc-300 mt-0.5">
            Ingest messy ward CSV/TSV streams. Automatically converts{' '}
            <code className="font-mono text-rose-300">ppm</code>,{' '}
            <code className="font-mono text-rose-300">ppb</code>, and{' '}
            <code className="font-mono text-rose-300">mg/m³</code> to{' '}
            <code className="font-mono text-rose-300">µg/m³</code> and isolates corrupt spikes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFileError(null);
              onRawInputChange(rawSampleCsv.trim());
              onBriefLabelChange('Morning Smog Shift (Test Input)');
            }}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-rose-500/60 bg-rose-950/70 text-rose-100 hover:bg-rose-900/80 disabled:opacity-50 cursor-pointer transition-colors"
            title="Loads /test-data/messy-ward-readings.csv into the input box"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
            Load Test Input CSV (/test-data)
          </button>

          <button
            type="button"
            onClick={() => {
              setFileError(null);
              onRawInputChange(FOLLOW_UP_SHIFT_CSV);
              onBriefLabelChange('Evening Mitigation Shift (Follow-Up)');
            }}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-amber-600/60 bg-amber-950/50 text-amber-100 hover:bg-amber-900/60 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <GitCompare className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            2. Follow-Up Shift (Diff Test)
          </button>

          <button
            type="button"
            onClick={() => {
              setFileError(null);
              onRawInputChange(CORRUPT_SPARSE_CSV);
              onBriefLabelChange('Corrupt Sensor Outage Log');
            }}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" aria-hidden="true" />
            3. Corrupt Log (Honesty Test)
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
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
            className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 mb-1"
          >
            Monitoring Window / Dispatch Identifier
          </label>
          <input
            id="brief-session-label"
            type="text"
            value={briefLabel}
            onChange={(e) => onBriefLabelChange(e.target.value)}
            placeholder="e.g., Ward K-West & M-East · 14 Nov Morning Smog Alert"
            disabled={isBusy}
            className="w-full rounded-lg border border-zinc-700 bg-[#090910] px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-rose-500"
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
            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto text-xs font-mono font-semibold px-3.5 py-2.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-rose-200 hover:border-rose-700 disabled:opacity-40 cursor-pointer transition-colors"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Clear Stream
          </button>
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor="raw-csv-textarea"
          className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 mb-1"
        >
          Raw Sensor Telemetry Stream (CSV, TSV, or Semicolon-separated)
        </label>
        <textarea
          id="raw-csv-textarea"
          rows={7}
          value={rawInput}
          onChange={(e) => onRawInputChange(e.target.value)}
          disabled={isBusy}
          placeholder={`Ward,Station,Timestamp,PM2.5,PM10,NO2,SO2,Units\nWard K-West,Andheri RWA Gate,14/11/2026 08:00,96,178,0.032 ppm,21,ug/m3`}
          className="w-full font-mono text-xs rounded-xl border border-zinc-700/90 p-3.5 text-rose-100 bg-[#07070c] placeholder:text-zinc-600 focus:border-rose-500 leading-relaxed"
        />
      </div>

      {(fileError || parseError) && (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-4 rounded-xl bg-[#2a0610] border border-rose-500/80 p-3.5 flex items-start gap-2.5 text-rose-100 text-sm shadow-[0_0_20px_rgba(225,29,72,0.25)]"
        >
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold text-white">Telemetry Intake Validation Alert</p>
            <p className="text-xs text-rose-200 mt-0.5">{fileError || parseError}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-300 font-mono">
          Assigns immutable row IDs (<code className="text-rose-300 font-bold">R01</code>..
          <code className="text-rose-300 font-bold">R##</code>) for zero-hallucination citation binding.
        </p>
        <button
          type="button"
          onClick={onRunClean}
          disabled={isBusy}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-sm shadow-[0_0_24px_rgba(225,29,72,0.45)] border border-rose-400/40 disabled:opacity-50 cursor-pointer transition-all"
        >
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          Parse, Normalize &amp; Audit Data Quality
        </button>
      </div>
    </section>
  );
});
