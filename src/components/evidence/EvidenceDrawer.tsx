"use client";

/**
 * ORCA — Evidence drawer: bottom strip of the map panel showing the
 * grouped, human-readable data behind the current answer.
 * Columns surface with a staggered tide-in.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Database, MapPin, Waves, X } from "lucide-react";
import type { EvidenceItem } from "@/types/marine";
import type { Language } from "@/types/orca";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";

const TONE_TEXT = {
  danger: "text-ocean-danger-fg",
  warn: "text-ocean-warn-fg",
  good: "text-ocean-success",
  info: "text-ocean-blue",
  neutral: "text-ocean-ink",
} as const;

function EvidenceGroup({
  icon: Icon,
  title,
  items,
  language,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  items: EvidenceItem[];
  language: Language;
}) {
  return (
    <div className="min-w-[180px] flex-1">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-ocean-blue" strokeWidth={2} />
        <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ocean-slate">{title}</h4>
        <span className="soft-blink ml-0.5 h-1 w-1 rounded-full bg-ocean-blue/70" aria-hidden />
      </div>
      <dl lang={language} className="flex flex-col gap-1">
        {items.map((e, i) => (
          <motion.div
            key={i}
            className="flex items-baseline justify-between gap-3 border-b border-dotted border-ocean-line/70 pb-1 last:border-0"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3, ease: [0.25, 0.8, 0.35, 1] }}
          >
            <dt className="min-w-0 break-words text-[11.5px] text-ocean-slate">{language === "hi" ? e.labelHi : e.label}</dt>
            <dd className={`data-value min-w-0 break-words text-right text-[12px] font-medium ${TONE_TEXT[e.tone ?? "neutral"]}`}>
              {(language === "hi" && e.valueHi) ? e.valueHi : e.value}
            </dd>
          </motion.div>
        ))}
      </dl>
    </div>
  );
}

export function EvidenceDrawer({ language }: { language: Language }) {
  const [open, setOpen] = useState(true);
  const activeResponse = useOrcaStore((s) => s.activeResponse);
  const setActiveResponse = useOrcaStore((s) => s.setActiveResponse);
  const answerLanguage = activeResponse?.originalLanguage;
  const contentLanguage = answerLanguage ?? language;

  if (!activeResponse) return null;
  const ev = activeResponse.evidence;
  const weatherOcean = ev.filter((e) => e.category === "weather" || e.category === "ocean");
  const geo = ev.filter((e) => e.category === "geospatial");
  const marine = ev.filter((e) => e.category === "marine");
  const sources = contentLanguage === "hi" ? activeResponse.analysis.sourcesHi : activeResponse.analysis.sources;

  return (
    <aside
      aria-label={t(language, "evidenceTitle")}
      className="drawer-enter pointer-events-auto absolute inset-x-3 bottom-3 z-[600] flex max-h-[55%] flex-col overflow-hidden rounded-[10px] border border-ocean-line bg-white/97 shadow-[0_-2px_16px_rgba(23,35,45,0.10)] backdrop-blur-[3px]"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-ocean-line/80 bg-ocean-bg/60 px-3.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2"
          aria-expanded={open}
        >
          <Database className="h-3.5 w-3.5 text-ocean-navy" strokeWidth={2.1} />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ocean-navy">
            {t(language, "evidenceTitle")}
          </span>
          <span className="rounded-full bg-ocean-info px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-ocean-blue">
            {contentLanguage === "hi" ? activeResponse.analysis.intentLabelHi : activeResponse.analysis.intentLabel}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-ocean-slate transition-transform duration-200 ${open ? "" : "rotate-180"}`} strokeWidth={2.2} />
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[9.5px] uppercase tracking-wide text-ocean-slate/70 md:inline">
            {t(language, activeResponse.responseMode === "demo" ? "confidenceNote" : activeResponse.responseMode === "live" ? "liveConfidenceNote" : "unknownConfidenceNote")}
          </span>
          <button
            type="button"
            onClick={() => setActiveResponse(null)}
            aria-label={{ en: "Close evidence", hi: "साक्ष्य बंद करें", gu: "પુરાવા બંધ કરો" }[language]}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ocean-slate transition-colors hover:bg-ocean-info hover:text-ocean-navy"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </div>
      </header>
      {open && (
        <div className="drawer-enter flex min-h-0 gap-6 overflow-auto px-4 py-3">
          {weatherOcean.length > 0 && (
            <EvidenceGroup icon={Waves} title={{ en: "Weather & Ocean", hi: "मौसम और महासागर", gu: "હવામાન અને મહાસાગર" }[language]} items={weatherOcean} language={contentLanguage} />
          )}
          {geo.length > 0 && (
            <EvidenceGroup icon={MapPin} title={{ en: "Geospatial & Risk", hi: "भू-स्थानिक और जोखिम", gu: "ભૌગોલિક માહિતી અને જોખમ" }[language]} items={geo} language={contentLanguage} />
          )}
          {marine.length > 0 && (
            <EvidenceGroup icon={Database} title={{ en: "Marine Data", hi: "समुद्री डेटा", gu: "દરિયાઈ માહિતી" }[language]} items={marine} language={contentLanguage} />
          )}
          {weatherOcean.length + geo.length + marine.length === 0 && (
            <p className="py-2 text-[12px] text-ocean-slate">{t(language, "evidenceEmpty")}</p>
          )}
          {sources.length > 0 && <div className="min-w-[180px] flex-1 border-l border-ocean-line/70 pl-6">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Waves className="h-3.5 w-3.5 text-ocean-blue" strokeWidth={2} />
              <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ocean-slate">
                {t(language, "sources")}
              </h4>
            </div>
            <ul lang={contentLanguage} className="flex flex-col gap-2 text-[11.5px] leading-relaxed text-ocean-slate">
              {sources.map((source, i) => <li key={i} className="break-words">{source}</li>)}
            </ul>
          </div>}
        </div>
      )}
    </aside>
  );
}
