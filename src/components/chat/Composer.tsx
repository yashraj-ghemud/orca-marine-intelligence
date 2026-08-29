"use client";

/**
 * ORCA — Composer: text input, voice stub, send. Enter to send.
 * Subtle focus state; send activates only with content.
 */

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowUp, Square } from "lucide-react";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export function Composer() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [micLive, setMicLive] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendQuery = useOrcaStore((s) => s.sendQuery);
  const isProcessing = useOrcaStore((s) => s.isProcessing);
  const language = useOrcaStore((s) => s.language);
  const pushToast = useOrcaStore((s) => s.pushToast);

  const submit = useCallback(() => {
    const v = value.trim();
    if (!v || isProcessing) return;
    sendQuery(v);
    setValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [value, isProcessing, sendQuery]);

  const fakeMic = () => {
    pushToast("info", t(language, "voiceUnavailable"));
    setMicLive(true);
    window.setTimeout(() => setMicLive(false), 1700);
  };

  const canSend = value.trim().length > 0 && !isProcessing;

  return (
    <div className="relative z-10 border-t border-ocean-line bg-white px-3 pb-3 pt-2.5">
      <div
        className={`relative flex items-end gap-1.5 rounded-[10px] border bg-white pl-3 pr-1.5 transition-all duration-150 ${
          focused
            ? "border-ocean-blue/70 shadow-[0_0_0_3px_rgba(47,111,149,0.12)]"
            : "border-ocean-line hover:border-ocean-slate/50"
        }`}
      >
        {/* Tide line — glowing gradient wakes up on focus */}
        <span
          aria-hidden
          className={`ocean-line-live absolute inset-x-2 -bottom-px h-[2px] rounded-full transition-opacity duration-300 ${
            focused ? "opacity-90" : "opacity-0"
          }`}
        />
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={language === "hi" ? t("hi", "askPlaceholder") : t("en", "askPlaceholder")}
          aria-label={t(language, "askPlaceholder") ?? "Ask ORCA"}
          className="orca-scroll max-h-[96px] min-h-[38px] flex-1 resize-none bg-transparent py-2.5 text-[13px] leading-snug text-ocean-ink outline-none placeholder:text-ocean-slate/70"
        />
        <button
          type="button"
          title={t(language, "voiceInput")}
          aria-label={t(language, "voiceInput")}
          onClick={fakeMic}
          className={`mb-[5px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-ocean-slate transition-colors hover:bg-ocean-info hover:text-ocean-navy ${
            micLive ? "mic-pulse bg-ocean-info text-ocean-navy" : ""
          }`}
        >
          <Mic className="h-[15px] w-[15px]" strokeWidth={2} />
        </button>
        <motion.button
          type="button"
          aria-label={t(language, "send")}
          title={t(language, "send")}
          disabled={!canSend}
          onClick={submit}
          whileHover={canSend ? { scale: 1.1 } : undefined}
          whileTap={canSend ? { scale: 0.88 } : undefined}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
          className={`mb-[5px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
            canSend
              ? "bg-ocean-navy text-white shadow-sm hover:bg-ocean-blue"
              : "cursor-not-allowed bg-muted text-ocean-slate/40"
          }`}
        >
          {isProcessing ? (
            <Square className="soft-blink h-[13px] w-[13px]" strokeWidth={2.2} />
          ) : (
            <ArrowUp className="h-[15px] w-[15px]" strokeWidth={2.4} />
          )}
        </motion.button>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <span className="text-[9.5px] uppercase tracking-[0.08em] text-ocean-slate/60">
          {language === "hi" ? "अंग्रेजी या हिन्दी में पूछें" : "English / हिन्दी supported"}
        </span>
        <span className="font-mono text-[9.5px] text-ocean-slate/50">↵ send · ⇧↵ newline</span>
      </div>
    </div>
  );
}
