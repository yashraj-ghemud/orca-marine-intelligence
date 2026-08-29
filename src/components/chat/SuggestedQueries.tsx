"use client";

/**
 * ORCA — Suggested query chips + conversation empty state.
 * Understated pills; clicking one types & sends the full query.
 * Chips surface with a staggered spring; the mark floats on sonar.
 */

import { motion } from "framer-motion";
import { LifeBuoy, Fish, TriangleAlert, Route, CalendarDays } from "lucide-react";
import type { Language } from "@/types/orca";
import { SUGGESTED_QUERIES, t } from "@/lib/i18n";
import { useOrcaStore } from "@/lib/store";
import { OrcaMark } from "./MessageBubble";

const ICONS = {
  shield: LifeBuoy,
  fish: Fish,
  warning: TriangleAlert,
  route: Route,
  calendar: CalendarDays,
} as const;

export function SuggestedQueries({ language }: { language: Language }) {
  const sendQuery = useOrcaStore((s) => s.sendQuery);
  const isProcessing = useOrcaStore((s) => s.isProcessing);

  return (
    <div className="flex flex-wrap gap-1.5">
      {SUGGESTED_QUERIES.map((q, i) => {
        const Icon = ICONS[q.icon];
        return (
          <motion.button
            key={q.icon}
            type="button"
            disabled={isProcessing}
            onClick={() => sendQuery(language === "hi" ? q.queryHi : q.query)}
            initial={{ opacity: 0, scale: 0.72, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.065, type: "spring", stiffness: 430, damping: 24 }}
            whileHover={isProcessing ? undefined : { scale: 1.06, y: -2 }}
            whileTap={isProcessing ? undefined : { scale: 0.95 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-ocean-line bg-white px-3 py-[6px] text-[12px] text-ocean-ink/85 transition-colors duration-150 hover:border-ocean-blue/45 hover:bg-ocean-info hover:text-ocean-navy disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon className="h-[12.5px] w-[12.5px] text-ocean-blue" strokeWidth={2} />
            {language === "hi" ? q.hi : q.en}
          </motion.button>
        );
      })}
    </div>
  );
}

export function ChatEmptyState({ language }: { language: Language }) {
  return (
    <div className="msg-enter flex flex-col gap-5 px-1 py-6">
      <div className="flex gap-3">
        {/* ORCA adrift on its own sonar — floating mark + expanding pings */}
        <span className="relative shrink-0">
          <span className="logo-ping rounded-[8px]" aria-hidden />
          <span className="logo-ping rounded-[8px]" style={{ animationDelay: "1.6s" }} aria-hidden />
          <span className="float-soft block">
            <OrcaMark size={30} />
          </span>
        </span>
        <div>
          <p className="text-[15px] font-medium leading-snug text-ocean-ink">{t(language, "greeting")}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-ocean-slate">{t(language, "greetingSub")}</p>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[10px] border border-ocean-line bg-white p-4 shadow-[0_1px_2px_rgba(23,35,45,0.04)]">
        {/* Calm tide line breathing under the empty-state card */}
        <span className="ocean-line-live absolute inset-x-0 bottom-0 h-[2px] opacity-60" aria-hidden />
        <h2 className="text-[14px] font-semibold text-ocean-ink">{t(language, "emptyStateTitle")}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ocean-slate">{t(language, "emptyStateSub")}</p>
        <div className="mt-3.5">
          <SuggestedQueries language={language} />
        </div>
      </div>
    </div>
  );
}
