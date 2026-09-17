"use client";

/**
 * ORCA — Cinematic intro choreography helpers.
 *
 * The intro is a store-driven phase machine (boot → playing → assembly →
 * done). Shell elements subscribe through `useIntroGate`, which hands them
 * a `shown` flag plus calibrated delays.
 *
 * The cinematic is one continuous camera move, not a chaptered slideshow:
 * `INTRO_BEATS` names the moments the overlay copy and the WebGL scene both
 * read from, so captions and camera stay locked without a second clock.
 * The shot ends on a wall of 3D instruments that exactly fills the lens;
 * the page fades in over it.
 *
 * Hydration safety: initial render is deterministic on server and client
 * (everything hidden during `boot`); every viewport/visibility decision
 * happens after mount.
 */

import { useOrcaStore } from "@/lib/store";
import { useSyncExternalStore } from "react";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Named moments on the single intro clock, in seconds. Every value is the
 * instant that beat *begins*; the camera is one unbroken move across all of
 * them, so these are anchors for copy and cues, never cuts.
 */
export const INTRO_BEATS = {
  /** Just under the swell beside the hull, rising toward the light. */
  abyss: 0,
  /** Surface break — the camera skims alongside the vessel. */
  departure: 3.2,
  /** Craning orbit; sonar rings and the route bloom. */
  signals: 7.6,
  /** Wide pull-back into the sunrise. */
  horizon: 12,
  /** The dive begins; frame furniture clears. */
  descent: 15.2,
  /** The lens hits the water. */
  plunge: 17.9,
  /** In the deep — the workspace is found adrift here. */
  deep: 18.5,
  /** A sonar pulse washes outward and wakes every panel. */
  pulse: 20.8,
  /** Panels fly to their places. */
  align: 21.8,
  /** The deep dissolves; the page is what remains. */
  flatten: 24,
  /** Clock end. */
  end: 25,
} as const;

export type IntroBeat = keyof typeof INTRO_BEATS;

export const INTRO_DURATION = INTRO_BEATS.end * 1000;

/** Keep slow frames from skipping a beat; all values are seconds except delta. */
export function advanceIntroTime(time: number, deltaMs: number) {
  return Math.min(INTRO_BEATS.end, Math.max(0, time) + Math.min(100, Math.max(0, deltaMs)) / 1000);
}

/**
 * Overlay copy. Cards overlap deliberately — one is still leaving as the next
 * arrives — so the reading never lands on a hard "block 1, block 2, block 3"
 * rhythm. Everything clears before the plunge so the dive plays silent.
 */
export const INTRO_CAPTIONS = [
  { id: "home", kind: "cue", from: 0.9, to: 4.6, text: "For those who call the sea home" },
  { id: "wakes", kind: "headline", from: 3.6, to: 8.4, text: "Before the coast", accent: "wakes." },
  { id: "signals", kind: "headline", from: 7.7, to: 12.4, text: "An ocean of signals.", accent: "" },
  { id: "course", kind: "headline", from: 11.7, to: 15.4, text: "A clearer", accent: "course." },
  { id: "mark", kind: "mark", from: 14.7, to: 17.7, text: "No one reads the ocean alone." },
] as const;

export type IntroCaption = (typeof INTRO_CAPTIONS)[number];

/** Fade weight for a caption at `time`: 0 outside its window, 1 while it holds. */
export function captionOpacity(caption: IntroCaption, time: number) {
  const ramp = caption.kind === "mark" ? 0.85 : 0.6;
  if (time <= caption.from || time >= caption.to) return 0;
  return Math.min(1, (time - caption.from) / ramp, (caption.to - time) / ramp);
}

/**
 * The hand-off, in seconds after `flatten`. The 3D wall of instruments has
 * already assembled in the scene; the real DOM only has to fade in beneath
 * the dissolving canvas. Shared by `OrcaWorkspace` and the intro so the two
 * clocks cannot drift apart.
 */
export const ASSEMBLY = {
  /** Panels are fully visible this long after they appear. */
  appear: 0.6,
  /** Everything is home. */
  home: 0.8,
  /** Canvas is gone; phase becomes `done`. */
  done: INTRO_BEATS.end - INTRO_BEATS.flatten,
} as const;

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function useMotionPreference() {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia(MOTION_QUERY).matches, () => false);
}

/** While the cinematic is on stage the GPU belongs to it: instruments hold a still frame. */
function introOnStage() {
  const phase = useOrcaStore.getState().introPhase;
  return phase === "playing" || phase === "assembly";
}

/** One 30fps clock for ambient instruments; no work when hidden, offscreen, or during the intro. */
export function observeAmbientCanvas(canvas: HTMLCanvasElement, draw: (time: number) => void, resize: () => void) {
  let frame = 0;
  let stopped = false;
  let visible = typeof IntersectionObserver === "undefined";
  let time = 0;
  let previous = performance.now();
  const motion = window.matchMedia(MOTION_QUERY);
  const canDraw = () => !stopped && visible && !document.hidden && canvas.clientWidth > 0 && canvas.clientHeight > 0;
  const still = () => motion.matches || introOnStage();
  const tick = (now: number) => {
    if (!canDraw() || still()) return;
    const delta = now - previous;
    if (delta >= 1000 / 30 - 1) {
      time += Math.min(delta, 100) / 1000;
      previous = now;
      draw(time);
    }
    if (canDraw() && !still()) frame = requestAnimationFrame(tick);
  };
  const resume = () => {
    cancelAnimationFrame(frame);
    if (!canDraw()) return;
    resize();
    previous = performance.now();
    if (still()) draw(time);
    else frame = requestAnimationFrame(tick);
  };
  let lastPhase = useOrcaStore.getState().introPhase;
  const unsubscribe = useOrcaStore.subscribe((state) => {
    if (state.introPhase !== lastPhase) { lastPhase = state.introPhase; resume(); }
  });
  const intersection = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); });
  const dimensions = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resume);
  intersection?.observe(canvas);
  dimensions?.observe(canvas);
  if (!dimensions) window.addEventListener("resize", resume);
  document.addEventListener("visibilitychange", resume);
  motion.addEventListener("change", resume);
  // Defer the initial draw so callers have received their cleanup function.
  frame = requestAnimationFrame(resume);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    unsubscribe();
    intersection?.disconnect();
    dimensions?.disconnect();
    if (!dimensions) window.removeEventListener("resize", resume);
    document.removeEventListener("visibilitychange", resume);
    motion.removeEventListener("change", resume);
  };
}

/** sessionStorage flag — the full cinematic plays once per browser session. */
export const INTRO_SEEN_KEY = "orca.intro.seen";

/** Assembly delays (seconds) — full cinematic vs the compressed repeat-visit path. */
export function introDelay(fast: boolean, full: number): number {
  return fast ? Math.max(0.02, full * 0.32) : full;
}

export function useIntroGate() {
  const phase = useOrcaStore((s) => s.introPhase);
  const fast = useOrcaStore((s) => s.introFast);
  const reduced = useMotionPreference();
  return {
    /**
     * True once the shell may show itself. This turns on at `assembly`, not
     * at `done`: the canvas dissolves over the page rather than cutting to
     * it, so the DOM has to be fading in while the wall is still up.
     */
    shown: phase === "assembly" || phase === "done",
    /** True while the cinematic overlay is on stage. */
    playing: phase === "playing",
    fast: fast || reduced,
    phase,
  };
}

/** Shared spring for elements landing during the assembly. */
export const ASSEMBLY_SPRING = { type: "spring", stiffness: 380, damping: 26 } as const;

/** Cinematic ease used across entrances. */
export const EASE_CINEMA = [0.22, 1, 0.36, 1] as const;
