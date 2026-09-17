# ORCA Backend

## State

The backend is implemented; live service connectivity is **not verified**. No credentials, verified Inkling/Qwen deployment IDs, live data adapters, or Risk/Geo/Route engines were available. Demo works without credentials. Marine live queries fail closed until all required configuration and fresh data are available. Exact nonmarine greeting/help queries use GPT OSS 20B with an optional configured Qwen 3.6 fallback; only `GROQ_API_KEY` is required for the simple primary. Nothing substitutes demo data for a failed live dependency.

Only backend files, this document, `.env.example`, and `tests/orchestrator*` are owned by this change. Store, shared types, package files and frontend are unchanged.

## HTTP Contract

`POST /api/orca`, `Content-Type: application/json`:

```ts
type Request = {
  query: string; // trimmed, 1-4000 characters
  regionId: "mumbai" | "goa" | "kerala" | "chennai";
  language: "en" | "hi" | "gu";
  mode: "demo" | "live"; // mandatory, no implicit default
  image?: string; // data:image/{png|jpeg|webp};base64,...
};

type Success = {
  mode: "demo" | "live";
  response: OrcaResponse; // existing src/types/orca.ts, runtime validated
  trace: TraceEntry[];
  status: "ok" | "degraded";
};

type Failure = {
  mode: "demo" | "live" | null; // null when no valid mode can be read
  response: null; // NEVER a fake acknowledgement or a mock/live hybrid
  trace: TraceEntry[];
  status: "error";
  error: {
    code: string;
    message: string; // sanitized; no provider bodies, secrets, images or queries
    retryable: boolean;
    fields?: string[]; // invalid input fields or missing environment names
  };
};

type TraceEntry = {
  stage: string;
  kind: "model" | "adapter" | "engine" | "validation" | "policy" | "demo";
  status: "success" | "error" | "skipped";
  durationMs: number;
  attempt?: number; // 1-based per candidate
  provider?: "openrouter" | "groq";
  model?: string; // exact configured ID for actual model attempts only
  fallback?: boolean;
  code?: string;
  detail?: string; // deterministic operational metadata, no chain-of-thought
};
```

HTTP 200 includes both `ok` and `degraded`. Degraded means a retry/fallback/capability skip was used or synthesis reported insufficient context; it does not relax any data or safety requirement. Configuration failures return 503, exhausted model candidates 503, invalid upstream contracts typically 502, deadlines 504, invalid client input 400, oversized JSON 413, incorrect media type 415, and demo image requests 422. A pre-cancelled request can return 499. Errors always carry the failure envelope. All route responses use `Cache-Control: no-store`.

```js
const result = await fetch("/api/orca", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: "What are current marine conditions?",
    regionId: "mumbai", language: "en", mode: "demo"
  })
}).then(r => r.json());
if (result.status === "error") {
  // Display result.error.message; do not render result.response.
} else {
  // Render result.response, preserve mode badge, optionally show result.trace.
}
```

`GET /api/orca` returns:

```ts
{
  status: "ok";
  demoAvailable: true;
  liveConfigured: boolean; // full marine pipeline config validation, not connectivity
  connectivityChecked: false;
  roles: { role: "planner" | "domain" | "synthesis" | "response" | "simple";
    displayName: string; provider: "openrouter" | "groq";
    configured: boolean; visionConfigured?: boolean }[];
  fallbacks: { displayName: string; configured: boolean; visionConfigured: boolean }[];
  adapters: { name: "incois" | "copernicus" | "weather"; configured: boolean }[];
  engines: { name: "risk" | "geospatial" | "route"; configured: boolean }[];
}
```

Per-role/per-adapter booleans report configuration presence, not successful requests. Health never exposes keys, tokens, endpoint URLs or exact model IDs.

## Locked Stack

| Role | Provider | Display Name | Model ID Variable |
| --- | --- | --- | --- |
| Planner | OpenRouter | Inkling planner | `ORCA_INKLING_MODEL_ID` (blank) |
| Weather / Ocean / PFZ / Geospatial | Groq | Qwen 3.6 27B | `ORCA_QWEN36_MODEL_ID` (blank) |
| Synthesis | Groq | GPT OSS 120B | `ORCA_SYNTHESIS_MODEL_ID` (`openai/gpt-oss-120b`) |
| Response / image scene classification | Groq | Qwen 3.8 27B | `ORCA_RESPONSE_MODEL_ID` (blank) |
| Text fallback 1 | Groq | GPT OSS 20B | `ORCA_FALLBACK_MODEL_ID` (`openai/gpt-oss-20b`) |
| Text fallback 2 | Groq | Qwen 3.6 27B | `ORCA_QWEN36_MODEL_ID` |
| Nonmarine greeting/help | Groq | GPT OSS 20B | `ORCA_FALLBACK_MODEL_ID` (`openai/gpt-oss-20b`); optional `ORCA_QWEN36_MODEL_ID` fallback |

Inkling/Qwen names are user-selected display names, **not verified deployable IDs**. The server deliberately invents no IDs. Missing primary IDs are configuration errors, not a reason to silently replace the locked stack. Exact IDs, account access and image capability must be verified with the respective provider. Compound systems are rejected. Each stage is an owned orchestration call, not Groq Compound or a provider-managed agent workflow.

Provider URL overrides are full OpenAI-compatible `/chat/completions` endpoints. Responses must have `choices[0].finish_reason: "stop"` and JSON in `choices[0].message.content`. Refusals, truncation, malformed JSON, extra structured fields and invalid evidence references fail validation. Requests use `response_format: {type: "json_object"}`, temperature 0 and a JSON schema in the system prompt. Providers must support this interface.

Every full-pipeline text role tries its configured primary, then GPT OSS 20B, then Qwen 3.6, deduplicating identical model/provider candidates. The Qwen 3.6 domain primary is therefore not retried a second time after the GPT OSS 20B fallback is exhausted. Simple greeting/help starts directly with GPT OSS 20B and falls back only to Qwen 3.6 when its exact ID is configured. Retryable transport and contract errors get bounded retries and backoff first. Authentication/client HTTP failures skip same-candidate retries but may try the next configured provider/model. Model HTTP 404 produces a `MODEL_NOT_FOUND` trace; 401/403 produces `MODEL_ACCESS_DENIED`; 400 produces `MODEL_REQUEST_REJECTED`. Exhaustion returns `MODEL_UNAVAILABLE` with a reminder to verify exact IDs, access, JSON output and image capability. No raw provider error text reaches the client. Configuration health is not a provider capability probe; operators must verify deployment availability before enabling live mode.

## Execution and Safety

1. Validate strict request fields, raster image encoding and configuration.
2. Invoke Inkling for a structured intent. Exhausted planner candidates stop the request before source retrieval. The planner cannot omit mandatory data, agents or engines.
3. Fetch and validate **all three mandatory sources**, independent of planner intent. Any missing, stale, invalid or unavailable source blocks domain agents and engines; planner success never permits an unverified live answer.
4. If supplied, classify the image using an explicitly vision-capable model. Image output is never marine evidence.
5. Run the four Qwen 3.6 agents **in parallel** for weather, marine, PFZ and geospatial annotations. Each consumes verified sources, not engine results. An exhausted agent cancels and joins sibling calls before returning an error; no engines run with partial annotations.
6. After all domain agents complete, compute the fixed source-derived risk floor. Annotations cannot change numeric inputs or policy thresholds.
7. Revalidate sources and invoke the three mandatory **Risk -> Geo -> Route engine adapters**, supplying the full verified sources, risk floor and explicitly untrusted agent annotations. Engine risk can only escalate the server floor.
8. Invoke GPT OSS 120B to synthesize domain annotations **and engine results**, and identify insufficient context.
9. Invoke Qwen 3.8 for language-specific evidence ordering, then revalidate source/engine freshness.
10. Render selected evidence with fixed localized safety text and validate the final `OrcaResponse`.

The dependency order is **Planner -> mandatory source validation -> parallel domain agents -> Risk/Geo/Route engines -> synthesis -> presentation**, with optional vision after source validation and before domain work. Planning completes before any source request starts; all sources validate before domain agents start. Domain trace entries appear in completion order; all finish before any engine starts. Full configuration and any required vision capability are validated before the planner is called. The implementation retains the existing modules rather than introducing a workflow framework or four new domain services.

The Ocean agent retains the existing internal `marine` domain name. No shared types, store names or frontend contracts are renamed.

Models can choose intent, select/order allowed evidence IDs, mark insufficient context, and classify image scenes. **They cannot supply arbitrary displayed prose, measurements, titles, risk levels, tool URLs, navigation routes or permissions.** This intentionally constrained output prevents a prompt-injected narrative from contradicting deterministic risk. It is evidence-oriented regional reporting, not an unconstrained conversational answer generator. Unanswerable detail is not invented. All mandatory evidence remains visible even if a model omits it from its selection.

High screening risk applies to active advisories, high/severe hazards, unknown/restricted boundaries, cyclone distance <=250 km, waves >=2.5 m, current >=3 kn, wind >=35 km/h, gusts >=40 km/h, visibility <5 km, any engine reporting high risk, Geo returning an unknown/restricted boundary, or Route returning blocked. These fixed source thresholds are unchanged by this orchestration revision. They are conservative application policy thresholds, not certified vessel operating limits. Otherwise the legacy risk badge is `moderate`, explicitly labelled safety not established. No live `low/safe` badge is emitted because the shared type cannot represent unknown risk. PFZ never overrides hazard risk.

No vessel location or requested forecast time is supplied by this API. Live answers concern current regional observations only, never a vessel-specific assessment, future forecast, safe route, guaranteed catch or authorization to depart. All seven existing marine overlays are disabled in live responses because the current frontend's overlay data is mocked. No replacement live geometry is implied. An integrating frontend must not re-enable those fixtures as live data.

Demo dynamically imports the existing `REGIONS` and `synthesizeResponse` only inside the demo branch. It adds explicit simulation disclaimers, replaces fictional agent accomplishments with truthful fixture descriptions, removes simulated latency, and emits zero model/adapter/engine trace entries. Demo image requests return an explicit error rather than simulated interpretation.

## Nonmarine Short Circuit

Only exact, text-only allowlist matches qualify in live mode: greetings `hi`, `hello`, `hey`, `namaste`, `नमस्ते`, `નમસ્તે`; help phrases `help`, `what can you do`, `how do i use orca`, `मदद`, `મદદ`. Matching ignores case, surrounding whitespace and trailing `. ! ? ।` punctuation. No keyword substring or model-based routing can bypass the marine pipeline. Mixed requests such as "Hi, is it safe to sail?", "help with weather", unknown queries and all images take the full pipeline.

The `simple` role calls GPT OSS 20B as primary, then Qwen 3.6 on failure only if `ORCA_QWEN36_MODEL_ID` is nonblank, with the same timeouts, strict JSON validation and retry policy. It must return exactly `{kind: "greeting" | "help", language: "en" | "hi" | "gu"}`, matching the server-selected kind and requested language. The server renders a short localized template, not arbitrary model prose. An error is explicit; no simulated model success is returned. Only `GROQ_API_KEY` is required. `ORCA_FALLBACK_MODEL_ID` can override the GPT OSS 20B deployment ID; the Groq endpoint and timeout settings are optional. OpenRouter, response-model, marine adapter and engine settings are not needed or loaded on this path. Missing or whitespace-only Qwen fallback IDs are omitted, never invented; explicitly supplied invalid/compound IDs are configuration errors. If GPT OSS 20B fails with no Qwen fallback configured, the request fails rather than fabricating a reply. A `simple-routing` policy trace and real `simple` model attempt traces identify this path.

The HTTP envelope stays unchanged. These responses have `intent: "unknown"`, `verdict.kind: "info"`, empty evidence/sources, and an explicit statement that no marine data or engines were checked and safety was not assessed. The legacy required risk field remains `moderate`, never a fake low/safe verdict. Mock map overlays are disabled. Demo mode remains wholly offline and does not use this model shortcut. Health reports a separate `simple` role configuration boolean; `liveConfigured` continues to describe the full marine pipeline.

## Languages and Vision

The unchanged shared `OrcaResponse` has English primary fields and Hindi `*Hi` fields; it has no `*Gu` fields. For `en`/`hi`, the response retains the existing primary-English/Hindi pairing. For `gu`, primary text, live evidence labels/values, verdict and reasoning bullets contain Gujarati; `*Hi` stays Hindi. Consumers requesting Gujarati must display the primary fields. Operational agent/provenance metadata remains English. Demo Gujarati uses a Gujarati summary/disclaimer with inherited fixture metric labels; it does not pretend the existing fixture translations are complete.

Images must be canonical base64 data URLs, PNG/JPEG/WebP only, <=2 MiB decoded. MIME magic signatures are checked; URLs, SVG, noncanonical base64 and MIME spoofing are rejected. This is input-envelope/signature validation, not image decoding or content authenticity verification. The JSON body is capped at 2,900,000 bytes, upstream JSON at 262,144 bytes, with a 10-second body-read deadline.

Enable `ORCA_RESPONSE_VISION_ENABLED=true` only after verifying the exact primary deployment supports images. Vision fallback is only the configured Qwen 3.6 model when `ORCA_QWEN36_VISION_ENABLED=true`. GPT OSS 20B is always text-only in this backend. Each vision attempt receives the original image. If no capable candidate succeeds, the whole request fails; it does not continue with an ignored image. Image output is bounded to `scene: ocean|chart|document|other|unclear` and `limitation: not_navigation_evidence`.

## Live Adapter Contract

These endpoints are **operator-provided normalization adapters**, not guessed INCOIS/Copernicus public API URLs. Supply actual upstream integrations with any necessary subscriptions, provenance, coverage and authentication. All three adapters receive POST JSON:

```json
{"mode":"live","regionId":"mumbai"}
```

Every adapter returns this strict envelope (ISO 8601 timestamps with timezone):

```ts
{
  mode: "live";
  regionId: "mumbai" | "goa" | "kerala" | "chennai";
  source: "incois" | "copernicus" | "weather"; // must match endpoint
  observedAt: string; // actual observation/product reference time, NOT fetch time
  validUntil: string; // actual validity limit, never fabricate a freshness extension
  data: IncoisData | CopernicusData | WeatherData; // exact source-specific shape below
}
```

```ts
type IncoisData = {
  center: { lat: number; lng: number };
  advisoryActive: boolean;
  hazardSeverity: "none" | "moderate" | "high" | "severe";
  cycloneDistanceKm: number | null; // null only if a valid bulletin reports none
  boundaryStatus: "clear" | "restricted" | "unknown";
  pfzAvailable: boolean; // official signal existence, NOT inferred catch or safe access
};
type CopernicusData = {
  waveHeightM: number;
  sstC: number;
  chlorophyllMgM3: number;
  currentKnots: number;
};
type WeatherData = {
  windKmph: number;
  gustKmph: number; // >= windKmph
  visibilityKm: number;
};
```

Adapter names describe the normalization role. The INCOIS adapter must combine authoritative hazard/PFZ products with verified regional boundary coverage where needed; this is not a claim that a single INCOIS API exposes this entire shape. For products of differing ages, use the oldest mandatory constituent timestamp and earliest expiry. Never convert unavailable data to false, zero or null. If mandatory coverage is absent, return an error or an invalid/missing field; live must fail closed. Unknown boundary status raises high screening risk.

Strict schemas, numeric bounds and enum lists live in `src/lib/server/contracts.ts`. Coordinates must be finite and legal. All mandatory fields must be present, no string-number coercion or unknown properties. Wrong source/region, missing data, expired data, invalid timestamps or observation times more than 60 seconds in the future fail closed. Source and engine ages must be <=`ORCA_MAX_DATA_AGE_MS` (default 1 hour). This is a configurable screening freshness ceiling, not a provider update-frequency assumption.

## Deterministic Engine Contract

Exactly three endpoints are mandatory: `RISK_ENGINE_URL`, `GEOSPATIAL_ENGINE_URL`, and `ROUTE_ENGINE_URL`. The existing server integrations are HTTP adapters to operator-provided deterministic computations, not bundled live engine services. No separate Weather/Ocean/PFZ model-driven engines are introduced. There is **no simulated engine implementation or implicit fallback**. Each receives, in Risk -> Geo -> Route order:

```ts
{
  mode: "live";
  regionId: Request["regionId"];
  engine: "risk" | "geospatial" | "route";
  sourceObservations: { incois: string; copernicus: string; weather: string };
  sources: { incois: IncoisEnvelope; copernicus: CopernicusEnvelope; weather: WeatherEnvelope };
  annotations: { domain: "weather" | "marine" | "pfz" | "geospatial"; evidenceIds: EvidenceId[] }[];
  annotationsAuthority: "untrusted";
  riskFloor: "moderate" | "high";
}
```

Each returns:

```ts
type EngineOutput = {
  mode: "live";
  regionId: Request["regionId"];
  observedAt: string;
  validUntil: string;
  sourceObservations: { incois: string; copernicus: string; weather: string };
  riskLevel: "low" | "moderate" | "high"; // may escalate, never reduce server floor
  evidenceIds: EvidenceId[]; // nonempty, unique, max 11
} & (
  | { engine: "risk" }
  | { engine: "geospatial"; boundaryStatus: "clear" | "restricted" | "unknown" }
  | { engine: "route"; routeStatus: "not_evaluated" | "blocked" | "insufficient_context" }
);
type EvidenceId = "waves" | "wind" | "visibility" | "sst" | "chlorophyll" |
  "current" | "advisory" | "hazards" | "cyclone" | "boundary" | "pfz";
```

The output is a strict discriminated union: risk has neither `boundaryStatus` nor `routeStatus`; geospatial requires only `boundaryStatus`; route requires only `routeStatus`. An invented `safe` route status or path geometry is rejected. Engine observation references must exactly match the supplied source timestamp strings, and engine/region must match the request. Each engine receives the verified sources and annotations, not a model-generated measurement or the previous engine's response. Engines must treat annotations as nonauthoritative and compute from the supplied sources.

Domain models select from server-owned per-domain evidence allowlists before any engine call. Synthesis may select only the union of domain and engine evidence; response may select only synthesized evidence. Engines may escalate risk, never lower the source-derived floor. Mandatory source evidence remains visible regardless of model selections. All models have strict runtime schemas, including matching response language.

Source and engine tokens, if supplied, are sent as `Authorization: Bearer ...`. URLs are deployment configuration only, never user/model-controlled. HTTPS is required except loopback HTTP for development; redirects and URL credentials are rejected. Configure trusted internal services only. This protocol validates declared provenance; it cannot prove an operator's adapter actually queried its claimed upstream. Adapter honesty and authentication are deployment trust boundaries.

## Operations and Verification

`.env.example` lists all configuration. No package manifest changes or new runtime libraries: Zod is already declared in the project. Node 22+ is recommended. All requests have bounded retries (default one extra), per-attempt timeout (12 seconds), overall live deadline (90 seconds), and cancellation. The route permits a maximum 180-second hosting budget; match hosting limits to configured timeout. No background work, database, client-side keys or cache is used.

Before exposing live mode publicly, enforce your deployment's authentication and rate/cost limits. This route does not add an account system or persistent rate limiter. Query text goes to the configured model providers; images go only to vision-capable candidates; numeric source data goes to configured engines/models. No provider traffic occurs in demo. Keep credentials server-only and obtain consent/appropriate terms for uploaded content.

Run after the dependency agent installs project dependencies:

```sh
bun test tests/orchestrator.test.ts
bun run tsc --noEmit --incremental false
```

Plain `node --experimental-strip-types` is not sufficient here: unchanged mock modules use extensionless imports and the project's `@/` alias. Bun handles these without altering shared modules or package settings. Tests mock every live fetch and cover exact role/provider routing and credential separation, per-stage fallback order and deduplication, parallel-stage ordering, mandatory deterministic engine authority, demo isolation with no keys, contracts, actionable provider failures, timeout, freshness/revalidation, provenance, prompt-output rejection, risk floors, language handling, image validation and vision-capable fallback.

Bun 1.3.14 is available in the hosted workspace via `BUN_BE_BUN=1 /root/.bcode/bin/bcode` even when `bun` is not on PATH. The test command was attempted but execution is blocked by missing project dependencies (`zod`); no runtime tests are claimed passing. Bun successfully parsed and bundled the 11-module backend/test dependency graph with Zod externalized. This is a syntax/import check, not a substitute for runtime tests or TypeScript checking. Dependency installation belongs to the other agent; no package, lockfile or dependency tree was changed. A full test rerun, TypeScript check, complete Next build and real provider/engine integration remain verification/deployment checks.

## Frontend Handoff

No frontend, store or shared type edits are required by the backend implementation itself. Integrators must explicitly send mode and language, retain demo/live and degraded/error labels, display primary fields for Gujarati and `*Hi` fields for Hindi, and honor all live `disableLayers` values. Image input must send the validated inline raster form; image classification is never navigation evidence. The legacy shared response cannot express unknown risk, Gujarati-specific fields or live route geometry. Expanding any of those capabilities requires a separately coordinated shared-type/frontend change rather than silently relaxing backend safeguards.
