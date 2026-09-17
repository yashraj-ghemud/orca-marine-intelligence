import { engineNames, OrcaError, sourceNames } from "./contracts";
import type { EngineName, SourceName } from "./contracts";

export type Env = Record<string, string | undefined>;
export type Role = "planner" | "domain" | "synthesis" | "response";
export interface ModelConfig {
  provider: "openrouter" | "groq";
  id: string;
  url: string;
  key: string;
  keys: string[]; // Multiple API keys for fallback
  vision: boolean;
}
export interface Config {
  /** Loopback endpoints that were re-pointed at the serving origin. */
  rewired: EndpointNote[];
  roles: Record<Role, ModelConfig>;
  fallbacks: ModelConfig[];
  sources: Record<SourceName, { url: string; key: string }>;
  engines: Record<EngineName, { url: string; key: string }>;
  timeoutMs: number;
  totalTimeoutMs: number;
  retries: number;
  maxAgeMs: number;
}
const roleMeta = {
  planner: { displayName: "Planner (intent)", provider: "groq", env: "ORCA_PLANNER_MODEL_ID" },
  domain: { displayName: "Domain agents (weather / marine / PFZ / geospatial)", provider: "groq", env: "ORCA_QWEN36_MODEL_ID" },
  synthesis: { displayName: "Synthesis", provider: "groq", env: "ORCA_SYNTHESIS_MODEL_ID" },
  response: { displayName: "Response + vision", provider: "groq", env: "ORCA_RESPONSE_MODEL_ID" },
} as const;
const value = (env: Env, key: string, fallback = "") => env[key]?.trim() || fallback;

// Parse comma-separated API keys and return array
function parseApiKeys(env: Env, key: string): string[] {
  const raw = value(env, key);
  if (!raw) return [];
  return raw.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Endpoints that were re-pointed at the request's own origin, for the trace. */
export type EndpointNote = { field: string; from: string; to: string };

/**
 * Resolve a service endpoint. Three forms are accepted:
 *   - an absolute https URL (an external adapter or engine);
 *   - a relative path such as `/api/adapters/incois` — the recommended form
 *     for the feeds this app ships itself — resolved against `origin`, the
 *     origin of the request being served;
 *   - an http loopback URL for local development. If the request came from
 *     somewhere else (a deployed site), the loopback host is replaced by that
 *     origin and the substitution is recorded, so a `.env` copied from a
 *     laptop keeps working in production instead of failing with a refused
 *     connection to the function's own localhost.
 */
function endpoint(raw: string, field: string, origin?: string, notes?: EndpointNote[]): string {
  try {
    if (raw.startsWith("/")) {
      if (!origin) throw new Error("relative");
      if (!raw.startsWith("/api/")) throw new Error();
      return new URL(raw, origin).toString();
    }
    const url = new URL(raw);
    const loopback = url.protocol === "http:" && LOOPBACK.has(url.hostname);
    if ((url.protocol !== "https:" && !loopback) || url.username || url.password || url.hash) throw new Error();
    if (loopback && origin) {
      const here = new URL(origin);
      if (!LOOPBACK.has(here.hostname)) {
        const resolved = new URL(url.pathname + url.search, origin).toString();
        notes?.push({ field, from: url.origin, to: here.origin });
        return resolved;
      }
    }
    return url.toString();
  } catch (error) {
    const reason = error instanceof Error && error.message === "relative"
      ? `${field} is a relative path, which needs the request origin to resolve.`
      : `Configure a valid HTTPS endpoint or an /api/... path in ${field} (HTTP only for loopback development).`;
    throw new OrcaError("CONFIG_INVALID", reason, 503, false, [field]);
  }
}

function integer(env: Env, field: string, fallback: number, min: number, max: number): number {
  const number = Number(value(env, field, String(fallback)));
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new OrcaError("CONFIG_INVALID", `${field} must be an integer from ${min} to ${max}.`, 503, false, [field]);
  }
  return number;
}

function requireValues(env: Env, required: string[]) {
  const missing = required.filter(key => !value(env, key));
  if (missing.length) throw new OrcaError("CONFIG_MISSING", `Live mode is not configured. Set: ${missing.join(", ")}. Exact model IDs must come from your provider; none are assumed.`, 503, false, missing);
}

function roleModel(env: Env, role: Role, connection: { url: string; key: string; keys: string[] }): ModelConfig {
  const meta = roleMeta[role];
  const id = value(env, meta.env, role === "synthesis" ? "openai/gpt-oss-120b" : role === "planner" ? value(env, "ORCA_QWEN36_MODEL_ID") : "");
  if (!id || id.length > 200 || /\s|compound/i.test(id)) throw new OrcaError("CONFIG_INVALID", `${meta.env} must be an exact model ID, not a compound system.`, 503, false, [meta.env]);
  return {
    ...connection, provider: meta.provider, id,
    vision: role === "response" ? env.ORCA_RESPONSE_VISION_ENABLED === "true" : role === "domain" && env.ORCA_QWEN36_VISION_ENABLED === "true"
  };
}

export function loadConfig(env: Env, origin?: string): Config {
  const rewired: EndpointNote[] = [];
  // Every role runs on Groq; each role's model ID is explicit, none is assumed.
  const required = ["GROQ_API_KEY", "ORCA_QWEN36_MODEL_ID", "ORCA_RESPONSE_MODEL_ID",
    ...sourceNames.map(name => `ORCA_${name.toUpperCase()}_ADAPTER_URL`),
    ...engineNames.map(name => `${name.toUpperCase()}_ENGINE_URL`)];
  requireValues(env, required);
  const groq = loadGroqConfig(env);

  // Parse multiple API keys for both providers
  const openrouterKeys = parseApiKeys(env, "OPENROUTER_API_KEY");
  const groqKeys = parseApiKeys(env, "GROQ_API_KEY");

  const provider = {
    openrouter: {
      url: endpoint(value(env, "ORCA_OPENROUTER_URL", "https://openrouter.ai/api/v1/chat/completions"), "ORCA_OPENROUTER_URL"),
      key: openrouterKeys[0] || "",
      keys: openrouterKeys
    },
    groq: {
      url: groq.model.url,
      key: groqKeys[0] || groq.model.key,
      keys: groqKeys.length > 0 ? groqKeys : [groq.model.key]
    },
  };
  const roles = Object.fromEntries(Object.entries(roleMeta).map(([role, meta]) =>
    [role, roleModel(env, role as Role, provider[meta.provider])])) as Config["roles"];
  // Marine roles: primary -> GPT OSS 20B -> Qwen; duplicates are skipped by callModel.
  // This chain is what turns a rate-limited primary into a degraded answer instead of an error.
  const fallbacks: ModelConfig[] = [groq.model, roles.domain];
  const sources = Object.fromEntries(sourceNames.map(name => [name, {
    url: endpoint(value(env, `ORCA_${name.toUpperCase()}_ADAPTER_URL`), `ORCA_${name.toUpperCase()}_ADAPTER_URL`, origin, rewired),
    key: value(env, `ORCA_${name.toUpperCase()}_ADAPTER_TOKEN`),
  }])) as Config["sources"];
  const engines = Object.fromEntries(engineNames.map(name => [name, {
    url: endpoint(value(env, `${name.toUpperCase()}_ENGINE_URL`), `${name.toUpperCase()}_ENGINE_URL`, origin, rewired),
    key: value(env, `${name.toUpperCase()}_ENGINE_TOKEN`),
  }])) as Config["engines"];
  return {
    rewired, roles, fallbacks, sources, engines,
    timeoutMs: groq.timeoutMs,
    totalTimeoutMs: groq.totalTimeoutMs,
    retries: groq.retries,
    maxAgeMs: integer(env, "ORCA_MAX_DATA_AGE_MS", 3600000, 60000, 86400000),
  };
}

export function loadSimpleConfig(env: Env) {
  requireValues(env, ["GROQ_API_KEY"]);
  const groq = loadGroqConfig(env);
  return {
    ...groq,
    fallbacks: value(env, "ORCA_QWEN36_MODEL_ID") ? [roleModel(env, "domain", groq.model)] : [],
  };
}

function loadGroqConfig(env: Env) {
  const id = value(env, "ORCA_FALLBACK_MODEL_ID", "openai/gpt-oss-20b");
  if (id.length > 200 || /\s|compound/i.test(id)) throw new OrcaError("CONFIG_INVALID", "ORCA_FALLBACK_MODEL_ID must be an exact model ID, not a compound system.", 503, false, ["ORCA_FALLBACK_MODEL_ID"]);

  const groqKeys = parseApiKeys(env, "GROQ_API_KEY");
  const model: ModelConfig = {
    id, provider: "groq", vision: false,
    key: groqKeys[0] || value(env, "GROQ_API_KEY"),
    keys: groqKeys.length > 0 ? groqKeys : [value(env, "GROQ_API_KEY")],
    url: endpoint(value(env, "ORCA_GROQ_URL", "https://api.groq.com/openai/v1/chat/completions"), "ORCA_GROQ_URL")
  };
  return {
    model,
    timeoutMs: integer(env, "ORCA_TIMEOUT_MS", 12000, 100, 60000),
    totalTimeoutMs: integer(env, "ORCA_TOTAL_TIMEOUT_MS", 90000, 100, 180000),
    retries: integer(env, "ORCA_RETRIES", 1, 0, 2),
  };
}

export function health(env: Env = process.env) {
  let liveConfigured = true;
  try { loadConfig(env); } catch { liveConfigured = false; }
  let simpleConfigured = true;
  try { loadSimpleConfig(env); } catch { simpleConfigured = false; }
  return {
    status: "ok", demoAvailable: true, liveConfigured, connectivityChecked: false,
    roles: [...Object.entries(roleMeta).map(([role, meta]) => ({
      role, displayName: meta.displayName, provider: meta.provider,
      configured: !!value(env, meta.env, role === "synthesis" ? "openai/gpt-oss-120b" : role === "planner" ? value(env, "ORCA_QWEN36_MODEL_ID") : "") && !!value(env, "GROQ_API_KEY"),
      ...(role === "response" ? { visionConfigured: env.ORCA_RESPONSE_VISION_ENABLED === "true" && !!value(env, meta.env) && !!value(env, "GROQ_API_KEY") } : {}),
    })), { role: "simple", displayName: "Conversation (nonmarine)", provider: "groq", configured: simpleConfigured }],
    fallbacks: [
      { displayName: "GPT OSS 20B (fallback)", configured: !!value(env, "GROQ_API_KEY"), visionConfigured: false },
      { displayName: "Domain model (fallback)", configured: !!value(env, "GROQ_API_KEY") && !!value(env, "ORCA_QWEN36_MODEL_ID"), visionConfigured: env.ORCA_QWEN36_VISION_ENABLED === "true" && !!value(env, "GROQ_API_KEY") && !!value(env, "ORCA_QWEN36_MODEL_ID") },
    ],
    adapters: sourceNames.map(name => ({ name, configured: !!value(env, `ORCA_${name.toUpperCase()}_ADAPTER_URL`) })),
    engines: engineNames.map(name => ({ name, configured: !!value(env, `${name.toUpperCase()}_ENGINE_URL`) })),
  };
}
