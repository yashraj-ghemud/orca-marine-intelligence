"use client";

/**
 * ORCA — Workspace shell: header + (conversation | marine map) split.
 * Owns the responsive layout, floating map furniture, proactive alert
 * timing, toasts and the evidence drawer.
 *
 * During the cinematic intro every shell element sits hidden. The intro's
 * last act builds a 3D wall of these panels in WebGL, locked exactly over
 * this layout; when it locks, the shell fades in beneath the dissolving
 * canvas, each piece in the order the sonar ping woke it. The cut is meant
 * to be invisible. See `lib/assembly-motion.ts`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, MotionConfig } from "framer-motion";
import { CheckCircle2, Info, Map, MessageSquare, TriangleAlert, X } from "lucide-react";
import { TopHeader } from "./TopHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MapLayersPanel, MapQuickActions, MapLegend } from "@/components/map/MapControls";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { AlertToast } from "@/components/alerts/AlertToast";
import { OceanRibbon } from "@/components/intro/OceanRibbon";
import { SonarDome3D } from "@/components/intro/SonarDome3D";
import { CinematicIntro } from "@/components/intro/CinematicIntro";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { buildRegionAlert } from "@/lib/store";
import { useIntroGate, useMotionPreference } from "@/lib/intro";
import { afterAssembly, assemblyMotion } from "@/lib/assembly-motion";
import type { Language } from "@/types/orca";

const MarineMap = dynamic(() => import("@/components/map/MarineMap"), {
  ssr: false,
  loading: () => (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#dce9f2]">
      {/* A living 3D sea while the chart boots */}
      <OceanRibbon className="absolute inset-x-0 bottom-0 h-[46%] w-full opacity-70" />
      {/* Sonar sweep above the ribbon */}
      <span className="logo-ping rounded-full" style={{ inset: "auto", width: 120, height: 120, position: "absolute", border: "1.5px solid rgba(74,122,150,.55)" }} aria-hidden />
      <span className="logo-ping rounded-full" style={{ inset: "auto", width: 120, height: 120, position: "absolute", border: "1.5px solid rgba(74,122,150,.35)", animationDelay: "1.4s" }} aria-hidden />
      <div className="relative flex items-center gap-2 text-[12px] font-medium text-[#4A7A96]">
        <span className="stage-spin inline-block h-4 w-4 rounded-full border-2 border-[#4A7A96] border-t-transparent" />
        Loading marine chart…
      </div>
    </div>
  ),
});

/* ── Toasts ────────────────────────────────────────────────── */

function ToastStack() {
  const toasts = useOrcaStore((s) => s.toasts);
  const dismiss = useOrcaStore((s) => s.dismissToast);
  const language = useOrcaStore((s) => s.language);
  const activeResponse = useOrcaStore((s) => s.activeResponse);

  const ICONS = {
    info: Info,
    success: CheckCircle2,
    warn: TriangleAlert,
    danger: TriangleAlert,
  } as const;
  const TONES = {
    info: "text-ocean-blue",
    success: "text-ocean-success",
    warn: "text-ocean-warn-fg",
    danger: "text-ocean-danger-fg",
  } as const;

  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none absolute left-1/2 z-[900] flex -translate-x-1/2 flex-col items-center gap-2 transition-all duration-300"
      style={{ bottom: activeResponse ? 240 : 20 }}
    >
      {toasts.map((toast, i) => {
        const Icon = ICONS[toast.tone];
        return (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: -22, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 460, damping: 26, delay: i * 0.06 }}
            whileHover={{ scale: 1.03, y: -1 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-ocean-line bg-white/97 py-2 pl-3.5 pr-2 shadow-[0_4px_18px_rgba(23,35,45,0.14)]"
          >
            <span className="pop-in">
              <Icon className={`h-4 w-4 shrink-0 ${TONES[toast.tone]}`} strokeWidth={2.1} />
            </span>
            <span className="text-[12.5px] font-medium text-ocean-ink">{toast.title}</span>
            {toast.description && (
              <span className="text-[12px] text-ocean-slate">· {toast.description}</span>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-ocean-slate transition-colors hover:bg-ocean-bg"
            >
              <X className="h-3 w-3" strokeWidth={2.4} />
            </button>
            <span className="sr-only">{language === "hi" ? "सूचना" : "notification"}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Map empty-state hint ──────────────────────────────────── */

function MapHint({ language }: { language: Language }) {
  const messages = useOrcaStore((s) => s.messages.length);
  const activeResponse = useOrcaStore((s) => s.activeResponse);
  const { shown, fast } = useIntroGate();
  if (messages > 0 || activeResponse) return null;
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[56px] z-[500] -translate-x-1/2 lg:top-4"
      initial={{ opacity: 0, y: -14, scale: 0.92 }}
      animate={shown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -14, scale: 0.92 }}
      transition={{ delay: afterAssembly(fast, 0.3), type: "spring", stiffness: 380, damping: 24 }}
    >
      <div className="drift-soft flex items-center gap-2.5 rounded-full border border-ocean-line bg-white/95 px-4 py-2 shadow-[0_2px_12px_rgba(23,35,45,0.10)] backdrop-blur-[2px]">
        <span className="soft-blink h-1.5 w-1.5 rounded-full bg-ocean-blue" />
        <span className="text-[12px] font-medium text-ocean-ink/85">{t(language, "selectQueryHint")}</span>
      </div>
    </motion.div>
  );
}

/* ── Workspace ─────────────────────────────────────────────── */

const WORKSPACE_LABELS = {
  en: { chat: "Chat", chart: "Chart", views: "Workspace views", demo: "Demo workspace", live: "Live mode · connection not verified" },
  hi: { chat: "चैट", chart: "समुद्री मानचित्र", views: "कार्यस्थान दृश्य", demo: "डेमो कार्यस्थान", live: "लाइव मोड · कनेक्शन सत्यापित नहीं" },
  gu: { chat: "ચેટ", chart: "સમુદ્રી નકશો", views: "કાર્યસ્થળ દૃશ્યો", demo: "ડેમો કાર્યસ્થળ", live: "લાઇવ મોડ · જોડાણ ચકાસાયેલ નથી" },
} as const;

export function OrcaWorkspace() {
  const language = useOrcaStore((s) => s.language);
  const activeAlert = useOrcaStore((s) => s.activeAlert);
  const demoMode = useOrcaStore((s) => s.demoMode);
  const raiseAlert = useOrcaStore((s) => s.raiseAlert);
  const activeResponse = useOrcaStore((s) => s.activeResponse);
  const { shown, fast } = useIntroGate();
  const reduced = useMotionPreference();
  const introPhase = useOrcaStore((s) => s.introPhase);
  const [proactiveFired, setProactiveFired] = useState(false);
  const mobileTab = useOrcaStore((s) => s.mobileTab);
  const setMobileTab = useOrcaStore((s) => s.setMobileTab);
  const [desktop, setDesktop] = useState(false);
  const chartPanel = useRef<HTMLDivElement>(null);
  const labels = WORKSPACE_LABELS[language];

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const panel = chartPanel.current;
    if (!panel) return;
    let frame = 0;
    // MarineMap already listens for window resize. Keep its Leaflet instance alive
    // across tabs, but invalidate after panel/viewport/header dimensions settle.
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      if (panel.clientWidth && panel.clientHeight) {
        frame = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      }
    });
    observer.observe(panel);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  /* ── Assembly ────────────────────────────────────────────
     Every panel plays one keyframe track from its scatter pose to home;
     the chart's power-on effects and the systems sweep wait for it. */
  const settled = introPhase === "done";
  const home = afterAssembly(fast);
  const dGridFlash = home - 0.25;
  const dWipe = home - 0.1;
  const dSweep = home + 0.35;

  /* Proactive alert — fires once, ~45s into the session, only in demo mode */
  useEffect(() => {
    if (!demoMode || proactiveFired || introPhase !== "done") return;
    const timer = window.setTimeout(() => {
      if (useOrcaStore.getState().demoMode) {
        raiseAlert(buildRegionAlert(useOrcaStore.getState().regionId));
        setProactiveFired(true);
      }
    }, 45_000);
    return () => window.clearTimeout(timer);
  }, [demoMode, proactiveFired, raiseAlert, introPhase]);

  /* QA/demo hook — lets scripted demos trigger the alert on demand */
  useEffect(() => {
    (window as unknown as { __orca?: object }).__orca = {
      fireAlert: () => raiseAlert(buildRegionAlert(useOrcaStore.getState().regionId)),
      store: useOrcaStore,
    };
    return () => {
      delete (window as unknown as { __orca?: object }).__orca;
    };
  }, [raiseAlert]);

  /* One-shot shimmer wipe across the map as it materialises */
  const wipe = useMemo(
    () =>
      shown ? { x: ["-130%", "130%"], opacity: [0, 1, 1, 0] } : { x: "-130%", opacity: 0 },
    [shown],
  );

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"}>
    <div className="orca-workspace relative flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-ocean-bg" data-mobile-tab={mobileTab}>
      <CinematicIntro />
      <motion.div className="relative z-[700] shrink-0" {...assemblyMotion("header", shown, fast, settled)}>
        <TopHeader choreographed={false} />
      </motion.div>

      <motion.div className="orca-mobile-navigation relative z-[1] shrink-0 border-b border-ocean-line bg-white px-3 pb-2 pt-1.5 lg:hidden" lang={language} {...assemblyMotion("tabs", shown, fast, settled)}>
        <div role="tablist" aria-label={labels.views} className="flex gap-1 rounded-xl bg-ocean-bg p-1">
          {(["chat", "chart"] as const).map((tab) => {
            const Icon = tab === "chat" ? MessageSquare : Map;
            return <button key={tab} type="button" id={`orca-tab-${tab}`} role="tab" aria-selected={mobileTab === tab} aria-controls={`orca-panel-${tab}`} tabIndex={mobileTab === tab ? 0 : -1}
              onClick={() => setMobileTab(tab)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? "chat" : event.key === "End" ? "chart" : tab === "chat" ? "chart" : "chat";
                setMobileTab(next);
                document.getElementById(`orca-tab-${next}`)?.focus();
              }}
              className="orca-view-tab flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[12px] font-semibold text-ocean-slate transition-colors">
              <Icon aria-hidden className="h-4 w-4 shrink-0" />{labels[tab]}
            </button>;
          })}
        </div>
        <p className="mt-1.5 text-center text-[10px] font-medium text-ocean-slate" role="status">{demoMode ? labels.demo : labels.live}</p>
      </motion.div>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Conversation — fixed rail on desktop, full-height tab on mobile. */}
        <motion.div
          id="orca-panel-chat"
          role={desktop ? "region" : "tabpanel"}
          aria-label={desktop ? labels.chat : undefined}
          aria-labelledby={desktop ? undefined : "orca-tab-chat"}
          className="orca-chat-panel relative min-h-0 min-w-0 flex-1 overflow-hidden lg:w-[400px] lg:flex-none xl:w-[430px]"
          {...assemblyMotion("chat", shown, fast, settled)}
        >
          <ChatPanel language={language} />
          {shown && !reduced && (
            <span aria-hidden className="scan-once inset-0 z-20" style={{ "--scan-delay": "0.35s" } as React.CSSProperties} />
          )}
        </motion.div>

        {/* Marine intelligence map — dominant surface. */}
        <motion.div
          ref={chartPanel}
          id="orca-panel-chart"
          role={desktop ? "region" : "tabpanel"}
          aria-label={desktop ? labels.chart : undefined}
          aria-labelledby={desktop ? undefined : "orca-tab-chart"}
          className="orca-chart-panel relative min-h-0 min-w-0 flex-1 overflow-hidden"
          {...assemblyMotion("chart", shown, fast, settled)}
        >
          <MarineMap />

          {/* Chart power-on — coordinate grid flashes then dissolves */}
          {shown && !reduced && (
            <span aria-hidden className="map-grid-flash absolute inset-0 z-[640]" style={{ animationDelay: `${Math.max(0, dGridFlash)}s` }} />
          )}

          {/* Cinematic shimmer wipe */}
          {!reduced && <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[650]"
            style={{
              background:
                "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)",
            }}
            initial={{ x: "-130%", opacity: 0 }}
            animate={wipe}
            transition={{ delay: dWipe, duration: 1.05, ease: [0.22, 1, 0.36, 1], opacity: { times: [0, 0.15, 0.8, 1] } }}
          />}

          {/* Live 3D sea strip — the map's own tide gauge (decorative) */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[450] block h-[22px] opacity-60 lg:h-[30px]"
            style={{
              WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
              maskImage: "linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
            }}
          >
            <OceanRibbon className="h-full w-full" />
          </span>

          {/* Floating furniture — each piece is adrift on its own and finds its corner */}
          <motion.div className="pointer-events-none absolute left-3 top-3 z-[600] flex flex-col gap-2" {...assemblyMotion("layers", shown, fast, settled)}>
            <MapLayersPanel language={language} />
          </motion.div>
          <motion.div className="pointer-events-none absolute right-3 top-3 z-[600]" {...assemblyMotion("actions", shown, fast, settled)}>
            <MapQuickActions language={language} />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute left-3 z-[600] transition-all duration-300"
            {...assemblyMotion("legend", shown, fast, settled)}
            style={{ ...assemblyMotion("legend", shown, fast, settled).style, bottom: activeResponse ? 214 : 12 }}
          >
            <MapLegend language={language} />
          </motion.div>
          <motion.div className="pointer-events-none absolute right-3 top-1/2 z-[600] -translate-y-1/2" {...assemblyMotion("sonar", shown, fast, settled)}>
            <SonarDome3D size={72} />
          </motion.div>

          <MapHint language={language} />
          <EvidenceDrawer language={language} />
        </motion.div>
      </main>

      {/* Proactive alert toast */}
      <div className="pointer-events-none fixed bottom-[140px] right-4 z-[950] lg:bottom-auto lg:top-[66px]">
        {activeAlert && <AlertToast alert={activeAlert} language={language} />}
      </div>

      <ToastStack />

      {/* Final assembly sweep describes the mode, not backend health. */}
      {shown && !reduced && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-[1400] overflow-hidden">
            <span className="sys-sweep inset-y-0" style={{ "--sweep-delay": `${dSweep}s` } as React.CSSProperties} />
          </div>
          <motion.div
            aria-hidden
            className="pointer-events-none fixed left-1/2 top-[62px] z-[1400] -translate-x-1/2"
            initial={{ opacity: 0, y: -12, scale: 0.9 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [-12, 0, 0, -6],
              scale: [0.9, 1, 1, 0.97],
            }}
            transition={{ delay: dSweep + 0.35, duration: 2.6, times: [0, 0.14, 0.72, 1], ease: "easeOut" }}
          >
            <span className="badge-shimmer flex items-center gap-1.5 rounded-full border border-ocean-line bg-white/95 px-3 py-1.5 shadow-[0_2px_14px_rgba(23,35,45,0.12)]">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${demoMode ? "bg-ocean-blue" : "bg-ocean-warn-fg"}`} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ocean-navy">
                {demoMode ? labels.demo : labels.live}
              </span>
            </span>
          </motion.div>
        </>
      )}
    </div>
    </MotionConfig>
  );
}
