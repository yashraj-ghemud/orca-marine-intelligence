/**
 * ORCA — Conversational layer types.
 * Messages, intents, synthesized answers, map deltas, alerts.
 */

import type { OrcaResult, TraceEntry } from "../lib/server/contracts";
import type {
  AgentId,
  AgentRun,
  EvidenceItem,
  LatLng,
  RegionId,
  RiskLevel,
} from "./marine";

export type Language = "en" | "hi" | "gu";

export type IntentKind =
  | "safety"
  | "pfz"
  | "hazard"
  | "route"
  | "conditions"
  | "unknown";

export type AppState = "idle" | "processing" | "answered" | "alert" | "error";

/* ── Map layer visibility ─────────────────────────────── */
export type MapLayerId =
  | "vessel"
  | "risk"
  | "cyclone"
  | "pfz"
  | "safe"
  | "route"
  | "boundary";

export type MapLayers = Record<MapLayerId, boolean>;

/** Declarative map change attached to an answer. */
export interface MapDelta {
  /** Where the map should fly */
  focus?:
    | { kind: "position"; position: LatLng; zoom?: number }
    | { kind: "bounds"; bounds: [LatLng, LatLng]; padding?: number[] };
  /** Layers to force-enable when this answer lands */
  enableLayers?: MapLayerId[];
  /** Layers to force-disable */
  disableLayers?: MapLayerId[];
}

export interface OrcaVerdict {
  kind: "risk" | "pfz" | "hazard" | "route" | "info";
  /** Headline, e.g. "HIGH MARINE RISK" */
  title: string;
  titleHi: string;
  riskLevel: RiskLevel;
  /** 1–2 sentence supporting line */
  summary: string;
  summaryHi: string;
}

export interface OrcaAnalysis {
  intent: IntentKind;
  /** e.g. "Safety check" */
  intentLabel: string;
  intentLabelHi: string;
  sources: string[];
  sourcesHi: string[];
  conclusion: string;
  conclusionHi: string;
}

export interface OrcaResponse {
  id: string;
  /** Provenance from the API envelope, not the current UI mode. */
  responseMode?: "demo" | "live";
  /** Request language at generation time; changing the UI does not translate history. */
  originalLanguage?: Language;
  intent: IntentKind;
  /** Simple ack line spoken before processing, e.g. "I'll check the marine conditions…" */
  ack: string;
  ackHi: string;
  verdict: OrcaVerdict;
  /** Compact metric chips shown inside the result card */
  evidence: EvidenceItem[];
  /** Bullet list: "Why this result?" */
  why: string[];
  whyHi: string[];
  /** Ordered agent pipeline for this query */
  agents: AgentRun[];
  /** Expanded "How ORCA reached this result" summary */
  analysis: OrcaAnalysis;
  map: MapDelta;
  /** Follow-up suggestion chips offered after the answer */
  followUps: { en: string; hi: string; query: string; queryHi: string }[];
  /** Simulated latency for the staged processing animation (ms per step) */
  stageMs?: number;
}

export type MessageKind =
  | "user"
  | "orca-text"
  | "orca-processing"
  | "orca-result"
  | "orca-system"
  | "error";

export interface ChatMessage {
  id: string;
  kind: MessageKind;
  text?: string;
  textHi?: string;
  textGu?: string;
  image?: string;
  responseMode?: "demo" | "live";
  originalLanguage?: Language;
  /** Retained per answer even after another request resets the active pipeline. */
  backendStatus?: OrcaResult["status"];
  pipelineTrace?: TraceEntry[];
  /** For processing messages: ordered stage ids */
  stages?: AgentId[];
  /** Active stage index while processing */
  activeStage?: number;
  /** Populated once processing completes → swaps to rendered response */
  response?: OrcaResponse;
  /** For system alert messages */
  alertId?: string;
  createdAt: number;
}

/* ── Proactive alerts ─────────────────────────────────── */
export interface MarineAlert {
  id: string;
  title: string;
  titleHi: string;
  body: string;
  bodyHi: string;
  severity: "advisory" | "warning" | "critical";
  regionId: RegionId;
  focus: { position: LatLng; zoom: number };
  enableLayers: MapLayerId[];
  createdAt: number;
}

/* ── Toasts ───────────────────────────────────────────── */
export type ToastTone = "info" | "success" | "warn" | "danger";

export interface OrcaToast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}
