"use client";

/**
 * ORCA — Top header: brand, honest data-feed badge, region & language
 * selectors, alert bell, demo-mode toggle. Minimal and mission-grade.
 */

import { useState, useRef, useEffect } from "react";
import { Bell, ChevronDown, FlaskConical, MapPin, Check } from "lucide-react";
import type { Language } from "@/types/orca";
import type { RegionId } from "@/types/marine";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { REGION_ORDER, getRegion } from "@/lib/mock-marine-data";
import { AlertsPopover } from "@/components/alerts/AlertToast";

function useClickOutside(onOut: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOut]);
  return ref;
}

function RegionSelect() {
  const language = useOrcaStore((s) => s.language);
  const regionId = useOrcaStore((s) => s.regionId);
  const setRegion = useOrcaStore((s) => s.setRegion);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const region = getRegion(regionId);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-md border border-ocean-line bg-white px-2.5 text-[12px] font-medium text-ocean-ink transition-colors hover:border-ocean-blue/50 hover:bg-ocean-info/60"
      >
        <MapPin className="h-3.5 w-3.5 text-ocean-blue" strokeWidth={2} />
        {language === "hi" ? region.nameHi : region.name}
        <ChevronDown className={`h-3.5 w-3.5 text-ocean-slate transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2.2} />
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-[800] w-[190px] overflow-hidden rounded-[10px] border border-ocean-line bg-white py-1 shadow-[0_8px_28px_rgba(23,35,45,0.14)]">
          {REGION_ORDER.map((r: RegionId) => {
            const rr = getRegion(r);
            const selected = r === regionId;
            return (
              <button
                key={r}
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setRegion(r);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] transition-colors ${
                  selected ? "bg-ocean-info font-medium text-ocean-navy" : "text-ocean-ink/85 hover:bg-ocean-bg"
                }`}
              >
                {language === "hi" ? rr.nameHi : rr.name}
                {selected && <Check className="h-3.5 w-3.5 text-ocean-navy" strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LanguageSelect() {
  const language = useOrcaStore((s) => s.language);
  const setLanguage = useOrcaStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  const options: { id: Language; label: string }[] = [
    { id: "en", label: "English" },
    { id: "hi", label: "हिन्दी" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1 rounded-md border border-ocean-line bg-white px-2.5 text-[12px] font-medium text-ocean-ink transition-colors hover:border-ocean-blue/50 hover:bg-ocean-info/60"
        title={t(language, "languageLabel")}
      >
        {language === "hi" ? "हिन्दी" : "EN"}
        <ChevronDown className={`h-3.5 w-3.5 text-ocean-slate transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2.2} />
      </button>
      {open && (
        <div role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-[800] w-[130px] overflow-hidden rounded-[10px] border border-ocean-line bg-white py-1 shadow-[0_8px_28px_rgba(23,35,45,0.14)]">
          {options.map((o) => (
            <button
              key={o.id}
              role="option"
              aria-selected={o.id === language}
              onClick={() => {
                setLanguage(o.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] transition-colors ${
                o.id === language ? "bg-ocean-info font-medium text-ocean-navy" : "text-ocean-ink/85 hover:bg-ocean-bg"
              }`}
            >
              {o.label}
              {o.id === language && <Check className="h-3.5 w-3.5 text-ocean-navy" strokeWidth={2.4} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertsBell() {
  const language = useOrcaStore((s) => s.language);
  const unread = useOrcaStore((s) => s.unreadAlerts);
  const markRead = useOrcaStore((s) => s.markAlertsRead);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markRead();
        }}
        aria-label={t(language, "alertsLabel")}
        className="relative flex h-8 w-8 items-center justify-center rounded-md border border-ocean-line bg-white text-ocean-ink transition-colors hover:border-ocean-blue/50 hover:bg-ocean-info/60"
      >
        <Bell className={`h-4 w-4 ${unread > 0 ? "bell-swing" : ""}`} strokeWidth={2} />
        {unread > 0 && (
          <span className="pop-in absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ocean-danger-fg px-1 text-[9px] font-bold text-white shadow-sm">
            {unread}
          </span>
        )}
      </button>
      {open && <AlertsPopover language={language} />}
    </div>
  );
}

function DemoToggle() {
  const language = useOrcaStore((s) => s.language);
  const demoMode = useOrcaStore((s) => s.demoMode);
  const toggle = useOrcaStore((s) => s.toggleDemoMode);

  return (
    <button
      type="button"
      onClick={toggle}
      title={t(language, "demoModeHint")}
      className={`hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors md:flex ${
        demoMode
          ? "border-ocean-teal-fg/30 bg-ocean-teal text-ocean-teal-fg"
          : "border-ocean-line bg-white text-ocean-slate hover:bg-ocean-bg"
      }`}
      aria-pressed={demoMode}
    >
      <FlaskConical className="h-3.5 w-3.5" strokeWidth={2} />
      {t(language, "demoMode")}
      <span
        className={`ml-0.5 h-[14px] w-[24px] rounded-full p-[2px] transition-colors ${demoMode ? "bg-ocean-teal-fg/85" : "bg-ocean-line"}`}
      >
        <span
          className={`block h-[10px] w-[10px] rounded-full bg-white shadow transition-transform duration-200 ${
            demoMode ? "translate-x-[10px]" : ""
          }`}
        />
      </span>
    </button>
  );
}

export function TopHeader() {
  const language = useOrcaStore((s) => s.language);
  const activeAlert = useOrcaStore((s) => s.activeAlert);
  /* Live bridge clock — client-only so SSR/hydration stay identical */
  const [clock, setClock] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Kolkata",
        }),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="relative z-[700] flex h-[54px] shrink-0 items-center justify-between border-b border-ocean-line bg-white px-4 shadow-[0_1px_2px_rgba(23,35,45,0.05)]">
      {/* Living tide line — the header's own horizon */}
      <span className="ocean-line-live absolute inset-x-0 bottom-0 h-[2px] opacity-75" aria-hidden />
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-[8px] bg-ocean-navy" aria-hidden>
            <span className="logo-ping rounded-[8px]" />
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="10" r="4.6" stroke="#EAF4F8" strokeWidth="1.8" />
              <circle cx="12" cy="10" r="1.5" fill="#7FB3D5" />
              <path d="M3.5 18.6c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4.5 1.6" stroke="#7FB3D5" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <div className="leading-none">
            <div className="flex items-baseline gap-2">
              <span className="text-[15.5px] font-bold tracking-[0.14em] text-ocean-navy">ORCA</span>
              <span className="hidden text-[10.5px] font-medium text-ocean-slate sm:inline">{t(language, "appTagline")}</span>
            </div>
            <div className="mt-[3px] hidden text-[9px] uppercase tracking-[0.14em] text-ocean-slate/60 lg:block">
              Marine Ecosystem Reasoning · Collaborative Agents
            </div>
          </div>
        </div>
      </div>

      {/* Status center */}
      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 lg:flex" title={t(language, "simulatedFeed")}>
        <span className="badge-shimmer flex items-center gap-1.5 rounded-full border border-ocean-line bg-ocean-bg px-2.5 py-1">
          <span className="soft-blink h-1.5 w-1.5 rounded-full bg-ocean-success" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ocean-slate">
            {t(language, "demoData")}
          </span>
        </span>
        <span className="font-mono text-[10px] text-ocean-slate/60">
          {language === "hi" ? "सिम्युलेटेड फीड" : "simulated feed"} · ok
        </span>
        {clock && (
          <span className="flex items-center gap-1 rounded-full border border-ocean-line bg-white px-2 py-1 font-mono text-[10px] tabular-nums text-ocean-slate" title="IST · demo bridge time">
            <span className="soft-blink h-1 w-1 rounded-full bg-ocean-blue" />
            {clock} IST
          </span>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <RegionSelect />
        <LanguageSelect />
        <AlertsBell />
        <DemoToggle />
        <div className="ml-1 hidden h-8 w-8 items-center justify-center rounded-full border border-ocean-line bg-ocean-info text-[11px] font-semibold text-ocean-navy sm:flex" title="Fisherfolk user · demo profile">
          RK
        </div>
      </div>

      {/* Active alert mirror (when toast auto area overlaps) */}
      {activeAlert && <span className="sr-only" role="alert">{activeAlert.body}</span>}
    </header>
  );
}
