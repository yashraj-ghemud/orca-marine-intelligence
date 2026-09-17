import type { ChatMessage } from "@/types/orca";

interface ExportContext {
  mode: "demo" | "live";
  region: string;
  exportedAt?: Date;
}

const LANGUAGES = { en: "English (en)", hi: "Hindi (hi)", gu: "Gujarati (gu)" };

function safeText(value: string): string {
  return value.replace(/\r\n?/g, "\n")
    // Strip invisible control/bidi characters without losing multiline Unicode text.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/([\\`*_{}\[\]()#+.!|~-])/g, "\\$1");
}

function dateText(value: number | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toISOString();
}

/** Deliberate allowlist: never serialize response objects, traces, images or request internals. */
export function formatConversation(messages: readonly ChatMessage[], context: ExportContext): string {
  const lines = [
    "# ORCA Conversation",
    "",
    `Exported: ${dateText(context.exportedAt ?? new Date())}`,
    `Workspace mode: ${context.mode === "demo" ? "DEMO DATA (simulated)" : "LIVE (availability is not guaranteed)"}`,
    `Monitored region: ${safeText(context.region)}`,
    "",
    "> Research/demo record only. Not a certified marine safety or navigation service. Do not use for navigation or departure decisions; consult official marine advisories.",
    "",
    "Original request languages are retained; export does not translate history. Demo Gujarati answers may contain English fallback text. Attachments and internal pipeline traces are omitted.",
  ];
  for (const message of messages) {
    const response = message.kind === "orca-result" ? message.response : undefined;
    const language = message.originalLanguage ?? response?.originalLanguage;
    const mode = message.responseMode ?? response?.responseMode;
    const role = message.kind === "user" ? "You" : message.kind === "error" ? "ORCA error" : message.kind === "orca-system" ? "System note" : "ORCA";
    lines.push("", `## ${role} | ${dateText(message.createdAt)}`, "",
      `Mode: ${mode === "demo" ? "DEMO DATA (simulated)" : mode === "live" ? "LIVE" : "Not recorded"}`,
      `Original language: ${language ? LANGUAGES[language] : "Not recorded"}`);
    if (message.backendStatus) lines.push(`Response status: ${safeText(message.backendStatus)}`);
    const text = message.kind === "user" || message.kind === "error" ? message.text
      : (language === "hi" ? message.textHi : language === "gu" ? message.textGu : message.text) ?? message.text;
    if (text) lines.push("", safeText(text));
    if (message.image) lines.push("", "[Attachment omitted]");
    if (message.kind === "orca-processing") lines.push("", "Request pending; no result available.");
    if (!response) continue;
    const hi = language === "hi";
    lines.push("", "### Verdict", "", safeText((hi && response.verdict.titleHi) || response.verdict.title),
      "", safeText((hi && response.verdict.summaryHi) || response.verdict.summary),
      "", `Risk level: ${safeText(response.verdict.riskLevel)}`, "", "### Evidence", "");
    for (const evidence of response.evidence) {
      lines.push(`- ${safeText((hi && evidence.labelHi) || evidence.label)}: ${safeText((hi && evidence.valueHi) || evidence.value)}`);
    }
    if (!response.evidence.length) lines.push("No evidence recorded.");
    const why = hi && response.whyHi.length ? response.whyHi : response.why;
    lines.push("", "### Why this result?", "", ...why.map(reason => `- ${safeText(reason)}`));
    if (!why.length) lines.push("No explanation recorded.");
  }
  return `${lines.join("\n")}\n`;
}

export function downloadConversation(messages: readonly ChatMessage[], context: ExportContext): void {
  if (!messages.length || messages.some(message => message.kind === "orca-processing")) return;
  const exportedAt = context.exportedAt ?? new Date();
  const blob = new Blob([formatConversation(messages, { ...context, exportedAt })], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `orca-conversation-${context.mode}-${dateText(exportedAt).slice(0, 10).replace(/[^0-9-]/g, "") || "undated"}.md`;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Allow the browser to consume the download before releasing its object URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
