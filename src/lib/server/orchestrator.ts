import { z } from "zod";
import { loadConfig, loadSimpleConfig } from "./config";
import type { Env } from "./config";
import { assertFresh, deterministicRisk, getEngines, getSources } from "./adapters";
import {
  domainEvidence, domains, OrcaError, orcaResponseSchema, plannerSchema, requestSchema, responseSchema, safeError, selectionWithin,
  simpleSchema, synthesisSchema, visionSchema,
} from "./contracts";
import type { AgentAnnotation, EvidenceId, Mode, OrcaResult, TraceEntry, VisionResult } from "./contracts";
import { callModel } from "./transport";
import type { LiveContext } from "./transport";
import { assembleResponse, classifySimpleQuery, demoResponse, evidenceCatalog, simpleResponse } from "./response";

export interface Dependencies {
  env?: Env; fetch?: typeof fetch; now?: () => number; signal?: AbortSignal;
  /** Origin of the request being served; relative adapter/engine paths resolve against it. */
  origin?: string;
}
export interface Execution { httpStatus: number; body: OrcaResult }

export async function orchestrate(raw: unknown, dependencies: Dependencies = {}): Promise<Execution> {
  const trace: TraceEntry[] = [];
  let mode: Mode | null = null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  dependencies.signal?.addEventListener("abort", abort, { once: true });
  if (dependencies.signal?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    if (raw && typeof raw === "object" && "mode" in raw && (raw.mode === "live" || raw.mode === "demo")) mode = raw.mode;
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) throw new OrcaError("INVALID_REQUEST", "Expected query (1-4000 characters), supported regionId, language en/hi/gu, explicit demo/live mode, and optional inline raster image.", 400, false,
      [...new Set(parsed.error.issues.map(issue => issue.path.join(".") || "request"))]);
    const request = parsed.data;
    mode = request.mode;
    trace.push({ stage: "request", kind: "validation", status: "success", durationMs: 0 });
    if (controller.signal.aborted) throw new OrcaError("REQUEST_CANCELLED", "Request cancelled.", 499);
    if (mode === "demo") {
      if (request.image) throw new OrcaError("DEMO_VISION_UNAVAILABLE", "Demo mode does not interpret images. Use configured live vision; no simulated image analysis is returned.", 422);
      const start = Date.now();
      const response = orcaResponseSchema.parse(await demoResponse(request));
      trace.push({ stage: "demo", kind: "demo", status: "success", durationMs: Date.now() - start, detail: "Existing mock fixtures and deterministic mock synthesizer only. Zero LLM, adapter or engine calls." });
      return { httpStatus: 200, body: { mode, response, trace, status: "ok" } };
    }
    const env = dependencies.env ?? process.env;
    const simpleKind = classifySimpleQuery(request);
    if (simpleKind) {
      const config = loadSimpleConfig(env);
      timer = setTimeout(abort, config.totalTimeoutMs);
      const ctx = { config, fetch: dependencies.fetch ?? fetch, signal: controller.signal, trace, now: dependencies.now ?? Date.now };
      trace.push({ stage: "simple-routing", kind: "policy", status: "success", durationMs: 0, detail: "Nonmarine conversational turn. The model writes the reply; no marine assessment or data retrieval." });
      const languageName = { en: "English", hi: "Hindi", gu: "Gujarati" }[request.language];
      const output = await callModel(ctx, [config.model, ...config.fallbacks], "simple", simpleSchema.extend({ kind: z.literal(simpleKind), language: z.literal(request.language) }),
        { query: request.query, kind: simpleKind, language: request.language,
          persona: "You are ORCA — Marine Ecosystem Reasoning with Collaborative Agents — a research-prototype marine intelligence assistant for fishers and coastal communities in India (Mumbai, Goa, Kerala, Chennai). When asked about the water you read weather, sea state, potential fishing zones (PFZ), hazards and routes from official sources through a multi-agent pipeline. Answer only from this description; do not invent features, data sources or history.",
          task: `Write "reply" in ${languageName} (1-3 short sentences, warm and plain) answering the user's message as ORCA, and "replyHi" as the same reply in Hindi. This turn is conversation only: you have checked no marine data, so never state or imply whether conditions are safe, calm, rough, or whether anyone should go out. If they ask about the water, invite a specific question about their region instead.` });
      if (controller.signal.aborted) throw new OrcaError("DEADLINE_EXCEEDED", "The overall request deadline was exceeded.", 504, true);
      const response = orcaResponseSchema.parse(simpleResponse(request, output.kind, output.reply, output.replyHi));
      return { httpStatus: 200, body: { mode, response, trace, status: trace.some(entry => entry.status === "error" || entry.fallback) ? "degraded" : "ok" } };
    }
    const config = loadConfig(env, dependencies.origin);
    for (const note of config.rewired) {
      trace.push({ stage: "config", kind: "policy", status: "success", durationMs: 0,
        detail: `${note.field} pointed at ${note.from}; resolved against this deployment (${note.to}). Set it to an /api/... path to silence this.` });
    }
    timer = setTimeout(abort, config.totalTimeoutMs);
    const ctx: LiveContext = { config, fetch: dependencies.fetch ?? fetch, signal: controller.signal, trace, now: dependencies.now ?? Date.now };
    if (request.image && !config.roles.response.vision && !config.fallbacks.some(model => model.vision)) {
      throw new OrcaError("VISION_NOT_CONFIGURED", "Configure a verified vision-capable response model or Qwen fallback. Text-only fallback is prohibited.");
    }
    const planner = await callModel(ctx, [config.roles.planner, ...config.fallbacks], "planner", plannerSchema,
      { query: request.query, regionId: request.regionId, language: request.language });
    // Mandatory coverage is server-owned. The planner cannot remove a feed, change a URL, or authorize a tool.
    const sources = await getSources(ctx, request);
    let vision: VisionResult | undefined;
    if (request.image) vision = await callModel(ctx, [config.roles.response, ...config.fallbacks], "vision", visionSchema, { task: "Classify image scene only. Do not infer marine conditions, coordinates, safety or routes." }, request.image);
    const catalog = evidenceCatalog(sources, request.language);
    const domainCalls = domains.map(async domain => {
      // The model sees only this domain's ids; a stray id is discarded, not fatal.
      const schema = z.object({ evidenceIds: selectionWithin(domainEvidence[domain]) }).strict();
      const annotation = await callModel(ctx, [config.roles.domain, ...config.fallbacks], domain, schema,
        { query: request.query, intent: planner.intent, domain, sources, catalog, allowedEvidenceIds: domainEvidence[domain] });
      return { domain, ...annotation };
    });
    let findings: AgentAnnotation[];
    try {
      findings = await Promise.all(domainCalls);
    } catch (error) {
      // Cancel and join sibling stages before returning, keeping the final trace stable.
      controller.abort();
      await Promise.allSettled(domainCalls);
      throw error;
    }
    const riskFloor = deterministicRisk(sources);
    trace.push({ stage: "risk-floor", kind: "policy", status: "success", durationMs: 0, detail: `Fixed source-derived risk floor: ${riskFloor}. Agent annotations have no risk authority.` });
    const engines = await getEngines(ctx, request, sources, findings, riskFloor);
    const risk = deterministicRisk(sources, engines);
    trace.push({ stage: "risk", kind: "policy", status: "success", durationMs: 0, detail: `Immutable risk floor with engine escalation: ${risk}. No navigation safety guarantee.` });
    const route = engines.find(engine => engine.engine === "route");
    const routeIncomplete = planner.intent === "route" && (!route || route.routeStatus !== "blocked");
    trace.push({ stage: "completeness", kind: "policy", status: routeIncomplete ? "error" : "success", durationMs: 0,
      ...(routeIncomplete ? { code: "ROUTE_INCOMPLETE" } : {}),
      detail: `Route engine: ${route?.routeStatus ?? "missing"}; intent: ${planner.intent}. A blocked result is not navigation permission.` });
    const allowed = new Set<EvidenceId>([...findings, ...engines].flatMap(finding => finding.evidenceIds));
    const synthesis = await callModel(ctx, [config.roles.synthesis, ...config.fallbacks], "synthesis",
      synthesisSchema.extend({ evidenceIds: selectionWithin([...allowed]) }).strict(),
      { query: request.query, intent: planner.intent, findings, engines, catalog, riskFloor: risk, scope: "current regional observations, not vessel-specific or future forecast" });
    const outputSchema = responseSchema.extend({ language: z.literal(request.language), evidenceIds: selectionWithin(synthesis.evidenceIds) }).strict();
    const rendered = await callModel(ctx, [config.roles.response, ...config.fallbacks], "response", outputSchema,
      { task: "Select and order synthesized evidence for the requested language. Fixed localized safety text is rendered by the server.", query: request.query, language: request.language, synthesis, catalog, riskFloor: risk });
    if (controller.signal.aborted) throw new OrcaError("DEADLINE_EXCEEDED", "The overall request deadline was exceeded.", 504, true);
    // Slow model calls must not turn once-fresh data into a stale live answer.
    for (const source of Object.values(sources)) assertFresh(ctx, source, source.source);
    for (const engine of engines) assertFresh(ctx, engine, `${engine.engine} engine`);
    trace.push({ stage: "final-freshness", kind: "validation", status: "success", durationMs: 0 });
    const insufficient = routeIncomplete || synthesis.answerKind === "insufficient_context";
    const response = orcaResponseSchema.parse(assembleResponse({ request, sources, engines, risk, intent: planner.intent, selected: rendered.evidenceIds, insufficient, vision }));
    const degraded = insufficient || trace.some(entry => entry.status === "error" || entry.fallback);
    return { httpStatus: 200, body: { mode, response, trace, status: degraded ? "degraded" : "ok" } };
  } catch (error) {
    const failure = safeError(error);
    trace.push({ stage: "request", kind: "validation", status: "error", durationMs: 0, code: failure.code });
    return { httpStatus: failure.httpStatus, body: { mode, response: null, trace, status: "error", error: {
      code: failure.code, message: failure.message, retryable: failure.retryable, ...(failure.fields ? { fields: failure.fields } : {}),
    } } };
  } finally {
    if (timer) clearTimeout(timer);
    dependencies.signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}
