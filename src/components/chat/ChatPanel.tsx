"use client";

/**
 * ORCA — Left conversation rail: header, scrolling message list,
 * composer pinned at the bottom. Every message here comes from a real
 * /api/orca round trip — there is no scripted or seeded conversation. Ambient deep-water bubbles drift
 * up behind the conversation; layered tide waves meet the composer.
 */

import { useEffect, useRef } from "react";
import { Download, MessageSquarePlus } from "lucide-react";
import type { Language } from "@/types/orca";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useIntroGate, useMotionPreference } from "@/lib/intro";
import { assemblyMotion } from "@/lib/assembly-motion";
import { motion } from "framer-motion";
import { MessageView } from "./MessageBubble";
import { Composer } from "./Composer";
import { ChatEmptyState } from "./SuggestedQueries";
import { downloadConversation } from "@/lib/export-conversation";
import { getRegion } from "@/lib/mock-marine-data";

/* Deterministic bubble field — no Math.random (SSR-safe) */
const BUBBLES = [
  { left: "6%", size: 7, d: 19, delay: 0, o: 0.4, x: 10 },
  { left: "15%", size: 4, d: 24, delay: 6, o: 0.28, x: -8 },
  { left: "26%", size: 9, d: 17, delay: 11, o: 0.46, x: 14 },
  { left: "38%", size: 5, d: 26, delay: 3, o: 0.24, x: -10 },
  { left: "52%", size: 6, d: 21, delay: 14, o: 0.36, x: 9 },
  { left: "64%", size: 4, d: 27, delay: 8, o: 0.28, x: -12 },
  { left: "75%", size: 8, d: 18, delay: 17, o: 0.42, x: 12 },
  { left: "86%", size: 5, d: 23, delay: 5, o: 0.3, x: -9 },
  { left: "94%", size: 6, d: 25, delay: 20, o: 0.32, x: 7 },
];

/* One seamless wave period = 120 units; path spans 2400 (2×) so a -50% slide loops perfectly */
const WAVE_PATH =
  "M0 24 Q 30 12 60 24 T 120 24 T 180 24 T 240 24 T 300 24 T 360 24 T 420 24 T 480 24 T 540 24 T 600 24 T 660 24 T 720 24 T 780 24 T 840 24 T 900 24 T 960 24 T 1020 24 T 1080 24 T 1140 24 T 1200 24 T 1260 24 T 1320 24 T 1380 24 T 1440 24 T 1500 24 T 1560 24 T 1620 24 T 1680 24 T 1740 24 T 1800 24 T 1860 24 T 1920 24 T 1980 24 T 2040 24 T 2100 24 T 2160 24 T 2220 24 T 2280 24 T 2340 24 T 2400 24 V 40 H 0 Z";

export function ChatPanel({ language }: { language: Language }) {
  const messages = useOrcaStore((s) => s.messages);
  const newSession = useOrcaStore((s) => s.newSession);
  const isProcessing = useOrcaStore((s) => s.isProcessing);
  const exportLabel = { en: "Export conversation", hi: "बातचीत निर्यात करें", gu: "વાતચીત નિકાસ કરો" }[language];
  const canExport = messages.some(m => m.kind !== "orca-system") && !isProcessing && !messages.some(m => m.kind === "orca-processing");
  const reduced = useMotionPreference();
  const { shown, fast, phase } = useIntroGate();
  const settled = phase === "done";
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    /* Don't auto-scroll on a fresh empty conversation — let the greeting lead */
    const latest = messages.at(-1);
    if (!el || !latest || (!stickToBottom.current && latest.kind !== "orca-processing")) return;
    const frame = requestAnimationFrame(() => {
      const card = el.querySelector<HTMLElement>(`[data-message-id="${latest.id}"]`);
      const top = latest.kind === "orca-result" && card
        ? card.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 10
        : el.scrollHeight;
      el.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, reduced]);

  return (
    <section
      aria-label={t(language, "conversation")}
      className="relative flex h-full min-w-0 flex-col overflow-hidden border-r border-ocean-line bg-ocean-bg"
    >
      {/* Deep-water ambience — bubbles rise behind the conversation */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        {BUBBLES.map((b, i) => (
          <span
            key={i}
            className="chat-bubble"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              "--bubble-d": `${b.d}s`,
              "--bubble-delay": `${b.delay}s`,
              "--bubble-o": b.o,
              "--bubble-x": `${b.x}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Panel header — its own piece of the assembly */}
      <motion.div className="relative z-10 flex h-[42px] shrink-0 items-center justify-between border-b border-ocean-line bg-white/70 px-4 backdrop-blur-[2px]" {...assemblyMotion("chatHeader", shown, fast, settled)}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ocean-slate">
          {t(language, "conversation")}
        </h2>
        <div className="flex items-center gap-1">
        <button
          type="button"
          title={exportLabel}
          aria-label={exportLabel}
          disabled={!canExport}
          onClick={() => {
            const state = useOrcaStore.getState();
            if (state.isProcessing || !state.messages.some(m => m.kind !== "orca-system")) return;
            downloadConversation(state.messages, { mode: state.demoMode ? "demo" : "live", region: getRegion(state.regionId).name });
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ocean-slate transition-colors hover:bg-ocean-info hover:text-ocean-navy focus-visible:outline-2 focus-visible:outline-ocean-blue disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={newSession}
          title={t(language, "newSession")}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-ocean-slate transition-colors hover:bg-ocean-info hover:text-ocean-navy"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={2} />
          {t(language, "newSession")}
        </button>
        </div>
      </motion.div>

      {/* Mission controls remain reachable by scrolling, without shrinking messages. */}
      <div ref={scrollRef} className="orca-scroll relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-3.5 pb-4 pt-3">
          {(() => {
            const hasConversation = messages.some((m) => m.kind !== "orca-system");
            if (!hasConversation) {
              const notes = messages.filter((m) => m.kind === "orca-system");
              return (
                <>
                  {notes.map((m) => (
                    <MessageView key={m.id} msg={m} lang={language} />
                  ))}
                  <ChatEmptyState language={language} />
                </>
              );
            }
            return (
              <div className="flex flex-col gap-3.5">
                {messages.map((m) => (
                  <div key={m.id} data-message-id={m.id}><MessageView msg={m} lang={language} /></div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tide meeting the shore — two parallax wave bands above the composer */}
      <div className="pointer-events-none relative z-10 h-[20px] shrink-0" aria-hidden>
        <span className="absolute inset-0 overflow-hidden">
          <svg
            className="wave-strip"
            style={{ "--wave-d": "17s" } as React.CSSProperties}
            viewBox="0 0 2400 40"
            preserveAspectRatio="none"
          >
            <path d={WAVE_PATH} fill="#2F6F95" opacity="0.16" />
          </svg>
        </span>
        <span className="absolute inset-0 overflow-hidden">
          <svg
            className="wave-strip"
            style={{ "--wave-d": "9.5s" } as React.CSSProperties}
            viewBox="0 0 2400 40"
            preserveAspectRatio="none"
          >
            <path d={WAVE_PATH} fill="#124E78" opacity="0.11" />
          </svg>
        </span>
      </div>

      <Composer />
    </section>
  );
}
