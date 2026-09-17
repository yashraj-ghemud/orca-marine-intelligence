"use client";

/**
 * ORCA — voice in, voice out.
 *
 * `Recorder` captures a clip from the microphone and sends it to
 * /api/speech/transcribe (Groq Whisper). `speak` asks /api/speech/synthesize
 * for audio and plays it, falling back to the browser's own voice when the
 * server has nothing for that language. One utterance plays at a time;
 * `stopSpeaking` cuts whatever is playing.
 */

import type { Language } from "@/types/orca";

const BCP47: Record<Language, string> = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" };

export function canRecord(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

function pickMime(): string {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export class Recorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  get active() { return this.recorder?.state === "recording"; }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    const mimeType = pickMime();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType, audioBitsPerSecond: 48_000 } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (event) => { if (event.data.size) this.chunks.push(event.data); };
    this.recorder.start(250);
  }

  /** Stops the microphone and resolves with the clip (empty Blob if nothing was captured). */
  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const recorder = this.recorder;
      const finish = () => {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        const type = recorder?.mimeType || "audio/webm";
        resolve(new Blob(this.chunks, { type }));
        this.chunks = [];
        this.recorder = null;
      };
      if (!recorder || recorder.state === "inactive") return finish();
      recorder.onstop = finish;
      recorder.stop();
    });
  }

  cancel() {
    this.recorder?.stop();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
  }
}

export async function transcribe(clip: Blob, language: Language, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("audio", clip, "clip");
  form.append("language", language);
  const response = await fetch("/api/speech/transcribe", { method: "POST", body: form, signal });
  const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
  if (!response.ok || !data.text) throw new Error(data.error ?? "Transcription failed.");
  return data.text;
}

let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export function stopSpeaking() {
  if (current) {
    current.pause();
    current.src = "";
    current = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

function browserVoice(language: Language): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  const tag = BCP47[language];
  const exact = voices.filter((voice) => voice.lang.replace("_", "-").toLowerCase() === tag.toLowerCase());
  const loose = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language));
  // Prefer the platform's premium/neural voices when it labels them.
  const rank = (voice: SpeechSynthesisVoice) => (/natural|neural|premium|enhanced|google/i.test(voice.name) ? 0 : 1) + (voice.localService ? 0.5 : 0);
  return [...exact, ...loose].sort((a, b) => rank(a) - rank(b))[0];
}

function speakInBrowser(text: string, language: Language): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === "undefined") return resolve();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = BCP47[language];
    const voice = browserVoice(language);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}

/**
 * Speak `text`. Resolves when playback ends (or immediately if it cannot
 * play). Returns which engine spoke: "server", "browser" or "none".
 */
export async function speak(text: string, language: Language): Promise<"server" | "browser" | "none"> {
  stopSpeaking();
  const trimmed = text.trim();
  if (!trimmed) return "none";
  try {
    const response = await fetch("/api/speech/synthesize", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: trimmed, language }),
    });
    if (response.ok && response.status !== 204) {
      const blob = await response.blob();
      currentUrl = URL.createObjectURL(blob);
      const audio = new Audio(currentUrl);
      current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      if (current === audio) stopSpeaking();
      return "server";
    }
  } catch {
    // Network or decode trouble: the browser voice is still available.
  }
  if (typeof speechSynthesis === "undefined") return "none";
  await speakInBrowser(trimmed, language);
  return "browser";
}
