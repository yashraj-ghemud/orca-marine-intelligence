import { copernicusSchema, engineNames, engineSchema, incoisSchema, OrcaError, sourceNames, weatherSchema } from "./contracts";
import type { AgentAnnotation, EngineRequest, EngineResult, OrcaRequest, Sources } from "./contracts";
import type { LiveContext } from "./transport";
import { requestJson } from "./transport";

export function assertFresh(ctx: LiveContext, value: { observedAt: string; validUntil: string }, stage: string) {
  const now = ctx.now();
  const observed = Date.parse(value.observedAt);
  const validUntil = Date.parse(value.validUntil);
  if (!Number.isFinite(observed) || !Number.isFinite(validUntil) || observed > now + 60000 || validUntil <= observed) {
    throw new OrcaError("DATA_INVALID_TIME", `${stage} has invalid or future-dated timestamps. Live output is blocked.`, 503);
  }
  if (now - observed > ctx.config.maxAgeMs || validUntil <= now) {
    throw new OrcaError("DATA_STALE", `${stage} is stale or expired. Live output is blocked.`, 503, true);
  }
}

export async function getSources(ctx: LiveContext, request: OrcaRequest): Promise<Sources> {
  const result: Partial<Sources> = {};
  // Sequential bounded I/O makes the fail-closed trace deterministic; no orphan work on failure.
  for (const name of sourceNames) {
    const schema = { incois: incoisSchema, copernicus: copernicusSchema, weather: weatherSchema }[name];
    const source = await requestJson(ctx, {
      ...ctx.config.sources[name],
      body: { mode: "live", regionId: request.regionId },
      trace: { stage: name, kind: "adapter" },
      validate: json => {
        const parsed = schema.parse(json);
        if (parsed.regionId !== request.regionId) throw new OrcaError("REGION_MISMATCH", `${name} returned a different region.`, 502);
        assertFresh(ctx, parsed, name);
        return parsed;
      },
    });
    Object.assign(result, { [name]: source });
  }
  return result as Sources;
}

export async function getEngines(ctx: LiveContext, request: OrcaRequest, sources: Sources, annotations: AgentAnnotation[], riskFloor: "moderate" | "high"): Promise<EngineResult[]> {
  const sourceObservations = { incois: sources.incois.observedAt, copernicus: sources.copernicus.observedAt, weather: sources.weather.observedAt };
  const engines: EngineResult[] = [];
  for (const engine of engineNames) {
    for (const source of Object.values(sources)) assertFresh(ctx, source, source.source);
    for (const prior of engines) assertFresh(ctx, prior, `${prior.engine} engine`);
    const body: EngineRequest = { mode: "live", regionId: request.regionId, engine, sourceObservations, sources,
      annotations, annotationsAuthority: "untrusted", priorEngines: [...engines],
      riskFloor: riskFloor === "high" ? "high" : deterministicRisk(sources, engines) };
    engines.push(await requestJson(ctx, {
      ...ctx.config.engines[engine],
      body,
      trace: { stage: engine, kind: "engine" },
      validate: json => {
        const parsed = engineSchema.parse(json);
        if (parsed.regionId !== request.regionId || parsed.engine !== engine) throw new OrcaError("ENGINE_MISMATCH", "Engine output does not match the requested region and engine.", 502);
        for (const name of sourceNames) {
          if (parsed.sourceObservations[name] !== sourceObservations[name]) throw new OrcaError("ENGINE_PROVENANCE", "Engine output does not reference the supplied source observations.", 502);
        }
        assertFresh(ctx, parsed, `${engine} engine`);
        return parsed;
      },
    }));
  }
  return engines;
}

export function deterministicRisk(sources: Sources, engines: EngineResult[] = []): "moderate" | "high" {
  const i = sources.incois.data;
  const c = sources.copernicus.data;
  const w = sources.weather.data;
  // Conservative screening policy, NOT a vessel-specific operating limit or navigation certification.
  const high = i.advisoryActive || ["high", "severe"].includes(i.hazardSeverity)
    || i.boundaryStatus !== "clear" || (i.cycloneDistanceKm !== null && i.cycloneDistanceKm <= 250)
    || c.waveHeightM >= 2.5 || c.currentKnots >= 3 || w.windKmph >= 35 || w.gustKmph >= 40 || w.visibilityKm < 5
    || engines.some(engine => engine.riskLevel === "high"
      || (engine.engine === "geospatial" && engine.boundaryStatus !== "clear")
      || (engine.engine === "route" && engine.routeStatus === "blocked"));
  // The legacy UI cannot represent unknown risk. Never issue a live "low/safe" badge.
  return high ? "high" : "moderate";
}
