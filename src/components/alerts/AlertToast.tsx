"use client";

/**
 * ORCA — Proactive alert toast (top-right slide-in) + header alerts popover.
 * Styled like a production notification: soft danger surface, single
 * primary action, restrained iconography.
 */

import { motion } from "framer-motion";
import { Bell, TriangleAlert, MapPinned, X, CheckCheck } from "lucide-react";
import type { Language, MarineAlert } from "@/types/orca";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export function AlertToast({ alert, language }: { alert: MarineAlert; language: Language }) {
  const dismissAlert = useOrcaStore((s) => s.dismissAlert);
  const viewAlertOnMap = useOrcaStore((s) => s.viewAlertOnMap);

  return (
    <motion.div
      role="alertdialog"
      aria-label={alert.title}
      initial={{ opacity: 0, x: 56, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 26, mass: 0.9 }}
      className="pointer-events-auto w-[330px] overflow-hidden rounded-[10px] border border-ocean-danger-fg/30 bg-white shadow-[0_8px_28px_rgba(180,35,24,0.16)]"
    >
      {/* Coast-guard hazard tape — marching stripes announce urgency */}
      <div className="hazard-tape" aria-hidden />
      <div className="flex items-start gap-3 bg-ocean-danger px-4 py-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/85">
          <TriangleAlert className="hazard-dot-pulse h-4 w-4 text-ocean-danger-fg" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.09em] text-ocean-danger-fg">
            {language === "hi" ? alert.titleHi : alert.title}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ocean-ink/85">
            {language === "hi" ? alert.bodyHi : alert.body}
          </p>
        </div>
        <button
          type="button"
          onClick={dismissAlert}
          aria-label={t(language, "alertDismiss")}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ocean-slate transition-colors hover:bg-white/60 hover:text-ocean-ink"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>
      <div className="flex items-center justify-between border-t border-ocean-line/70 bg-white px-4 py-2.5">
        <span className="font-mono text-[9.5px] uppercase tracking-wide text-ocean-slate/70">
          {new Date(alert.createdAt).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" })} · simulated
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={dismissAlert}
            className="rounded-md border border-ocean-line px-2.5 py-1.5 text-[11px] font-medium text-ocean-slate transition-colors hover:bg-ocean-bg"
          >
            {t(language, "alertDismiss")}
          </button>
          <button
            type="button"
            onClick={() => viewAlertOnMap(alert)}
            className="inline-flex items-center gap-1.5 rounded-md bg-ocean-navy px-2.5 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-ocean-blue active:scale-[0.98]"
          >
            <MapPinned className="h-3.5 w-3.5" strokeWidth={2.1} />
            {t(language, "alertView")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function AlertsPopover({ language }: { language: Language }) {
  const alerts = useOrcaStore((s) => s.alerts);
  const unread = useOrcaStore((s) => s.unreadAlerts);
  const markRead = useOrcaStore((s) => s.markAlertsRead);
  const viewAlertOnMap = useOrcaStore((s) => s.viewAlertOnMap);
  const dismissAlert = useOrcaStore((s) => s.dismissAlert);

  return (
    <div className="absolute right-0 top-[calc(100%+8px)] z-[800] w-[320px] overflow-hidden rounded-[10px] border border-ocean-line bg-white shadow-[0_8px_28px_rgba(23,35,45,0.14)]">
      <div className="flex items-center justify-between border-b border-ocean-line/80 bg-ocean-bg/60 px-3.5 py-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ocean-slate">
          {t(language, "alertsLabel")}
        </span>
        {alerts.length > 0 && (
          <button
            type="button"
            onClick={markRead}
            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ocean-blue hover:underline"
          >
            <CheckCheck className="h-3 w-3" strokeWidth={2.2} />
            {t(language, "markAlertsRead") ?? "Mark read"}
          </button>
        )}
      </div>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-4 py-6 text-center">
          <Bell className="h-4 w-4 text-ocean-slate/50" strokeWidth={2} />
          <p className="text-[12px] text-ocean-slate">{t(language, "alertsEmpty")}</p>
        </div>
      ) : (
        <ul className="orca-scroll max-h-[300px] overflow-y-auto">
          {alerts.map((a) => (
            <li key={a.id} className="border-b border-ocean-line/60 px-3.5 py-2.5 last:border-0">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ocean-danger-fg" strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.07em] text-ocean-danger-fg">
                    {language === "hi" ? a.titleHi : a.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-ocean-ink/80">{language === "hi" ? a.bodyHi : a.body}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        viewAlertOnMap(a);
                        markRead();
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-ocean-navy px-2 py-1 text-[10.5px] font-medium text-white hover:bg-ocean-blue"
                    >
                      <MapPinned className="h-3 w-3" strokeWidth={2.1} />
                      {t(language, "alertView")}
                    </button>
                    <span className="font-mono text-[9.5px] text-ocean-slate/60">
                      {new Date(a.createdAt).toLocaleTimeString(language === "hi" ? "hi-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      type="button"
                      onClick={dismissAlert}
                      className="ml-auto text-[10.5px] text-ocean-slate hover:underline"
                    >
                      {t(language, "alertDismiss")}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
