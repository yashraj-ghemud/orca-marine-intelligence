/**
 * ORCA — speech to text.
 *
 * The composer's microphone records a short clip in the browser and posts it
 * here; this route forwards it to Groq Whisper (`whisper-large-v3-turbo`)
 * with the workspace language as a hint and returns the transcript. The
 * Groq key stays on the server.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;
const LANGUAGES = new Set(["en", "hi", "gu"]);
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  const key = process.env.GROQ_API_KEY?.split(",")[0]?.trim();
  if (!key) return Response.json({ error: "Speech is not configured: set GROQ_API_KEY." }, { status: 503, headers });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data with an audio file." }, { status: 400, headers });
  }
  const file = form.get("audio");
  const language = String(form.get("language") ?? "en");
  if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "No audio received." }, { status: 400, headers });
  if (file.size > MAX_BYTES) return Response.json({ error: "Recording is too long." }, { status: 413, headers });
  if (!LANGUAGES.has(language)) return Response.json({ error: "Unsupported language." }, { status: 400, headers });

  const upstream = new FormData();
  // Whisper wants a filename with a recognisable extension.
  const extension = file.type.includes("webm") ? "webm" : file.type.includes("ogg") ? "ogg" : file.type.includes("mp4") ? "mp4" : "wav";
  upstream.append("file", file, `clip.${extension}`);
  upstream.append("model", "whisper-large-v3-turbo");
  upstream.append("language", language);
  upstream.append("response_format", "json");
  upstream.append("temperature", "0");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${key}` }, body: upstream,
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
  }).catch(() => undefined);
  if (!response) return Response.json({ error: "Could not reach the transcription service." }, { status: 502, headers });
  if (!response.ok) {
    // Never forward the provider's body: it can echo request details.
    return Response.json({ error: response.status === 429 ? "Transcription is rate-limited; try again in a moment." : "Transcription failed." }, { status: 502, headers });
  }
  const data = (await response.json().catch(() => null)) as { text?: string } | null;
  const text = data?.text?.trim() ?? "";
  if (!text) return Response.json({ error: "Nothing was heard." }, { status: 422, headers });
  return Response.json({ text: text.slice(0, 4000), language }, { headers });
}
