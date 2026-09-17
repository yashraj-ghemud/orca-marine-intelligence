"use client";

/**
 * ORCA — Top header: brand, honest data-feed badge, region & language
 * selectors, alert bell, system status and data mode. Minimal and mission-grade.
 *
 * Assembly choreography (after the cinematic intro lifts):
 *   · the ORCA mark tumbles in from the left edge, the alert bell dives
 *     in from the right — they collide dead-centre with a squash &
 *     stretch impact, then bounce home on spring physics;
 *   · the wordmark letters pop in, then every control STAMPS into its
 *     dock like a machined part locking home (overshoot scale + a small
 *     alternating tilt, mechanical cadence left → right);
 *   · the tide line draws last. A replay control re-runs the cinematic.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Easing, TargetAndTransition, Transition } from "framer-motion";
import { Bell, ChevronDown, MapPin, Check, RotateCcw } from "lucide-react";
import type { Language } from "@/types/orca";
import type { RegionId } from "@/types/marine";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { REGION_ORDER, getRegion } from "@/lib/mock-marine-data";
import { AlertsPopover } from "@/components/alerts/AlertToast";
import { useIntroGate, introDelay, INTRO_SEEN_KEY, useMotionPreference } from "@/lib/intro";
import { SystemStatus } from "./SystemStatus";

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

function RegionSelect({ cascadeDelay, shown, still = false }: { cascadeDelay: number; shown: boolean; still?: boolean }) {
  const reduced = useMotionPreference() || still;
  const language = useOrcaStore((s) => s.language);
  const regionId = useOrcaStore((s) => s.regionId);
  const setRegion = useOrcaStore((s) => s.setRegion);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  const region = getRegion(regionId);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: 18, scale: 1.32, rotate: 6 }}
      animate={shown ? { opacity: 1, x: 0, scale: 1, rotate: 0 } : { opacity: 0, x: 18, scale: 1.32, rotate: 6 }}
      transition={reduced ? { duration: 0 } : { delay: cascadeDelay, type: "spring", stiffness: 500, damping: 21 }}
      ref={ref}
      className="relative min-w-0"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full min-w-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-ocean-line bg-white px-2.5 text-[12px] font-medium text-ocean-ink transition-colors hover:border-ocean-blue/50 hover:bg-ocean-info/60 sm:h-8 sm:w-auto"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-ocean-blue" strokeWidth={2} />
        <span className="min-w-0 truncate sm:max-w-[140px]">{language === "hi" ? region.nameHi : region.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-ocean-slate transition-transform duration-150 ${open ? "rotate-180" : ""}`} strokeWidth={2.2} />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-[calc(100%+6px)] z-[800] w-[190px] overflow-hidden rounded-[10px] border border-ocean-line bg-white py-1 shadow-[0_8px_28px_rgba(23,35,45,0.14)] sm:left-auto sm:right-0">
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
    </motion.div>
  );
}

function LanguageSelect({ cascadeDelay, shown, still = false }: { cascadeDelay: number; shown: boolean; still?: boolean }) {
  const reduced = useMotionPreference() || still;
  const language = useOrcaStore((s) => s.language);
  const setLanguage = useOrcaStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  const options: { id: Language; label: string }[] = [
    { id: "en", label: "English" },
    { id: "hi", label: "हिन्दी" },
    { id: "gu", label: "ગુજરાતી" },
  ];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: 18, scale: 1.32, rotate: -6 }}
      animate={shown ? { opacity: 1, x: 0, scale: 1, rotate: 0 } : { opacity: 0, x: 18, scale: 1.32, rotate: -6 }}
      transition={reduced ? { duration: 0 } : { delay: cascadeDelay, type: "spring", stiffness: 500, damping: 21 }}
      ref={ref}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 items-center gap-1 rounded-md border border-ocean-line bg-white px-2.5 text-[12px] font-medium text-ocean-ink transition-colors hover:border-ocean-blue/50 hover:bg-ocean-info/60 sm:h-8"
        aria-label={t(language, "languageLabel")}
        title={t(language, "languageLabel")}
      >
        {language === "en" ? "EN" : options.find((option) => option.id === language)?.label}
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
    </motion.div>
  );
}

type Entrance = { animate: TargetAndTransition; transition: Transition };

function AlertsBell({ entrance }: { entrance: Entrance }) {
  const language = useOrcaStore((s) => s.language);
  const unread = useOrcaStore((s) => s.unreadAlerts);
  const markRead = useOrcaStore((s) => s.markAlertsRead);
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={entrance.animate}
      transition={entrance.transition}
      ref={ref}
      className="relative"
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markRead();
        }}
        aria-label={t(language, "alertsLabel")}
        className="relative flex h-11 w-11 items-center justify-center rounded-md border border-ocean-line bg-white text-ocean-ink transition-colors hover:border-ocean-blue/50 hover:bg-ocean-info/60 sm:h-8 sm:w-8"
      >
        <Bell className={`h-4 w-4 ${unread > 0 ? "bell-swing" : ""}`} strokeWidth={2} />
        {unread > 0 && (
          <span className="pop-in absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ocean-danger-fg px-1 text-[9px] font-bold text-white shadow-sm">
            {unread}
          </span>
        )}
      </button>
      {open && <AlertsPopover language={language} />}
    </motion.div>
  );
}

function ReplayIntroButton({ cascadeDelay, shown, still = false }: { cascadeDelay: number; shown: boolean; still?: boolean }) {
  const reduced = useMotionPreference() || still;
  const setIntroPhase = useOrcaStore((s) => s.setIntroPhase);
  const language = useOrcaStore((s) => s.language);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: 18, scale: 1.32, rotate: -5 }}
      animate={shown ? { opacity: 1, x: 0, scale: 1, rotate: 0 } : { opacity: 0, x: 18, scale: 1.32, rotate: -5 }}
      transition={reduced ? { duration: 0 } : { delay: cascadeDelay, type: "spring", stiffness: 500, damping: 21 }}
    >
      <button
        type="button"
        title={language === "hi" ? "इंट्रो फिर से देखें" : "Replay the cinematic intro"}
        aria-label={language === "hi" ? "इंट्रो फिर से देखें" : "Replay the cinematic intro"}
        onClick={() => {
          try {
            sessionStorage.removeItem(INTRO_SEEN_KEY);
          } catch {
            /* noop */
          }
          setIntroPhase("playing", false);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-md border border-ocean-line bg-white text-ocean-slate transition-colors hover:border-ocean-blue/50 hover:bg-ocean-info/60 hover:text-ocean-navy sm:h-8 sm:w-8"
      >
        <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2} />
      </button>
    </motion.div>
  );
}

/* ── The header itself — with the collision assembly ────────── */

/**
 * `choreographed` runs the header's own entrance — the brand and the alert
 * bell flying in and colliding. `OrcaWorkspace` turns it off: there the whole
 * header is one of the panels adrift in the intro's last act, and it has to
 * be complete while it floats so it is identical to the header it becomes.
 */
export function TopHeader({ choreographed = true }: { choreographed?: boolean } = {}) {
  const language = useOrcaStore((s) => s.language);
  const activeAlert = useOrcaStore((s) => s.activeAlert);
  const { shown: introShown, fast } = useIntroGate();
  const reduced = useMotionPreference() || !choreographed;
  const shown = introShown || reduced;

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

  /* ── Collision choreography geometry ────────────────────────
     Natural (untransformed) viewport centres of the two flyers are
     measured after mount — never during render — so SSR and the first
     client frame stay identical. */
  const logoRef = useRef<HTMLSpanElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<{ vw: number; logoC: number; bellC: number } | null>(null);

  useEffect(() => {
    // Freeze untransformed dock positions during/after assembly. A resize must
    // never replace active keyframes; only an explicit intro replay re-arms them.
    if (shown || reduced) return;
    const measure = () => {
      const l = logoRef.current?.getBoundingClientRect();
      const b = bellRef.current?.getBoundingClientRect();
      if (!l || !b) return;
      setGeom({ vw: window.innerWidth, logoC: l.left + l.width / 2, bellC: b.left + b.width / 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [shown, reduced]);

  const flightDelay = reduced ? 0 : introDelay(fast, 0.42);
  const flightDur = reduced ? 0 : fast ? 0.62 : 1.15;
  const impactAt = flightDelay + flightDur * 0.44;
  const cascadeStart = impactAt + 0.22;

  /* The two flyers — keyframed flight paths that meet dead-centre */
  const logoFlight = useMemo(() => {
    if (reduced) return { opacity: 1, x: 0, rotate: 0, scaleX: 1, scaleY: 1 } as const;
    if (!shown) return { opacity: 0 } as const;
    if (!geom) return { opacity: 1 } as const;
    const start = -(geom.logoC + 56);
    const impact = geom.vw / 2 - geom.logoC;
    return {
      opacity: [0, 1, 1, 1],
      x: [start, impact, -11, 0],
      rotate: [-160, -326, -346, -360],
      scaleX: [1.14, 0.78, 1.06, 1],
      scaleY: [0.9, 1.22, 0.95, 1],
    };
  }, [shown, geom, reduced]);

  const bellFlight = useMemo(() => {
    if (reduced) return { opacity: 1, x: 0, rotate: 0, scaleX: 1, scaleY: 1 } as const;
    if (!shown) return { opacity: 0 } as const;
    if (!geom) return { opacity: 1 } as const;
    const start = geom.vw - geom.bellC + 56;
    const impact = geom.vw / 2 - geom.bellC;
    return {
      opacity: [0, 1, 1, 1],
      x: [start, impact, 13, 0],
      rotate: [150, 328, 348, 360],
      scaleX: [0.9, 1.22, 0.95, 1],
      scaleY: [1.14, 0.78, 1.06, 1],
    };
  }, [shown, geom, reduced]);

  const flightTimes = [0, 0.44, 0.8, 1];
  const flightEase: Easing[] = ["easeIn", "easeOut", "easeInOut"];

  /* Impact bump — the whole header reacts to the collision */
  const bump = useMemo(
    () => (shown && !reduced ? { y: [0, 3, -1.5, 0] } : { y: 0 }),
    [shown, reduced],
  );

  return (
    <motion.header
      animate={bump}
      transition={reduced ? { duration: 0 } : shown ? { delay: impactAt, duration: 0.3, times: [0, 0.4, 0.72, 1] } : { duration: 0.2 }}
      className="relative z-[700] grid shrink-0 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 border-b border-ocean-line bg-white px-3 py-2 shadow-[0_1px_2px_rgba(23,35,45,0.05)] sm:flex sm:min-h-[54px] sm:flex-wrap sm:gap-x-3 sm:px-4 lg:flex-nowrap"
    >
      {/* Living tide line — draws itself after the collision */}
      <motion.span
        aria-hidden
        className="ocean-line-live absolute inset-x-0 bottom-0 h-[2px] opacity-75"
        initial={reduced ? false : { scaleX: 0 }}
        animate={shown ? { scaleX: 1 } : { scaleX: 0 }}
        transition={reduced ? { duration: 0 } : { delay: impactAt + 0.08, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "center" }}
      />

      {/* Impact flash + shockwave — dead centre of the header */}
      {shown && !reduced && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden>
          <motion.span
            className="absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(143,208,245,0.85) 0%, rgba(143,208,245,0.25) 45%, transparent 70%)" }}
            initial={{ scale: 0.2, opacity: 0.95 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ delay: impactAt, duration: 0.55, ease: "easeOut" }}
          />
          <motion.span
            className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ocean-blue/60"
            initial={{ scale: 0.4, opacity: 0.8 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ delay: impactAt + 0.04, duration: 0.65, ease: "easeOut" }}
          />
        </span>
      )}

      {/* Brand — the logo flies in from the left and collides mid-header */}
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span ref={logoRef} className="flex h-8 w-8 shrink-0">
          <motion.span
            className="relative flex h-8 w-8 items-center justify-center rounded-[8px] bg-ocean-navy"
            initial={false}
            animate={logoFlight}
            transition={{
              delay: flightDelay,
              duration: flightDur,
              times: flightTimes,
              ease: flightEase,
              opacity: { delay: flightDelay, duration: flightDur * 0.3 },
            }}
          >
            <span className="logo-ping rounded-[8px]" />
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="10" r="4.6" stroke="#EAF4F8" strokeWidth="1.8" />
              <circle cx="12" cy="10" r="1.5" fill="#7FB3D5" />
              <path d="M3.5 18.6c2 0 2-1.6 4-1.6s2 1.6 4 1.6 2-1.6 4-1.6 2 1.6 4.5 1.6" stroke="#7FB3D5" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </motion.span>
          </span>
          <div className="leading-none">
            <div className="flex items-baseline gap-2">
              <span className="flex items-baseline" aria-label="ORCA">
                {"ORCA".split("").map((ch, i) => (
                  <motion.span
                    key={i}
                    className="text-[15.5px] font-bold tracking-[0.14em] text-ocean-navy"
                    initial={reduced ? false : { opacity: 0, y: 9, scale: 0.7 }}
                    animate={shown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 9, scale: 0.7 }}
                    transition={reduced ? { duration: 0 } : { delay: impactAt + 0.18 + i * 0.055, type: "spring", stiffness: 480, damping: 24 }}
                  >
                    {ch}
                  </motion.span>
                ))}
              </span>
              <motion.span
                className="hidden text-[10.5px] font-medium text-ocean-slate xl:inline"
                initial={reduced ? false : { opacity: 0 }}
                animate={shown ? { opacity: 1 } : { opacity: 0 }}
                transition={reduced ? { duration: 0 } : { delay: impactAt + 0.42, duration: 0.5 }}
              >
                {t(language, "appTagline")}
              </motion.span>
            </div>
            <motion.div
              className="mt-[3px] hidden text-[9px] uppercase tracking-[0.14em] text-ocean-slate/60 2xl:block"
              initial={reduced ? false : { opacity: 0 }}
              animate={shown ? { opacity: 1 } : { opacity: 0 }}
              transition={reduced ? { duration: 0 } : { delay: impactAt + 0.5, duration: 0.5 }}
            >
              Marine Ecosystem Reasoning · Collaborative Agents
            </motion.div>
          </div>
        </div>
      </div>

      {/* Status stays in normal flow, never over the brand or selectors. */}
      <motion.div
        className="flex items-center justify-end gap-2 sm:ml-auto"
        initial={reduced ? false : { opacity: 0, y: -8 }}
        animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
        transition={reduced ? { duration: 0 } : { delay: cascadeStart + 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {clock && (
          <span className="hidden whitespace-nowrap rounded-full border border-ocean-line bg-white px-2 py-1 font-mono text-[10px] tabular-nums text-ocean-slate 2xl:inline" title="Current time in India">
            {clock} IST
          </span>
        )}
        <SystemStatus />
      </motion.div>

      {/* Right controls */}
      <div className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1.5 sm:flex sm:gap-2">
        <RegionSelect cascadeDelay={cascadeStart} shown={shown} still={!choreographed} />
        <LanguageSelect cascadeDelay={cascadeStart + 0.06} shown={shown} still={!choreographed} />
        {/* The bell — second flyer. Measured here; it dives from the right edge. */}
        <div ref={bellRef} className="relative">
          <AlertsBell
            entrance={{
              animate: bellFlight,
              transition: {
                delay: flightDelay,
                duration: flightDur,
                times: flightTimes,
                ease: flightEase,
                opacity: { delay: flightDelay, duration: flightDur * 0.3 },
              },
            }}
          />
        </div>
        <ReplayIntroButton cascadeDelay={cascadeStart + 0.16} shown={shown} still={!choreographed} />
      </div>

      {/* Active alert mirror (when toast auto area overlaps) */}
      {activeAlert && <span className="sr-only" role="alert">{activeAlert.body}</span>}
    </motion.header>
  );
}
