import React, { memo } from 'react';
import { FileText, Megaphone, Baby, HeartPulse, UserCheck } from 'lucide-react';
import type { GeminiBriefResponse } from '../types/airQuality';

interface BriefDocumentCardsProps {
  brief: GeminiBriefResponse;
  onSelectRowId: (rowId: string) => void;
}

/**
 * Renders the side-by-side Internal Municipal Briefing Note card and
 * Public Citizen Smog Advisory card with vulnerable population guidance and row citations.
 *
 * @param props - Active GeminiBriefResponse and row citation click callback
 * @returns Memoized dual-card layout
 */
export const BriefDocumentCards: React.FC<BriefDocumentCardsProps> = memo(
  ({ brief, onSelectRowId }) => {
    const renderCitations = (ids: string[]) => (
      <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-zinc-800">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
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
            className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-rose-950 text-rose-200 border border-rose-600/80 hover:bg-rose-700 hover:text-white cursor-pointer transition-colors"
          >
            [{id}]
          </button>
        ))}
      </div>
    );

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article className="rounded-xl border border-zinc-800 bg-[#090910] p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
              <FileText className="w-4 h-4 text-rose-500" aria-hidden="true" />
              Internal Municipal &amp; RWA Briefing Note
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                {brief.internalBriefingNote.subject}
              </h3>
              <p className="text-sm text-zinc-200 mt-2 leading-relaxed">
                {brief.internalBriefingNote.executiveSummary}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300 mb-2">
                Operational Directives
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-zinc-200">
                {brief.internalBriefingNote.operationalDirectives.map((dir, i) => (
                  <li key={i}>{dir}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-[#271705] border border-amber-600/70 p-3 text-xs text-amber-200">
              <strong className="font-bold text-amber-300 block mb-0.5 font-mono uppercase">
                Data Audit &amp; Sensor Reliability Note:
              </strong>
              {brief.internalBriefingNote.dataReliabilityNote}
            </div>
          </div>

          {renderCitations(brief.internalBriefingNote.citedRowIds)}
        </article>

        <article className="rounded-xl border border-rose-900/80 bg-gradient-to-b from-[#170910] to-[#090910] p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
              <Megaphone className="w-4 h-4 text-rose-400" aria-hidden="true" />
              Public Citizen &amp; Housing Society Smog Advisory
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                {brief.citizenAdvisory.headline}
              </h3>
              <p className="text-sm text-zinc-200 mt-2 leading-relaxed">
                {brief.citizenAdvisory.publicMessage}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300 mb-2">
                Citizen Do’s &amp; Don’ts
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-zinc-200">
                {brief.citizenAdvisory.dosAndDonts.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5 pt-1">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
                Extra Care for Vulnerable Populations
              </h4>

              <div className="rounded-lg bg-[#090910] border border-zinc-800 p-3 flex items-start gap-2.5">
                <Baby className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs">
                  <strong className="font-bold text-white block">
                    Children &amp; School Students
                  </strong>
                  <span className="text-zinc-300">
                    {brief.citizenAdvisory.vulnerableGroups.children}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-[#090910] border border-zinc-800 p-3 flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs">
                  <strong className="font-bold text-white block">
                    Older Adults &amp; Senior Citizens
                  </strong>
                  <span className="text-zinc-300">
                    {brief.citizenAdvisory.vulnerableGroups.olderAdults}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-[#090910] border border-rose-900/70 p-3 flex items-start gap-2.5">
                <HeartPulse className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs">
                  <strong className="font-bold text-white block">
                    People Sensitive to Poor Air (Asthma, COPD, Heart Conditions, Outdoor Workers)
                  </strong>
                  <span className="text-zinc-300">
                    {brief.citizenAdvisory.vulnerableGroups.sensitiveIndividuals}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {renderCitations(brief.citizenAdvisory.citedRowIds)}
        </article>
      </div>
    );
  }
);
