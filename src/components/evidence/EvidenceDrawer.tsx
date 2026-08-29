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
import type { OrcaResponse } from "@/types/orca";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { getRegion } from "@/lib/mock-marine-data";

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
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-ocean-blue" strokeWidth={2} />
        <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ocean-slate">{title}</h4>
        <span className="soft-blink ml-0.5 h-1 w-1 rounded-full bg-ocean-blue/70" aria-hidden />
      </div>
      <dl className="flex flex-col gap-1">
        {items.map((e, i) => (
          <motion.div
            key={i}
            className="flex items-baseline justify-between gap-3 border-b border-dotted border-ocean-line/70 pb-1 last:border-0"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3, ease: [0.25, 0.8, 0.35, 1] }}
          >
            <dt className="truncate text-[11.5px] text-ocean-slate">{language === "hi" ? e.labelHi : e.label}</dt>
            <dd className={`data-value shrink-0 text-[12px] font-medium ${TONE_TEXT[e.tone ?? "neutral"]}`}>
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
  const regionId = useOrcaStore((s) => s.regionId);
  const region = getRegion(regionId);

  if (!activeResponse) return null;
  const ev = activeResponse.evidence;
  const weatherOcean = ev.filter((e) => e.category === "weather" || e.category === "ocean");
  const geo = ev.filter((e) => e.category === "geospatial");
  const marine = ev.filter((e) => e.category === "marine");

  return (
    <aside
      aria-label={t(language, "evidenceTitle")}
      className="drawer-enter pointer-events-auto absolute inset-x-3 bottom-3 z-[600] overflow-hidden rounded-[10px] border border-ocean-line bg-white/97 shadow-[0_-2px_16px_rgba(23,35,45,0.10)] backdrop-blur-[3px]"
    >
      <header className="flex items-center justify-between border-b border-ocean-line/80 bg-ocean-bg/60 px-3.5 py-2">
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
            {activeResponse.analysis.intentLabel}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-ocean-slate transition-transform duration-200 ${open ? "" : "rotate-180"}`} strokeWidth={2.2} />
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[9.5px] uppercase tracking-wide text-ocean-slate/70 md:inline">
            {region.name} · {region.conditions.updatedAt} · simulated
          </span>
          <button
            type="button"
            onClick={() => setActiveResponse(null)}
            title="Close evidence"
            className="flex h-6 w-6 items-center justify-center rounded-md text-ocean-slate transition-colors hover:bg-ocean-info hover:text-ocean-navy"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </div>
      </header>
      {open && (
        <div className="drawer-enter flex gap-6 overflow-x-auto px-4 py-3">
          {weatherOcean.length > 0 && (
            <EvidenceGroup icon={Waves} title={language === "hi" ? "मौसम और महासागर" : "Weather & Ocean"} items={weatherOcean} language={language} />
          )}
          {geo.length > 0 && (
            <EvidenceGroup icon={MapPin} title={language === "hi" ? "भू-स्थानिक और जोखिम" : "Geospatial & Risk"} items={geo} language={language} />
          )}
          {marine.length > 0 && (
            <EvidenceGroup icon={Database} title={language === "hi" ? "समुद्री डेटा" : "Marine Data"} items={marine} language={language} />
          )}
          {weatherOcean.length + geo.length + marine.length === 0 && (
            <p className="py-2 text-[12px] text-ocean-slate">{t(language, "evidenceEmpty")}</p>
          )}
          {/* Region context column */}
          <div className="min-w-0 flex-1 border-l border-ocean-line/70 pl-6">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Waves className="h-3.5 w-3.5 text-ocean-blue" strokeWidth={2} />
              <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ocean-slate">
                {t(language, "conditions")}
              </h4>
            </div>
            <dl className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-ocean-line/70 pb-1">
                <dt className="text-[11.5px] text-ocean-slate">{t(language, "sst")}</dt>
                <dd className="data-value text-[12px] font-medium text-ocean-ink">{region.conditions.sst.toFixed(1)} °C</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-ocean-line/70 pb-1">
                <dt className="text-[11.5px] text-ocean-slate">{t(language, "chlorophyll")}</dt>
                <dd className="data-value text-[12px] font-medium text-ocean-ink">{region.conditions.chlorophyll.toFixed(1)} mg/m³</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-ocean-line/70 pb-1">
                <dt className="text-[11.5px] text-ocean-slate">{t(language, "advisory")}</dt>
                <dd className={`data-value text-[12px] font-medium ${region.conditions.advisoryActive ? "text-ocean-warn-fg" : "text-ocean-success"}`}>
                  {region.conditions.advisoryActive ? (language === "hi" ? "सक्रिय" : "Active") : language === "hi" ? "स्पष्ट" : "Clear"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[11.5px] text-ocean-slate">{language === "hi" ? "ज्वार" : "Tide"}</dt>
                <dd className="data-value text-[12px] font-medium text-ocean-ink">
                  H {region.conditions.tide.high} · L {region.conditions.tide.low}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </aside>
  );
}
