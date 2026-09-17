/**
 * ORCA — text to speech.
 *
 * Provider chain, most realistic first:
 *   1. ElevenLabs `eleven_multilingual_v2` when ELEVENLABS_API_KEY is set
 *      (one or more keys, comma-separated; rotated on quota/auth/rate limit)
 *      — natural multilingual voices.
 *   2. Groq `canopylabs/orpheus-v1-english` for English (expressive, with
 *      breaths and pauses). English only, and the Groq org has to accept
 *      the model terms once in the console.
 *   3. Otherwise 204: the browser speaks with its own voice.
 *
 * Only what the answer card already shows is spoken; nothing is generated
 * here beyond audio.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LANGUAGES = new Set(["en", "hi", "gu"]);
const MAX_CHARS = 1200;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

/** ElevenLabs voice ids: warm, unhurried multilingual presets (override with ORCA_ELEVEN_VOICE_ID). */
const ELEVEN_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";

const noAudio = (reason: string) => new Response(null, { status: 204, headers: { ...headers, "X-ORCA-TTS": reason } });

export async function POST(request: Request) {
  let body: { text?: unknown; language?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON { text, language }." }, { status: 400, headers });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_CHARS) : "";
  const language = typeof body.language === "string" && LANGUAGES.has(body.language) ? body.language : "en";
  if (!text) return Response.json({ error: "Nothing to say." }, { status: 400, headers });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(40_000)]);

  // ELEVENLABS_API_KEY may hold several keys, comma-separated. Free-tier
  // quotas are per key, so when one is exhausted (or rejected, or rate-limited)
  // the next is tried; any other failure falls through to the next provider.
  const elevenKeys = (process.env.ELEVENLABS_API_KEY ?? "").split(",").map(key => key.trim()).filter(Boolean);
  if (elevenKeys.length) {
    const voice = process.env.ORCA_ELEVEN_VOICE_ID?.trim() || ELEVEN_DEFAULT_VOICE;
    for (const [index, key] of elevenKeys.entries()) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: "POST", signal,
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text, model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
        }),
      }).catch(() => undefined);
      if (response?.ok && response.body) {
        return new Response(response.body, { headers: { ...headers, "Content-Type": "audio/mpeg", "X-ORCA-TTS": `elevenlabs-key${index + 1}` } });
      }
      // 401 = bad key or quota exhausted (ElevenLabs reports quota as 401 quota_exceeded), 429 = rate limit.
      const rotate = !response || response.status === 401 || response.status === 429 || response.status === 402;
      console.warn(`[speech] ElevenLabs key ${index + 1}/${elevenKeys.length} failed (${response?.status ?? "network"})${rotate && index < elevenKeys.length - 1 ? ", trying next key" : ""}.`);
      if (!rotate) break;
    }
    // Fall through: exhausted or bad ElevenLabs keys must not silence the app.
  }

  const groq = process.env.GROQ_API_KEY?.split(",")[0]?.trim();
  if (groq && language === "en") {
    const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST", signal,
      headers: { Authorization: `Bearer ${groq}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "canopylabs/orpheus-v1-english",
        input: text,
        voice: process.env.ORCA_TTS_VOICE?.trim() || "tara",
        response_format: "wav",
      }),
    }).catch(() => undefined);
    if (response?.ok && response.body) {
      return new Response(response.body, { headers: { ...headers, "Content-Type": "audio/wav", "X-ORCA-TTS": "orpheus" } });
    }
    if (response) {
      const detail = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
      if (detail?.error?.code === "model_terms_required") {
        console.warn("[speech] Orpheus TTS needs a one-time terms acceptance: https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english — falling back to the browser voice.");
        return noAudio("orpheus-terms");
      }
      return noAudio(`orpheus-${response.status}`);
    }
  }
  return noAudio(language === "en" ? "unconfigured" : "language");
}
