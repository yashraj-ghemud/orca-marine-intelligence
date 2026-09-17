"use client";

/**
 * ORCA — Floating map controls: layers panel (top-left) + quick actions.
 * Compact, elegant, professional — follows marine nav-system conventions.
 */

import { useId, useState, useSyncExternalStore } from "react";
import {
  Layers,
  LocateFixed,
  RotateCcw,
  ChevronDown,
  Ship,
  TriangleAlert,
  Fish,
  Anchor,
  Route,
  ShieldCheck,
  Waves,
} from "lucide-react";
import type { MapLayerId } from "@/types/orca";
import type { Language } from "@/types/orca";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { getRegion } from "@/lib/mock-marine-data";

const LAYER_ITEMS: {
  id: MapLayerId;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  labelKey: "vessel" | "hazard" | "cycloneInfluence" | "pfz" | "safeZone" | "route" | "boundary";
  swatch: string;
}[] = [
  { id: "vessel", icon: Ship, labelKey: "vessel", swatch: "#124E78" },
  { id: "risk", icon: TriangleAlert, labelKey: "hazard", swatch: "#B4453A" },
  { id: "cyclone", icon: Waves, labelKey: "cycloneInfluence", swatch: "#B42318" },
  { id: "pfz", icon: Fish, labelKey: "pfz", swatch: "#0F766E" },
  { id: "safe", icon: Anchor, labelKey: "safeZone", swatch: "#2E7D5B" },
  { id: "route", icon: Route, labelKey: "route", swatch: "#0E7490" },
  { id: "boundary", icon: ShieldCheck, labelKey: "boundary", swatch: "#7C8B96" },
];

/* Desktop breakpoint store — SSR snapshot true, live matchMedia on client.
   useSyncExternalStore hydrates with the server snapshot first (no mismatch),
   then syncs to the real viewport — and reacts to resizes across 1024px. */
const DESKTOP_MQL = "(min-width: 1024px)";
function subscribeDesktop(cb: () => void) {
  const mql = window.matchMedia(DESKTOP_MQL);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

export function MapLayersPanel({ language }: { language: Language }) {
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_MQL).matches,
    () => true,
  );
  /* null = follow the viewport; after the user toggles, honour their choice */
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? isDesktop;
  const layers = useOrcaStore((s) => s.layers);
  const toggleLayer = useOrcaStore((s) => s.toggleLayer);
  const demoMode = useOrcaStore((s) => s.demoMode);
  const hintId = useId();

  return (
    <div className="pointer-events-auto w-[196px] overflow-hidden rounded-[10px] border border-ocean-line bg-white/95 shadow-[0_2px_10px_rgba(23,35,45,0.10)] backdrop-blur-[2px]">
      <button
        type="button"
        onClick={() => setUserOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 transition-colors hover:bg-ocean-info/60"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ocean-slate">
          <Layers className="h-3.5 w-3.5" strokeWidth={2.1} />
          {t(language, "layersTitle")}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-ocean-slate transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
          strokeWidth={2.2}
        />
      </button>
      {open && (
        <div className="panel-unfold border-t border-ocean-line/70 px-1.5 py-1.5">
          {!demoMode && <p id={hintId} className="px-1.5 pb-2 text-[11px] leading-relaxed text-ocean-slate">
            {{ en: "These overlays use demo data and are unavailable in live mode. Live evidence appears in answers.", hi: "ये परतें डेमो डेटा का उपयोग करती हैं और लाइव मोड में उपलब्ध नहीं हैं। लाइव साक्ष्य उत्तरों में दिखते हैं।", gu: "આ સ્તરો ડેમો ડેટા વાપરે છે અને લાઇવ મોડમાં ઉપલબ્ધ નથી. લાઇવ પુરાવા જવાબોમાં દેખાય છે." }[language]}
          </p>}
          {LAYER_ITEMS.map(({ id, icon: Icon, labelKey, swatch }) => {
            const active = demoMode && layers[id];
            return (
              <label
                key={id}
                className={`group flex select-none items-center gap-2 rounded-md px-1.5 py-[5px] transition-colors ${demoMode ? "cursor-pointer hover:bg-ocean-info/70" : "cursor-not-allowed opacity-60"}`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  disabled={!demoMode}
                  aria-describedby={!demoMode ? hintId : undefined}
                  onChange={() => toggleLayer(id)}
                  className="h-[15px] w-[15px] shrink-0 cursor-inherit rounded-[4px] accent-ocean-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue"
                />
                <Icon className="h-[13px] w-[13px] shrink-0" style={{ color: active ? swatch : "#9AAab2" }} />
                <span
                  className={`text-[11.5px] leading-tight transition-colors ${active ? "font-medium text-ocean-ink" : "text-ocean-slate"}`}
                >
                  {t(language, labelKey)}
                </span>
                <span
                  className="ml-auto h-2 w-2 shrink-0 rounded-full transition-opacity"
                  style={{ background: swatch, opacity: active ? 1 : 0.18 }}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MapQuickActions({ language }: { language: Language }) {
  const regionId = useOrcaStore((s) => s.regionId);
  const flyTo = useOrcaStore((s) => s.flyTo);
  const demoMode = useOrcaStore((s) => s.demoMode);
  const hintId = useId();
  const vesselHint = { en: "Vessel location is demo data; unavailable in live mode.", hi: "नाव का स्थान डेमो डेटा है; लाइव मोड में उपलब्ध नहीं है।", gu: "નાવનું સ્થાન ડેમો ડેટા છે; લાઇવ મોડમાં ઉપલબ્ધ નથી." }[language];

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1.5">
      <button
        type="button"
        title={demoMode ? t(language, "zoomToVessel") : vesselHint}
        aria-label={t(language, "zoomToVessel")}
        aria-describedby={!demoMode ? hintId : undefined}
        disabled={!demoMode}
        onClick={() => {
          if (!demoMode) return;
          const v = getRegion(regionId).vessel;
          flyTo(v.position, 11);
        }}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-ocean-line bg-white/95 text-ocean-navy shadow-sm transition-all hover:bg-ocean-info hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
      >
        <LocateFixed className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        title={t(language, "resetView")}
        aria-label={t(language, "resetView")}
        onClick={() => {
          const r = getRegion(regionId);
          flyTo(r.center, r.defaultZoom);
        }}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-md border border-ocean-line bg-white/95 text-ocean-slate shadow-sm transition-all hover:bg-ocean-info hover:text-ocean-navy hover:shadow"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={2} />
      </button>
      {!demoMode && <p id={hintId} className="max-w-32 rounded-md border border-ocean-line bg-white/95 p-2 text-[10px] leading-relaxed text-ocean-slate shadow-sm">{vesselHint}</p>}
    </div>
  );
}

export function MapLegend({ language }: { language: Language }) {
  const layers = useOrcaStore((s) => s.layers);
  const demoMode = useOrcaStore((s) => s.demoMode);
  const items: { id: MapLayerId; label: string; swatch: string; dashed?: boolean }[] = [
    { id: "vessel", label: t(language, "vessel"), swatch: "#124E78" },
    { id: "risk", label: t(language, "hazard"), swatch: "#B4453A", dashed: true },
    { id: "cyclone", label: t(language, "cycloneInfluence"), swatch: "#B42318", dashed: true },
    { id: "pfz", label: t(language, "pfzShort"), swatch: "#0F766E", dashed: true },
    { id: "safe", label: t(language, "safeZone"), swatch: "#2E7D5B", dashed: true },
    { id: "route", label: t(language, "route"), swatch: "#0E7490" },
  ];
  const visible = items.filter((i) => layers[i.id]);
  if (!demoMode || visible.length === 0) return null;

  return (
    <div className="pointer-events-none rounded-lg border border-ocean-line bg-white/93 px-2.5 py-2 shadow-[0_2px_8px_rgba(23,35,45,0.08)] backdrop-blur-[2px]">
      <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.09em] text-ocean-slate">
        {t(language, "legendTitle")}
      </div>
      <div className="flex flex-col gap-1">
        {visible.map((i) => (
          <div key={i.id} className="flex items-center gap-2">
            {i.dashed ? (
              <span
                className="h-0 w-4 border-t-2"
                style={{ borderColor: i.swatch, borderStyle: "dashed", borderTopWidth: 2 }}
              />
            ) : (
              <span className="h-2 w-2 rounded-full" style={{ background: i.swatch }} />
            )}
            <span className="text-[10.5px] leading-tight text-ocean-ink/80">{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
