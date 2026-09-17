import { z } from "zod";
import type { OrcaResponse } from "../../types/orca";

export const regions = ["mumbai", "goa", "kerala", "chennai"] as const;
export const languages = ["en", "hi", "gu"] as const;
export const domains = ["weather", "marine", "pfz", "geospatial"] as const;
export const engineNames = ["risk", "geospatial", "route"] as const;
export const sourceNames = ["incois", "copernicus", "weather"] as const;
export const intents = ["safety", "pfz", "hazard", "route", "conditions", "unknown"] as const;
export const riskSchema = z.enum(["low", "moderate", "high"]);
export type Domain = typeof domains[number];
export type EngineName = typeof engineNames[number];
export type SourceName = typeof sourceNames[number];
export type Language = typeof languages[number];
export type Mode = "demo" | "live";

// Only inline, canonical base64 raster images. Never fetch a client-supplied URL.
export const imageSchema = z.string().max(2_800_000).superRefine((value, ctx) => {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) {
    ctx.addIssue({ code: "custom", message: "image must be a PNG, JPEG or WebP base64 data URL" });
    return;
  }
  const bytes = Buffer.from(match[2], "base64");
  const signature = match[1] === "png"
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : match[1] === "jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!signature || bytes.length < 12 || bytes.length > 2_097_152 || bytes.toString("base64") !== match[2]) {
    ctx.addIssue({ code: "custom", message: "Invalid image signature, base64 encoding or size (maximum 2 MiB)" });
  }
});

export const requestSchema = z.object({
  query: z.string().trim().min(1).max(4000),
  regionId: z.enum(regions),
  language: z.enum(languages),
  mode: z.enum(["demo", "live"]),
  image: imageSchema.optional(),
}).strict();
export type OrcaRequest = z.infer<typeof requestSchema>;

const timestamp = z.iso.datetime({ offset: true });
const coordinate = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict();
const envelope = {
  mode: z.literal("live"),
  regionId: z.enum(regions),
  observedAt: timestamp,
  validUntil: timestamp,
};
export const incoisSchema = z.object({
  ...envelope,
  source: z.literal("incois"),
  data: z.object({
    center: coordinate,
    advisoryActive: z.boolean(),
    hazardSeverity: z.enum(["none", "moderate", "high", "severe"]),
    cycloneDistanceKm: z.number().min(0).max(30000).nullable(),
    boundaryStatus: z.enum(["clear", "restricted", "unknown"]),
    pfzAvailable: z.boolean(),
  }).strict(),
}).strict();
export const copernicusSchema = z.object({
  ...envelope,
  source: z.literal("copernicus"),
  data: z.object({
    waveHeightM: z.number().min(0).max(40),
    sstC: z.number().min(-3).max(45),
    chlorophyllMgM3: z.number().min(0).max(1000),
    currentKnots: z.number().min(0).max(30),
  }).strict(),
}).strict();
export const weatherSchema = z.object({
  ...envelope,
  source: z.literal("weather"),
  data: z.object({
    windKmph: z.number().min(0).max(500),
    gustKmph: z.number().min(0).max(500),
    visibilityKm: z.number().min(0).max(200),
  }).strict().refine(d => d.gustKmph >= d.windKmph, "gustKmph must be at least windKmph"),
}).strict();
export type Sources = {
  incois: z.infer<typeof incoisSchema>;
  copernicus: z.infer<typeof copernicusSchema>;
  weather: z.infer<typeof weatherSchema>;
};
export const evidenceIds = ["waves", "wind", "visibility", "sst", "chlorophyll", "current", "advisory", "hazards", "cyclone", "boundary", "pfz"] as const;
export type EvidenceId = typeof evidenceIds[number];
export const domainEvidence: Record<Domain, readonly EvidenceId[]> = {
  weather: ["wind", "visibility", "waves", "cyclone", "advisory"],
  marine: ["waves", "sst", "current", "advisory"],
  pfz: ["pfz", "sst", "chlorophyll"],
  geospatial: ["hazards", "cyclone", "boundary"],
};
const selection = z.array(z.enum(evidenceIds)).min(1).max(evidenceIds.length)
  .refine(ids => new Set(ids).size === ids.length, "Duplicate evidence IDs");

/**
 * A selection restricted to `allowed`. The JSON schema the model is shown
 * carries only these ids, and anything else it returns — an id from another
 * domain, a duplicate — is dropped before validation. Dropping can only
 * *reduce* what the model selected, so it hands the model no authority;
 * it just stops a stray id from failing a stage the fallback would then
 * repeat verbatim at temperature 0.
 */
export function selectionWithin(allowed: readonly EvidenceId[]) {
  const permitted = new Set<string>(allowed);
  const options = [...allowed] as [EvidenceId, ...EvidenceId[]];
  return z.preprocess(
    value => Array.isArray(value) ? [...new Set(value.filter(id => typeof id === "string" && permitted.has(id)))] : value,
    z.array(z.enum(options)).min(1).max(options.length),
  );
}
const engineBase = z.object({
  ...envelope,
  sourceObservations: z.object({ incois: timestamp, copernicus: timestamp, weather: timestamp }).strict(),
  riskLevel: riskSchema,
  evidenceIds: selection,
}).strict();
export const engineSchema = z.discriminatedUnion("engine", [
  engineBase.extend({ engine: z.literal("risk") }),
  engineBase.extend({ engine: z.literal("geospatial"), boundaryStatus: z.enum(["clear", "restricted", "unknown"]) }),
  engineBase.extend({ engine: z.literal("route"), routeStatus: z.enum(["not_evaluated", "blocked", "insufficient_context"]) }),
]);
export type EngineResult = z.infer<typeof engineSchema>;
export interface AgentAnnotation { domain: Domain; evidenceIds: EvidenceId[] }
export interface EngineRequest {
  mode: "live";
  regionId: OrcaRequest["regionId"];
  engine: EngineName;
  sourceObservations: EngineResult["sourceObservations"];
  sources: Sources;
  annotations: AgentAnnotation[];
  annotationsAuthority: "untrusted";
  riskFloor: "moderate" | "high";
  // Additive input: only earlier, schema/provenance/freshness-validated engine results.
  priorEngines: EngineResult[];
}
/** Prose that reads as a go/no-go call. The simple role has no marine data and may never imply one. */
const impliesClearance = /\b(safe|unsafe|ok|okay|fine|good|clear)\b[^.!?\n]{0,40}\b(to|for)\b[^.!?\n]{0,30}\b(sail|go out|depart|fish|leave|head out|venture)\b|\bno (?:marine )?risk\b|\b(?:calm|rough) seas? (?:today|tomorrow)\b/i;
const simpleReply = z.string().trim().min(1).max(700).refine(text => !impliesClearance.test(text), "Simple replies cannot assess marine safety");
export const simpleSchema = z.object({
  kind: z.enum(["greeting", "help", "chat"]),
  language: z.enum(languages),
  /** The reply in the requested language, written by the model. */
  reply: simpleReply,
  /** The same reply in Hindi, for the bilingual card. */
  replyHi: simpleReply,
}).strict();
export type SimpleKind = z.infer<typeof simpleSchema>["kind"];
export const plannerSchema = z.object({ intent: z.enum(intents) }).strict();
export const domainSchema = z.object({ evidenceIds: selection }).strict();
export const synthesisSchema = z.object({ evidenceIds: selection, answerKind: z.enum(["observations", "insufficient_context"]) }).strict();
export const responseSchema = z.object({ language: z.enum(languages), evidenceIds: selection }).strict();
export const visionSchema = z.object({
  scene: z.enum(["ocean", "chart", "document", "other", "unclear"]),
  limitation: z.literal("not_navigation_evidence"),
}).strict();
export type VisionResult = z.infer<typeof visionSchema>;

const text = z.string().min(1).max(16000);
const mapLayers = z.enum(["vessel", "risk", "cyclone", "pfz", "safe", "route", "boundary"]);
export const orcaResponseSchema: z.ZodType<OrcaResponse> = z.object({
  id: text, intent: z.enum(intents), ack: text, ackHi: text,
  verdict: z.object({ kind: z.enum(["risk", "pfz", "hazard", "route", "info"]), title: text, titleHi: text,
    riskLevel: riskSchema, summary: text, summaryHi: text }).strict(),
  evidence: z.array(z.object({ category: z.enum(["weather", "geospatial", "marine", "ocean"]), label: text,
    labelHi: text, value: text, valueHi: text.optional(), tone: z.enum(["neutral", "warn", "danger", "good", "info"]).optional() }).strict()).max(50),
  why: z.array(text).max(50), whyHi: z.array(text).max(50),
  agents: z.array(z.object({ id: z.enum(["intent", "weatherOcean", "geospatialRisk", "dataDiscovery", "verification", "synthesis"]),
    label: text, labelHi: text, status: z.enum(["pending", "active", "complete", "error"]), contribution: z.string().max(16000), contributionHi: z.string().max(16000) }).strict()).max(20),
  analysis: z.object({ intent: z.enum(intents), intentLabel: text, intentLabelHi: text, sources: z.array(text), sourcesHi: z.array(text), conclusion: text, conclusionHi: text }).strict(),
  map: z.object({
    focus: z.union([
      z.object({ kind: z.literal("position"), position: coordinate, zoom: z.number().optional() }).strict(),
      z.object({ kind: z.literal("bounds"), bounds: z.tuple([coordinate, coordinate]), padding: z.array(z.number()).optional() }).strict(),
    ]).optional(),
    enableLayers: z.array(mapLayers).optional(), disableLayers: z.array(mapLayers).optional(),
  }).strict(),
  followUps: z.array(z.object({ en: text, hi: text, query: text, queryHi: text }).strict()).max(20),
  stageMs: z.number().nonnegative().optional(),
}).strict();

export interface TraceEntry {
  stage: string;
  kind: "model" | "adapter" | "engine" | "validation" | "policy" | "demo";
  status: "success" | "error" | "skipped";
  durationMs: number;
  attempt?: number;
  provider?: "openrouter" | "groq";
  model?: string;
  fallback?: boolean;
  code?: string;
  detail?: string;
}
export type OrcaResult = {
  mode: Mode;
  response: OrcaResponse;
  trace: TraceEntry[];
  status: "ok" | "degraded";
} | {
  mode: Mode | null;
  response: null;
  trace: TraceEntry[];
  status: "error";
  error: { code: string; message: string; retryable: boolean; fields?: string[] };
};

export class OrcaError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly fields?: string[];
  /** Upstream's requested wait before another attempt, when it said so (429/503). */
  retryAfterMs?: number;
  constructor(code: string, message: string, httpStatus = 503, retryable = false, fields?: string[]) {
    super(message);
    this.name = "OrcaError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.fields = fields;
  }
}

export function safeError(error: unknown): OrcaError {
  return error instanceof OrcaError ? error : new OrcaError("INTERNAL_ERROR", "ORCA could not complete this request.", 500);
}
