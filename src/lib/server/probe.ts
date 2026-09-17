/**
 * ORCA — live connectivity preflight.
 *
 * `health()` only says whether settings are present. This actually makes the
 * calls a live marine request would make — each source adapter, each engine
 * (fed the real adapter output), and the model provider — with short
 * timeouts, and reports per-service reachability. It is what an operator
 * needs to tell a bad endpoint from a bad key from a bad model id.
 *
 * Nothing sensitive leaves: no URLs, no keys, no provider bodies. Just the
 * service name, ok/fail, latency and ORCA's own error code.
 */

import { loadConfig } from "./config";
import type { Env } from "./config";
import { deterministicRisk, getEngines, getSources } from "./adapters";
import { engineNames, OrcaError, safeError, sourceNames } from "./contracts";
import type { TraceEntry } from "./contracts";
import type { LiveContext } from "./transport";

export interface ProbeResult {
  name: string;
  ok: boolean;
  ms: number;
  /** ORCA error code when not ok; "SKIPPED" when an earlier failure made the check impossible. */
  code?: string;
}

export interface Preflight {
  connectivityChecked: true;
  checkedAt: string;
  ok: boolean;
  configured: boolean;
  configError?: { code: string; fields?: string[] };
  providers: ProbeResult[];
  feeds: ProbeResult[];
  engines: ProbeResult[];
  /** Loopback endpoints that were re-pointed at this deployment. */
  rewired: string[];
}

export async function preflight(env: Env, origin: string, fetcher: typeof fetch = fetch): Promise<Preflight> {
  const checkedAt = new Date().toISOString();
  const base = { connectivityChecked: true as const, checkedAt, providers: [] as ProbeResult[], feeds: [] as ProbeResult[], engines: [] as ProbeResult[], rewired: [] as string[] };
  let config;
  try {
    config = loadConfig(env, origin);
  } catch (error) {
    const failure = safeError(error);
    return { ...base, ok: false, configured: false, configError: { code: failure.code, fields: failure.fields } };
  }
  base.rewired = config.rewired.map(note => note.field);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  const trace: TraceEntry[] = [];
  const ctx: LiveContext = {
    config: { ...config, timeoutMs: Math.min(config.timeoutMs, 8000), retries: 0 },
    fetch: fetcher, signal: controller.signal, trace, now: Date.now,
  };

  const timed = async <T,>(name: string, work: () => Promise<T>): Promise<[ProbeResult, T | undefined]> => {
    const started = Date.now();
    try {
      const value = await work();
      return [{ name, ok: true, ms: Date.now() - started }, value];
    } catch (error) {
      return [{ name, ok: false, ms: Date.now() - started, code: safeError(error).code }, undefined];
    }
  };

  try {
    // Provider: can we reach it with this key at all?
    const [groq] = await timed("groq", async () => {
      const response = await fetcher(new URL("/openai/v1/models", config.roles.domain.url).toString(), {
        headers: { Authorization: `Bearer ${config.roles.domain.key}` }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      }).catch(() => { throw new OrcaError("UPSTREAM_NETWORK", "Upstream connection failed.", 502, true); });
      if (response.status === 401 || response.status === 403) throw new OrcaError("MODEL_ACCESS_DENIED", "Verify provider credentials.", 502);
      if (!response.ok) throw new OrcaError("UPSTREAM_HTTP", `Upstream returned HTTP ${response.status}.`, 502);
      await response.body?.cancel().catch(() => {});
    });
    base.providers.push(groq);

    // Feeds, one at a time, exactly as a live request does.
    const request = { query: "preflight", regionId: "mumbai" as const, language: "en" as const, mode: "live" as const };
    const [feeds, sources] = await timed("sources", () => getSources(ctx, request));
    if (sources) {
      for (const name of sourceNames) base.feeds.push({ name, ok: true, ms: trace.find(t => t.stage === name)?.durationMs ?? 0 });
    } else {
      // getSources stops at the first failure; report each feed from the trace.
      for (const name of sourceNames) {
        const entries = trace.filter(t => t.stage === name);
        const last = entries[entries.length - 1];
        base.feeds.push(last ? { name, ok: last.status === "success", ms: last.durationMs, code: last.code } : { name, ok: false, ms: 0, code: "SKIPPED" });
      }
      void feeds;
    }

    if (sources) {
      const [, engines] = await timed("engines", () => getEngines(ctx, request, sources, [], deterministicRisk(sources)));
      for (const name of engineNames) {
        const entries = trace.filter(t => t.stage === name);
        const last = entries[entries.length - 1];
        base.engines.push(last ? { name, ok: last.status === "success", ms: last.durationMs, code: last.code } : { name, ok: false, ms: 0, code: "SKIPPED" });
      }
      void engines;
    } else {
      for (const name of engineNames) base.engines.push({ name, ok: false, ms: 0, code: "SKIPPED" });
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }

  const all = [...base.providers, ...base.feeds, ...base.engines];
  return { ...base, ok: all.every(result => result.ok), configured: true };
}
