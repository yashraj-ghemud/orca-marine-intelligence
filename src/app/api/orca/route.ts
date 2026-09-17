import { health } from "../../../lib/server/config";
import { preflight } from "../../../lib/server/probe";
import { orchestrate } from "../../../lib/server/orchestrator";
import { OrcaError, safeError } from "../../../lib/server/contracts";
import { readLimitedJson } from "../../../lib/server/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  // `?probe=1` performs the live preflight: real calls to every feed, engine
  // and the model provider, with per-service results and no secrets.
  if (url.searchParams.get("probe") === "1") {
    return Response.json(await preflight(process.env, url.origin), { headers });
  }
  return Response.json(health(), { headers });
}

export async function POST(request: Request) {
  try {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new OrcaError("UNSUPPORTED_MEDIA_TYPE", "Use Content-Type: application/json.", 415);
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 2_900_000) throw new OrcaError("PAYLOAD_TOO_LARGE", "Request exceeds the maximum JSON body size.", 413);
    const bodySignal = AbortSignal.any([request.signal, AbortSignal.timeout(10000)]);
    const body = await readLimitedJson(new Response(request.body), 2_900_000, bodySignal);
    const result = await orchestrate(body, { signal: request.signal, origin: new URL(request.url).origin });
    return Response.json(result.body, { status: result.httpStatus, headers });
  } catch (error) {
    const failure = safeError(error);
    return Response.json({ mode: null, response: null, trace: [], status: "error", error: {
      code: failure.code, message: failure.message, retryable: false,
    } }, { status: failure.code === "INVALID_JSON" ? 400 : failure.httpStatus, headers });
  }
}
