"use client";

/**
 * ORCA — Workspace shell: header + (conversation | marine map) split.
 * Owns the responsive layout, floating map furniture, proactive alert
 * timing, toasts and the evidence drawer.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { TopHeader } from "./TopHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { MapLayersPanel, MapQuickActions, MapLegend } from "@/components/map/MapControls";
import { EvidenceDrawer } from "@/components/evidence/EvidenceDrawer";
import { AlertToast } from "@/components/alerts/AlertToast";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { buildRegionAlert } from "@/lib/store";
import type { Language } from "@/types/orca";

const MarineMap = dynamic(() => import("@/components/map/MarineMap"), {
  ssr: false,
  loading: () => (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#dce9f2]">
      {/* Sonar sweep while the chart boots */}
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
  if (messages > 0 || activeResponse) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2">
      <div className="drawer-enter drift-soft flex items-center gap-2.5 rounded-full border border-ocean-line bg-white/95 px-4 py-2 shadow-[0_2px_12px_rgba(23,35,45,0.10)] backdrop-blur-[2px]">
        <span className="soft-blink h-1.5 w-1.5 rounded-full bg-ocean-blue" />
        <span className="text-[12px] font-medium text-ocean-ink/85">{t(language, "selectQueryHint")}</span>
      </div>
    </div>
  );
}

/* ── Workspace ─────────────────────────────────────────────── */

export function OrcaWorkspace() {
  const language = useOrcaStore((s) => s.language);
  const activeAlert = useOrcaStore((s) => s.activeAlert);
  const demoMode = useOrcaStore((s) => s.demoMode);
  const raiseAlert = useOrcaStore((s) => s.raiseAlert);
  const activeResponse = useOrcaStore((s) => s.activeResponse);
  const [proactiveFired, setProactiveFired] = useState(false);

  /* Proactive alert — fires once, ~45s into the session, only in demo mode */
  useEffect(() => {
    if (!demoMode || proactiveFired) return;
    const timer = window.setTimeout(() => {
      if (useOrcaStore.getState().demoMode) {
        raiseAlert(buildRegionAlert(useOrcaStore.getState().regionId));
        setProactiveFired(true);
      }
    }, 45_000);
    return () => window.clearTimeout(timer);
  }, [demoMode, proactiveFired, raiseAlert]);

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

  return (
    <div className="flex h-screen min-h-[560px] w-full flex-col overflow-hidden bg-ocean-bg">
      <TopHeader />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Conversation — 35% on desktop, stacked above map on mobile */}
        <div className="h-[46vh] w-full shrink-0 lg:h-auto lg:w-[400px] xl:w-[430px]">
          <ChatPanel language={language} />
        </div>

        {/* Marine intelligence map — dominant surface */}
        <div className="relative min-h-[54vh] flex-1 lg:min-h-0">
          <MarineMap />

          {/* Floating furniture */}
          <div className="pointer-events-none absolute left-3 top-3 z-[600] flex flex-col gap-2">
            <MapLayersPanel language={language} />
          </div>
          <div className="pointer-events-none absolute right-3 top-3 z-[600]">
            <MapQuickActions language={language} />
          </div>
          <div
            className="pointer-events-none absolute left-3 z-[600] transition-all duration-300"
            style={{ bottom: activeResponse ? 214 : 12 }}
          >
            <MapLegend language={language} />
          </div>

          <MapHint language={language} />
          <EvidenceDrawer language={language} />
        </div>
      </main>

      {/* Proactive alert toast */}
      <div className="pointer-events-none fixed right-4 top-[66px] z-[950]">
        {activeAlert && <AlertToast alert={activeAlert} language={language} />}
      </div>

      <ToastStack />
    </div>
  );
}
