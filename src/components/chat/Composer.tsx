"use client";

/**
 * ORCA — Composer: text input, voice stub, send. Enter to send.
 * Subtle focus state; send activates only with content.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowUp, Square, ImagePlus, X, Volume2 } from "lucide-react";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { useIntroGate, introDelay } from "@/lib/intro";
import { canRecord, Recorder, speak, stopSpeaking, transcribe } from "@/lib/speech";
import { assemblyMotion } from "@/lib/assembly-motion";

export function Composer() {
  const sessionRevision = useOrcaStore((s) => s.sessionRevision);
  return <ComposerDraft key={sessionRevision} />;
}

function ComposerDraft() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  /** idle → listening (mic open) → thinking (transcribing) → idle */
  const [mic, setMic] = useState<"idle" | "listening" | "thinking">("idle");
  const recorder = useRef<Recorder | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<FileReader | null>(null);
  const composing = useRef(false);
  const [readingImage, setReadingImage] = useState(false);
  const sendQuery = useOrcaStore((s) => s.sendQuery);
  const isProcessing = useOrcaStore((s) => s.isProcessing);
  const language = useOrcaStore((s) => s.language);
  const pushToast = useOrcaStore((s) => s.pushToast);
  const demoMode = useOrcaStore((s) => s.demoMode);
  const queryImage = useOrcaStore((s) => s.queryImage);
  const setQueryImage = useOrcaStore((s) => s.setQueryImage);
  const cancelQuery = useOrcaStore((s) => s.cancelQuery);

  const FULL_PH = t(language, "askPlaceholder");

  useEffect(() => () => readerRef.current?.abort(), []);

  const attachImage = (file?: File) => {
    if (!file || demoMode || isProcessing) return;
    readerRef.current?.abort();
    setReadingImage(false);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size === 0 || file.size > 2 * 1024 * 1024) {
      pushToast("warn", t(language, "imageInvalid"));
      return;
    }
    const token = useOrcaStore.getState().runToken;
    const reader = new FileReader();
    readerRef.current = reader;
    setReadingImage(true);
    reader.onload = () => {
      const state = useOrcaStore.getState();
      if (readerRef.current !== reader) return;
      setReadingImage(false);
      if (state.runToken === token && !state.demoMode && typeof reader.result === "string") setQueryImage(reader.result);
    };
    reader.onerror = () => {
      if (readerRef.current !== reader) return;
      setReadingImage(false);
      pushToast("warn", t(language, "imageReadFailed"));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    readerRef.current?.abort();
    readerRef.current = null;
    setReadingImage(false);
    setQueryImage(null);
  };

  /* Typewriter placeholder — the console keys itself in after docking.
     Deterministic initial render (null → full text on server AND first
     client paint); typing begins only after mount. Language switches
     reset the typing via the official adjust-during-render pattern. */
  const [typedPh, setTypedPh] = useState<string | null>(null);
  const [prevLang, setPrevLang] = useState(language);
  if (prevLang !== language) {
    setPrevLang(language);
    setTypedPh(null);
  }
  const { shown, fast, phase } = useIntroGate();

  useEffect(() => {
    if (!shown || fast) return;
    let i = 0;
    let iv = 0;
    const start = window.setTimeout(
      () => {
        iv = window.setInterval(() => {
          i += 1;
          setTypedPh(FULL_PH.slice(0, i));
          if (i >= FULL_PH.length) window.clearInterval(iv);
        }, 46);
      },
      introDelay(fast, 2.6) * 1000,
    );
    return () => {
      window.clearTimeout(start);
      window.clearInterval(iv);
    };
  }, [shown, fast, FULL_PH]);

  const placeholder = typedPh ?? FULL_PH;

  const submit = () => {
    const v = value.trim();
    if (!v || isProcessing || readingImage) return;
    sendQuery(v, !demoMode && queryImage ? queryImage : undefined);
    setValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /* Voice in: tap to listen, tap again to send. The transcript is sent as a
     spoken question, which is what makes the answer come back as voice too. */
  const toggleMic = async () => {
    if (mic === "thinking" || isProcessing) return;
    if (!canRecord()) { pushToast("info", t(language, "voiceUnavailable")); return; }
    if (mic === "listening") {
      const clip = await recorder.current?.stop();
      recorder.current = null;
      setMic("thinking");
      try {
        if (!clip || clip.size < 1200) throw new Error(t(language, "voiceHeard"));
        const text = await transcribe(clip, language);
        setValue("");
        sendQuery(text, !demoMode && queryImage ? queryImage : undefined, { spoken: true });
      } catch (error) {
        pushToast("warn", error instanceof Error && error.message ? error.message : t(language, "voiceHeard"));
      } finally {
        setMic("idle");
      }
      return;
    }
    stopSpeaking();
    setSpeaking(false);
    try {
      const next = new Recorder();
      await next.start();
      recorder.current = next;
      setMic("listening");
    } catch {
      pushToast("warn", t(language, "voiceDenied"));
    }
  };

  useEffect(() => () => { recorder.current?.cancel(); stopSpeaking(); }, []);

  /* Voice out: read a spoken question's answer once, then forget it. A store
     subscription rather than a render effect, so playback is driven by the
     answer arriving, not by this component re-rendering. */
  useEffect(() => useOrcaStore.subscribe((state, previous) => {
    const reply = state.voiceReply;
    if (!reply || reply === previous.voiceReply) return;
    useOrcaStore.getState().clearVoiceReply();
    setSpeaking(true);
    void speak(reply.text, reply.language).finally(() => setSpeaking(false));
  }), []);

  const canSend = value.trim().length > 0 && !isProcessing && !readingImage;

  return (
    <motion.div
      className="relative z-10 shrink-0 border-t border-ocean-line bg-white px-3 pb-3 pt-2.5"
      {...assemblyMotion("composer", shown, fast, phase === "done")}
    >
      {/* Arrival glow — the composer surfaces with a pulse of light */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(47,111,149,0.85), transparent)" }}
        initial={{ opacity: 0, scaleX: 0.3 }}
        animate={shown ? { opacity: [0, 0.9, 0.25], scaleX: 1 } : { opacity: 0, scaleX: 0.3 }}
        transition={{ delay: introDelay(fast, 1.35), duration: 1.1, ease: "easeOut" }}
      />
      {queryImage && !demoMode && (
        <div className="mb-2 flex items-center gap-2">
          {/* Inline user-supplied raster data cannot use the Next image optimizer. */}
          { }
          <img src={queryImage} alt={t(language, "attachImage")} className="h-16 w-16 rounded-md border border-ocean-line object-cover" />
          <button type="button" onClick={removeImage} aria-label={t(language, "removeImage")} className="rounded-md p-2 text-ocean-slate hover:bg-ocean-info">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label={t(language, "attachImage")} disabled={demoMode || isProcessing} onChange={(e) => {
        attachImage(e.target.files?.[0]);
        e.target.value = "";
      }} />
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
          maxLength={4000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !composing.current && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          aria-label={t(language, "askPlaceholder") ?? "Ask ORCA"}
          className="orca-scroll max-h-[96px] min-h-[56px] min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[13px] leading-snug text-ocean-ink outline-none placeholder:text-ocean-slate/70"
        />
        <button type="button" disabled={demoMode || isProcessing || readingImage}
          title={t(language, demoMode ? "imageNeedsLive" : "imageHint")}
          aria-label={t(language, "attachImage")}
          onClick={() => fileRef.current?.click()}
          className="mb-[5px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-ocean-slate hover:bg-ocean-info disabled:cursor-not-allowed disabled:opacity-40">
          <ImagePlus className="h-[15px] w-[15px]" />
        </button>
        {speaking && (
          <button
            type="button"
            title={t(language, "voiceStop")}
            aria-label={t(language, "voiceStop")}
            onClick={() => { stopSpeaking(); setSpeaking(false); }}
            className="mic-pulse mb-[5px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-ocean-info text-ocean-navy transition-colors hover:bg-ocean-teal"
          >
            <Volume2 className="h-[15px] w-[15px]" strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          title={t(language, mic === "listening" ? "voiceListening" : "voiceStart")}
          aria-label={t(language, mic === "listening" ? "voiceListening" : "voiceStart")}
          aria-pressed={mic === "listening"}
          disabled={mic === "thinking" || isProcessing}
          onClick={toggleMic}
          className={`mb-[5px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-wait disabled:opacity-60 ${
            mic === "listening" ? "mic-pulse bg-ocean-danger text-ocean-danger-fg hover:bg-ocean-danger"
            : mic === "thinking" ? "bg-ocean-info text-ocean-navy"
            : "text-ocean-slate hover:bg-ocean-info hover:text-ocean-navy"
          }`}
        >
          {mic === "thinking"
            ? <span className="stage-spin inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent" />
            : <Mic className="h-[15px] w-[15px]" strokeWidth={2} />}
        </button>
        <motion.button
          type="button"
          aria-label={t(language, isProcessing ? "cancel" : "send")}
          title={t(language, isProcessing ? "cancel" : "send")}
          disabled={!isProcessing && !canSend}
          onClick={isProcessing ? cancelQuery : submit}
          whileHover={canSend ? { scale: 1.1 } : undefined}
          whileTap={canSend ? { scale: 0.88 } : undefined}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
          className={`mb-[5px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${
            canSend || isProcessing
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
          {t(language, "languagesSupported")}
        </span>
        <span lang={language} className="font-mono text-[9.5px] text-ocean-slate/50">{t(language, "composerKeys")}</span>
      </div>
      <p className="mt-1 px-1 text-[10px] text-ocean-slate">{t(language, demoMode ? "imageNeedsLive" : "imageHint")}</p>
    </motion.div>
  );
}
