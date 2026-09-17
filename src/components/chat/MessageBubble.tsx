"use client";

/**
 * ORCA — Message rendering: user bubbles, ORCA acks, system notes,
 * staged processing card and the evidence-backed result card.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TriangleAlert,
  Check,
  Loader2,
  ChevronDown,
  Waves,
  MapPin,
  Database,
  FileText,
  ScanSearch,
  Info,
  RotateCcw,
  ArrowUpRight,
  Anchor,
  Fish,
  Route as Route2,
} from "lucide-react";
import type { ChatMessage, Language, OrcaResponse } from "@/types/orca";
import type { AgentId } from "@/types/marine";
import { useOrcaStore } from "@/lib/store";
import { t } from "@/lib/i18n";

/* ── Shared bits ───────────────────────────────────────────── */

export function OrcaMark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[6px] bg-ocean-navy"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="10" r="4.4" stroke="#EAF4F8" strokeWidth="1.8" />
        <circle cx="12" cy="10" r="1.4" fill="#7FB3D5" />
        <path d="M4 18.4c1.9 0 1.9-1.5 3.8-1.5s1.9 1.5 3.8 1.5 1.9-1.5 3.8-1.5 1.9 1.5 3.8 1.5" stroke="#7FB3D5" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const AGENT_ICONS: Record<AgentId, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  intent: ScanSearch,
  weatherOcean: Waves,
  geospatialRisk: MapPin,
  dataDiscovery: Database,
  verification: Check,
  synthesis: FileText,
};

const TONE_STYLES = {
  danger: "text-ocean-danger-fg",
  warn: "text-ocean-warn-fg",
  good: "text-ocean-success",
  info: "text-ocean-blue",
  neutral: "text-ocean-ink",
} as const;

/* ── Simple bubbles ────────────────────────────────────────── */

/* ── Shared motion presets (spring physics, marine-smooth) ── */
const SPRING = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.9 };
const enterFromRight = {
  initial: { opacity: 0, x: 30, scale: 0.96 },
  animate: { opacity: 1, x: 0, scale: 1 },
  transition: SPRING,
};
const enterFromLeft = {
  initial: { opacity: 0, x: -22, scale: 0.97 },
  animate: { opacity: 1, x: 0, scale: 1 },
  transition: SPRING,
};

function UserBubble({ text, image }: { text: string; image?: string }) {
  return (
    <motion.div className="flex justify-end" {...enterFromRight}>
      <div className="max-w-[85%] rounded-[10px] rounded-br-[4px] border border-ocean-info bg-ocean-info px-3.5 py-2.5 text-[13px] leading-relaxed text-ocean-ink">
        {image && (
          // The attachment is an inline raster data URL, not a remote optimized image.
           
          <img src={image} alt="" className="mb-2 max-h-40 max-w-full rounded-md object-contain" />
        )}
        {text}
      </div>
    </motion.div>
  );
}

function OrcaTextBubble({ text }: { text: string }) {
  return (
    <motion.div className="flex gap-2.5" {...enterFromLeft}>
      <OrcaMark />
      <div className="max-w-[85%] rounded-[10px] rounded-tl-[4px] border border-ocean-line bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ocean-ink shadow-[0_1px_2px_rgba(23,35,45,0.04)]">
        {text}
      </div>
    </motion.div>
  );
}

function SystemBubble({ text, alert }: { text: string; alert?: boolean }) {
  return (
    <div className="msg-enter flex items-start gap-2 py-1">
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          alert ? "bg-ocean-danger" : "bg-ocean-info"
        }`}
      >
        {alert ? (
          <TriangleAlert className="h-3 w-3 text-ocean-danger-fg" strokeWidth={2.2} />
        ) : (
          <Info className="h-3 w-3 text-ocean-blue" strokeWidth={2.2} />
        )}
      </span>
      <p className={`text-[12px] leading-relaxed ${alert ? "text-ocean-danger-fg" : "text-ocean-slate"}`}>{text}</p>
    </div>
  );
}

function ErrorBubble({ text, lang, messageId }: { text: string; lang: Language; messageId: string }) {
  const retryLast = useOrcaStore((s) => s.retryLast);
  const isProcessing = useOrcaStore((s) => s.isProcessing);
  return (
    <motion.div className="flex gap-2.5" {...enterFromLeft}>
      <OrcaMark />
      <div className="max-w-[90%] rounded-[10px] rounded-tl-[4px] border border-ocean-danger-fg/25 bg-ocean-danger px-3.5 py-3">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ocean-danger-fg">
          <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.2} />
          {t(lang, "errorTitle")}
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ocean-ink/80">{text}</p>
        <button
          type="button"
          onClick={() => retryLast(messageId)}
          disabled={isProcessing}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-ocean-danger-fg/30 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-ocean-danger-fg transition-colors hover:bg-ocean-danger/70"
        >
          <RotateCcw className="h-3 w-3" strokeWidth={2.2} />
          {t(lang, "retry")}
        </button>
      </div>
    </motion.div>
  );
}

/* ── Processing card ───────────────────────────────────────── */

export function ProcessingCard({ msg, lang }: { msg: ChatMessage; lang: Language }) {
  return (
    <motion.div className="flex gap-2.5" {...enterFromLeft}>
      <OrcaMark />
      <div role="status" data-response-mode={msg.responseMode} className="w-full max-w-[92%] rounded-[10px] rounded-tl-[4px] border border-ocean-line bg-white px-3.5 py-3">
        <div className="flex items-center gap-2 text-[12px] font-medium text-ocean-blue">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t(lang, "processingTitle")}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ocean-slate">{t(lang, "requestProcessing")}</p>
      </div>
    </motion.div>
  );
}

/* ── Result card ───────────────────────────────────────────── */

function VerdictHeader({ response, lang }: { response: OrcaResponse; lang: Language }) {
  const { riskLevel, kind } = response.verdict;
  const styles =
    riskLevel === "high"
      ? { wrap: "border-ocean-danger-fg/25 bg-ocean-danger", text: "text-ocean-danger-fg", icon: TriangleAlert, bar: "#B42318" }
      : riskLevel === "moderate"
        ? { wrap: "border-ocean-warn-fg/25 bg-ocean-warn", text: "text-ocean-warn-fg", icon: TriangleAlert, bar: "#B45309" }
        : kind === "pfz"
          ? { wrap: "border-ocean-teal-fg/20 bg-ocean-teal", text: "text-ocean-teal-fg", icon: Fish, bar: "#0F766E" }
          : kind === "route"
            ? { wrap: "border-[#0E7490]/25 bg-[#EBF7FA]", text: "text-[#0E7490]", icon: Route2, bar: "#0E7490" }
            : { wrap: "border-ocean-info bg-ocean-info/60", text: "text-ocean-navy", icon: Info, bar: "#2F6F95" };
  const Icon = styles.icon;
  const meterVal = riskLevel === "high" ? 100 : riskLevel === "moderate" ? 62 : 34;
  const meterPct = `${meterVal}%`;
  return (
    <div className={`relative overflow-hidden rounded-t-[9px] border-b px-4 py-3 ${styles.wrap}`} style={{ borderLeft: `3px solid ${styles.bar}` }}>
      <div className="flex items-center gap-2">
        <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={2.3} />
        <h3 className={`text-[13.5px] font-semibold tracking-[0.045em] ${styles.text}`}>
          {lang === "hi" ? response.verdict.titleHi : response.verdict.title}
        </h3>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ocean-ink/75">
        {lang === "hi" ? response.verdict.summaryHi : response.verdict.summary}
      </p>
      {/* The prototype's numerical risk meter is illustrative, never live evidence. */}
      {response.responseMode === "demo" && <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-white/55">
        <div
          className="risk-fill h-full rounded-full"
          style={{ width: meterPct, background: styles.bar }}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meterVal}
          aria-label={`risk level ${riskLevel}`}
        />
      </div>}
    </div>
  );
}

function EvidenceGrid({ response, lang }: { response: OrcaResponse; lang: Language }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5">
      {response.evidence.map((e, i) => (
        <motion.div
          key={i}
          className="min-w-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 + i * 0.055, ...SPRING }}
        >
          <div className="data-label truncate">{lang === "hi" ? e.labelHi : e.label}</div>
          <div className={`data-value mt-0.5 text-[13.5px] font-medium leading-snug ${TONE_STYLES[e.tone ?? "neutral"]}`}>
            {(lang === "hi" && e.valueHi) ? e.valueHi : e.value}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function WhySection({ response, lang }: { response: OrcaResponse; lang: Language }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-ocean-line/80 px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-left"
        aria-expanded={open}
      >
        <span className="text-[11.5px] font-medium text-ocean-slate">{t(lang, "whyTitle")}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-ocean-slate transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={2.2} />
      </button>
      {open && (
        <AnimatePresence initial={false}>
          <motion.ul
            className="flex flex-col gap-1.5 overflow-hidden pb-1.5 pt-0.5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.8, 0.35, 1] }}
          >
            {((lang === "hi" ? response.whyHi : response.why) ?? []).map((w, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ocean-ink/75">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ocean-blue/70" />
                {w}
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      )}
    </div>
  );
}

function AnalysisSection({ response, lang }: { response: OrcaResponse; lang: Language }) {
  const [open, setOpen] = useState(false);
  const agents = response.agents.filter((a) => a.contribution);
  return (
    <div className="border-t border-ocean-line/80 px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-1 text-left"
        aria-expanded={open}
      >
        <span className="text-[11.5px] font-medium text-ocean-slate">
          {t(lang, "howReached")} <span className="text-ocean-slate/60">· {t(lang, "viewAnalysis")}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-ocean-slate transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={2.2} />
      </button>
      {open && (
        <AnimatePresence initial={false}>
          <motion.div
            className="flex flex-col gap-3 overflow-hidden pb-2 pt-1.5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.8, 0.35, 1] }}
          >
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <div className="data-label">{t(lang, "intent")}</div>
              <div className="mt-0.5 text-[12px] font-medium text-ocean-ink">
                {lang === "hi" ? response.analysis.intentLabelHi : response.analysis.intentLabel}
              </div>
            </div>
            <div>
              <div className="data-label">{t(lang, "conclusion")}</div>
              <div className="mt-0.5 text-[12px] font-medium text-ocean-ink">
                {lang === "hi" ? response.analysis.conclusionHi : response.analysis.conclusion}
              </div>
            </div>
            <div className="col-span-2">
              <div className="data-label">{t(lang, "sources")}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(lang === "hi" ? response.analysis.sourcesHi : response.analysis.sources).map((s, i) => (
                  <span key={i} className="rounded-[5px] border border-ocean-line bg-ocean-bg px-1.5 py-0.5 text-[10.5px] text-ocean-slate">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {agents.length > 0 && (
            <div className="rounded-lg border border-ocean-line/80 bg-ocean-bg/60 p-2.5">
              <div className="data-label mb-1.5">{t(lang, "agents")}</div>
              <ol className="flex flex-col gap-1.5">
                {agents.map((a) => {
                  const Icon = AGENT_ICONS[a.id];
                  return (
                    <li key={a.id} className="flex items-start gap-2 text-[11.5px] leading-snug">
                      <span className="mt-[1.5px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-white shadow-sm">
                        <Icon className="h-[10px] w-[10px] text-ocean-blue" strokeWidth={2} />
                      </span>
                      <span className="text-ocean-ink/80">{lang === "hi" ? a.contributionHi : a.contribution}</span>
                      <span className="ml-auto mt-[1px] flex shrink-0 items-center gap-1 text-[9.5px] uppercase tracking-wide text-ocean-success">
                        <Check className="h-2.5 w-2.5" strokeWidth={2.6} />
                        {t(lang, "agentRunComplete")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function FollowUps({ response, language }: { response: OrcaResponse; language: Language }) {
  const sendQuery = useOrcaStore((s) => s.sendQuery);
  if (response.followUps.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pl-[34px]">
      {response.followUps.map((f, i) => (
        <motion.button
          key={i}
          type="button"
          onClick={() => sendQuery(language === "hi" ? f.queryHi : f.query)}
          initial={{ opacity: 0, scale: 0.7, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.07, ...SPRING }}
          whileHover={{ scale: 1.05, y: -1 }}
          whileTap={{ scale: 0.95 }}
          className="group inline-flex items-center gap-1 rounded-full border border-ocean-line bg-white px-2.5 py-[5px] text-[11.5px] text-ocean-blue transition-colors hover:border-ocean-blue/40 hover:bg-ocean-info"
        >
          {language === "hi" ? f.hi : f.en}
          <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2.2} />
        </motion.button>
      ))}
    </div>
  );
}

const resultCopy = {
  en: { original: "Original answer language", trace: "Pipeline trace", empty: "No trace was returned for this answer.", fallback: "Fallback", attempt: "Attempt", success: "Success", error: "Error", skipped: "Skipped", languages: { en: "English", hi: "Hindi", gu: "Gujarati" } },
  hi: { original: "मूल उत्तर की भाषा", trace: "पाइपलाइन ट्रेस", empty: "इस उत्तर के लिए कोई ट्रेस नहीं मिला।", fallback: "फ़ॉलबैक", attempt: "प्रयास", success: "सफल", error: "त्रुटि", skipped: "छोड़ा गया", languages: { en: "अंग्रेज़ी", hi: "हिन्दी", gu: "गुजराती" } },
  gu: { original: "મૂળ જવાબની ભાષા", trace: "પાઇપલાઇન ટ્રેસ", empty: "આ જવાબ માટે કોઈ ટ્રેસ મળ્યો નથી.", fallback: "ફોલબેક", attempt: "પ્રયાસ", success: "સફળ", error: "ભૂલ", skipped: "છોડી દીધું", languages: { en: "અંગ્રેજી", hi: "હિન્દી", gu: "ગુજરાતી" } },
};

function ResultMetadata({ msg, lang }: { msg: ChatMessage; lang: Language }) {
  const copy = resultCopy[lang];
  const degraded = msg.backendStatus === "degraded";
  const trace = msg.pipelineTrace ?? [];
  if (!degraded && !msg.originalLanguage && trace.length === 0) return null;
  return (
    <div lang={lang} data-backend-status={msg.backendStatus} className="space-y-2 border-b border-ocean-line/80 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {degraded && <span className="inline-flex items-center gap-1 rounded-full border border-ocean-warn-fg/25 bg-ocean-warn px-2 py-1 text-[10.5px] font-semibold text-ocean-warn-fg">
          <TriangleAlert aria-hidden className="h-3 w-3" />
          {t(lang, "analysisDegraded")}
        </span>}
        {msg.originalLanguage && <span className="text-[10.5px] text-ocean-slate">{copy.original}: {copy.languages[msg.originalLanguage]}</span>}
      </div>
      {(degraded || trace.length > 0) && <details className="rounded-md border border-ocean-line bg-ocean-bg/60 px-2.5 py-2">
        <summary className="cursor-pointer text-[11.5px] font-medium text-ocean-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue">{copy.trace} ({trace.length})</summary>
        {trace.length === 0 ? <p className="mt-2 text-[11px] text-ocean-slate">{copy.empty}</p> : <ol className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto">
          {trace.map((entry, i) => <li key={i} className="break-words border-t border-ocean-line/70 pt-2 text-[11px] leading-relaxed text-ocean-slate">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <span className="font-medium text-ocean-ink">{entry.stage} / {entry.kind}</span>
              <span className={entry.status === "error" ? "text-ocean-warn-fg" : "text-ocean-slate"}>{copy[entry.status]} · {entry.durationMs} ms</span>
            </div>
            {(entry.provider || entry.model) && <p>{[entry.provider, entry.model].filter(Boolean).join(" / ")}</p>}
            {(entry.attempt !== undefined || entry.fallback) && <p>{[entry.attempt !== undefined ? `${copy.attempt} ${entry.attempt}` : "", entry.fallback ? copy.fallback : ""].filter(Boolean).join(" · ")}</p>}
            {entry.code && <p className="font-mono">{entry.code}</p>}
            {entry.detail && <p>{entry.detail}</p>}
          </li>)}
        </ol>}
      </details>}
    </div>
  );
}

export function ResultCard({ response, lang, msg }: { response: OrcaResponse; lang: Language; msg: ChatMessage }) {
  const applyMapDelta = useOrcaStore((s) => s.applyMapDelta);
  const setActiveResponse = useOrcaStore((s) => s.setActiveResponse);
  const pushToast = useOrcaStore((s) => s.pushToast);
  const language = useOrcaStore((s) => s.language);
  const demoMode = useOrcaStore((s) => s.demoMode);
  const answerLanguage = msg.originalLanguage ?? lang;

  const onViewEvidence = () => {
    if ((response.responseMode ?? "demo") !== (demoMode ? "demo" : "live")) return;
    setActiveResponse(response);
    applyMapDelta(response.map);
    if (demoMode) {
      pushToast("info", t(language, "mapUpdated"));
    }
  };

  const burstColor =
    response.verdict.riskLevel === "high"
      ? "#B42318"
      : response.verdict.riskLevel === "moderate"
        ? "#B45309"
        : response.verdict.kind === "pfz"
          ? "#0F766E"
          : "#0E7490";

  return (
    <motion.div
      className="relative flex flex-col gap-2"
      initial={{ opacity: 0, y: 18, scale: 0.965 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
    >
      <div className="flex gap-2.5">
        <OrcaMark />
        {/* Signature reveal — one-shot verdict burst ring */}
        <div lang={answerLanguage} className="relative min-w-0 w-full max-w-[94%] overflow-hidden rounded-[10px] rounded-tl-[4px] border border-ocean-line bg-white shadow-[0_1px_3px_rgba(23,35,45,0.05)]">
          <span className="burst-ring" style={{ "--burst-color": burstColor } as React.CSSProperties} aria-hidden />
          <ResultMetadata msg={msg} lang={lang} />
          <VerdictHeader response={response} lang={answerLanguage} />
          <EvidenceGrid response={response} lang={answerLanguage} />
          <WhySection response={response} lang={answerLanguage} />
          <AnalysisSection response={response} lang={answerLanguage} />
          <div lang={lang} className="flex items-center justify-between gap-2 border-t border-ocean-line/80 bg-ocean-bg/50 px-4 py-2">
            <span className="text-[10px] uppercase tracking-[0.07em] text-ocean-slate/80">
              {t(lang, response.responseMode === "live" ? "liveConfidenceNote" : response.responseMode === "demo" ? "confidenceNote" : "unknownConfidenceNote")}
            </span>
            <button
              type="button"
              onClick={onViewEvidence}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ocean-navy px-2.5 py-1.5 text-[11px] font-medium text-white transition-all hover:bg-ocean-blue active:scale-[0.98]"
            >
              <Anchor className="h-3 w-3" strokeWidth={2.2} />
              {t(lang, "viewEvidence")}
            </button>
          </div>
        </div>
      </div>
      <FollowUps response={response} language={answerLanguage} />
    </motion.div>
  );
}

/* ── Dispatcher ────────────────────────────────────────────── */

export function MessageView({ msg, lang }: { msg: ChatMessage; lang: Language }) {
  const answerLanguage = msg.originalLanguage ?? lang;
  switch (msg.kind) {
    case "user":
      return <UserBubble text={msg.text ?? ""} image={msg.image} />;
    case "orca-text":
      return <OrcaTextBubble text={(answerLanguage === "hi" ? msg.textHi : answerLanguage === "gu" ? msg.textGu : msg.text) ?? msg.text ?? ""} />;
    case "orca-processing":
      return <ProcessingCard msg={msg} lang={lang} />;
    case "orca-result":
      return msg.response ? <ResultCard response={msg.response} lang={lang} msg={msg} /> : null;
    case "orca-system":
      return <SystemBubble text={(lang === "hi" ? msg.textHi : lang === "gu" ? msg.textGu : msg.text) ?? msg.text ?? ""} alert={Boolean(msg.alertId)} />;
    case "error":
      return <ErrorBubble text={msg.text ?? ""} lang={lang} messageId={msg.id} />;
    default:
      return null;
  }
}
