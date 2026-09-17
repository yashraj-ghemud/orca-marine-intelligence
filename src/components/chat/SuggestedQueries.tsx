"use client";

/**
 * ORCA — Suggested query chips + conversation empty state.
 * Understated pills; clicking one types & sends the full query.
 * During the intro assembly the chips are tossed on with elastic
 * overshoot and a playful alternating tilt, tight enough to read as one
 * movement now that the cinematic has already placed the panel. The empty-state card now carries its own
 * living 3D ocean ribbon (Three.js).
 */

import { motion } from "framer-motion";
import { LifeBuoy, Fish, TriangleAlert, Route, CalendarDays } from "lucide-react";
import type { Language } from "@/types/orca";
import { SUGGESTED_QUERIES, t } from "@/lib/i18n";
import { useOrcaStore } from "@/lib/store";
import { useIntroGate, introDelay } from "@/lib/intro";
import { assemblyMotion } from "@/lib/assembly-motion";
import { OrcaMark } from "./MessageBubble";
import { OceanRibbon } from "@/components/intro/OceanRibbon";

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
  const { shown, fast, phase } = useIntroGate();

  return (
    <div className="flex flex-wrap gap-1.5">
      {SUGGESTED_QUERIES.map((q, i) => {
        const Icon = ICONS[q.icon];
        /* Assembly: elastic toss with alternating tilt. Later remounts: quick pop. */
        const inAssembly = phase === "assembly";
        const delay = inAssembly ? introDelay(fast, 0.14) + i * 0.045 : 0.04 + i * 0.045;
        const tilt = i % 2 === 0 ? -7 : 7;
        return (
          <motion.button
            key={q.icon}
            type="button"
            disabled={isProcessing}
            onClick={() => sendQuery(language === "hi" ? q.queryHi : q.query)}
            initial={{ opacity: 0, scale: 0.6, y: 14, rotate: tilt }}
            animate={
              shown
                ? { opacity: 1, scale: 1, y: 0, rotate: 0 }
                : { opacity: 0, scale: 0.6, y: 14, rotate: tilt }
            }
            transition={{
              delay,
              type: "spring",
              stiffness: inAssembly ? 320 : 430,
              damping: inAssembly ? 17 : 24,
            }}
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
  const { shown, fast, phase } = useIntroGate();
  const settled = phase === "done";

  // Two pieces of the intro's assembly: the greeting and the card each drift in on their own.
  return (
    <div className="flex flex-col gap-5 px-1 py-6">
      <motion.div className="flex gap-3" {...assemblyMotion("chatGreeting", shown, fast, settled)}>
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
      </motion.div>
      <motion.div className="relative overflow-hidden rounded-[10px] border border-ocean-line bg-white p-4 shadow-[0_1px_2px_rgba(23,35,45,0.04)]" {...assemblyMotion("chatCard", shown, fast, settled)}>
        {/* Calm tide line breathing under the empty-state card */}
        <span className="ocean-line-live absolute inset-x-0 bottom-0 h-[2px] opacity-60" aria-hidden />
        <h2 className="text-[14px] font-semibold text-ocean-ink">{t(language, "emptyStateTitle")}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ocean-slate">{t(language, "emptyStateSub")}</p>
        <div className="mt-3.5">
          <SuggestedQueries language={language} />
        </div>
        {/* A real piece of the sea — living 3D ocean ribbon */}
        <motion.div
          className="mt-3.5"
          initial={{ opacity: 0, scaleY: 0.4 }}
          animate={shown ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0.4 }}
          transition={{ delay: introDelay(fast, 0.28), duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "bottom" }}
        >
          <OceanRibbon className="h-14 w-full rounded-md border border-ocean-line/70" />
        </motion.div>
      </motion.div>
    </div>
  );
}
