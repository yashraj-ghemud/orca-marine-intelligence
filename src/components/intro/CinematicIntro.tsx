"use client";

/**
 * ORCA — the cinematic intro overlay.
 *
 * The overlay is deliberately thin: a skip affordance, a running caption
 * stream, a foam flash at the plunge and the final dissolve. Everything else
 * is the WebGL scene.
 *
 * Captions overlap rather than replacing one another, and every per-frame
 * value — caption opacity, chrome fade, the foam flash, the hand-off to
 * the workspace — is written straight to the DOM from the story
 * clock. React renders this component once per run; nothing re-renders at
 * 60fps.
 *
 * The intro hands off to the workspace on its own. At the `flatten` beat —
 * the 3D wall of instruments locked over the layout — the phase advances to
 * `assembly` so the real page fades in beneath, and the canvas dissolves over
 * it. The overlay unmounts at `done`. Skip takes the same route, marking the
 * root dismissed so it fades at once.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  advanceIntroTime, ASSEMBLY, captionOpacity, INTRO_BEATS, INTRO_CAPTIONS, INTRO_SEEN_KEY,
} from "@/lib/intro";
import { useOrcaStore } from "@/lib/store";
import { CinematicOcean, type CinematicStage } from "./CinematicOcean";
import styles from "./CinematicIntro.module.css";

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

function markSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    // Storage can be unavailable in private or embedded browsing contexts.
  }
}

/** Advance the shell so the workspace is already building under the dissolve. */
function releaseWorkspace(fast: boolean) {
  if (useOrcaStore.getState().introPhase !== "playing") return;
  markSeen();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useOrcaStore.getState().setIntroPhase(reduced ? "done" : "assembly", fast || reduced);
}

/**
 * Review aids, so a 25-second sequence can be inspected without sitting
 * through it: `?intro=force&from=20.2` plays from that beat, and
 * `?intro=force&at=20.2` holds that single frame. Both ignore values that
 * do not parse into the timeline's range.
 */
function seekFromLocation() {
  const query = new URLSearchParams(window.location.search);
  const hold = query.get("at");
  const raw = hold ?? query.get("from");
  const at = Number(raw);
  const seconds = raw && Number.isFinite(at) ? Math.min(INTRO_BEATS.end, Math.max(0, at)) : 0;
  return { seconds, hold: hold !== null && Number.isFinite(at) };
}

function IntroStage() {
  const stage = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const chrome = useRef<HTMLDivElement>(null);
  const eyebrow = useRef<HTMLDivElement>(null);
  const captions = useRef<(HTMLDivElement | null)[]>([]);
  const flash = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const timeline = useRef(0);
  const released = useRef(false);
  const dismissed = useRef(false);

  /* The scene reports every frame; this only ever touches style properties. */
  const onStage = useRef<((stage: CinematicStage) => void) | undefined>(undefined);
  const report = useCallback(({ time, flash: foam, handoff }: CinematicStage) => {
    for (let i = 0; i < INTRO_CAPTIONS.length; i++) {
      const node = captions.current[i];
      if (!node) continue;
      const caption = INTRO_CAPTIONS[i];
      const opacity = captionOpacity(caption, time);
      node.style.opacity = String(opacity);
      if (opacity <= 0) {
        node.style.visibility = "hidden";
        continue;
      }
      node.style.visibility = "visible";
      // Copy rises in and keeps rising out — never a static block swap.
      const through = (time - caption.from) / (caption.to - caption.from || 1);
      node.style.transform = `translate3d(0, ${(0.5 - through) * -26}px, 0)`;
    }
    // Frame furniture clears as the camera turns downward, so the dive plays
    // against nothing but water. Skip is deliberately exempt.
    const furniture = String(1 - smoothstep(INTRO_BEATS.descent - 1.6, INTRO_BEATS.descent + 0.6, time));
    if (chrome.current) chrome.current.style.opacity = furniture;
    if (eyebrow.current) eyebrow.current.style.opacity = furniture;
    if (flash.current) flash.current.style.opacity = String(foam);
    // The letterbox and vignette go with the dive; in the deep the panels are
    // the picture and nothing should tint them.
    if (veil.current) veil.current.style.opacity = String(1 - smoothstep(INTRO_BEATS.plunge, INTRO_BEATS.deep + 0.6, time));
    if (stage.current && !dismissed.current) stage.current.style.opacity = String(1 - handoff);
    if (!released.current && time >= INTRO_BEATS.flatten) {
      released.current = true;
      releaseWorkspace(false);
    }
  }, []);

  useEffect(() => {
    onStage.current = report;
    return () => { onStage.current = undefined; };
  }, [report]);

  const leave = useCallback(() => {
    if (released.current) return;
    released.current = true;
    dismissed.current = true;
    // A DOM flag rather than state: the overlay is mid-flight, not re-rendering.
    stage.current?.setAttribute("data-dismissed", "true");
    markSeen();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    useOrcaStore.getState().setIntroPhase(reduced ? "done" : "assembly", true);
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = stage.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let previous = performance.now();
    let frame = 0;
    const seek = seekFromLocation();
    timeline.current = seek.seconds;
    skip.current?.focus({ preventScroll: true });

    // Inert the surrounding shell without changing its styles or store state.
    const siblings: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement | null = root;
    while (branch?.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          siblings.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }

    const tick = (now: number) => {
      if (document.hidden) return;
      if (!seek.hold) timeline.current = advanceIntroTime(timeline.current, now - previous);
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (root) root.dataset.hidden = String(document.hidden);
      if (!document.hidden) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const reduce = () => {
      if (motion.matches) leave();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        leave();
      }
    };
    reduce();
    visibility();
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("keydown", keyboard);
    motion.addEventListener("change", reduce);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("keydown", keyboard);
      motion.removeEventListener("change", reduce);
      siblings.forEach(({ element, inert }) => { element.inert = inert; });
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [leave]);

  return (
    <div ref={stage} className={styles.intro} role="dialog" aria-modal="true" aria-label="ORCA ocean introduction" aria-describedby="orca-intro-description">
      <CinematicOcean className={styles.backdrop} cinematic timeline={timeline} onStage={onStage} />
      <div ref={veil} className={styles.veil} aria-hidden="true">
        <div className={styles.scrim} />
        <div className={styles.filmFrame} />
      </div>

      {/* Skip sits outside the chrome: it stays reachable for the whole run. */}
      <button ref={skip} className={styles.skip} type="button" onClick={leave}>Skip intro <span aria-hidden="true">↗</span></button>

      <div ref={chrome} className={styles.chrome}>
        <header className={styles.header}>
          <span className={styles.brand}>ORCA<span className={styles.brandDot}>.</span></span>
          <span className={styles.prototype}><span /> Research prototype</span>
        </header>
        <footer className={styles.footer}>
          <p>Illustrative scene · Demo data · Not for navigation</p>
        </footer>
      </div>

      <div className={styles.story}>
        <div ref={eyebrow} className={styles.eyebrow}><span /> THE OCEAN, UNDERSTOOD</div>
          <div className={styles.captions} aria-hidden="true">
            {INTRO_CAPTIONS.map((caption, index) => (
              <div
                key={caption.id}
                ref={(node) => { captions.current[index] = node; }}
                className={styles.caption}
                data-kind={caption.kind}
                style={{ opacity: 0, visibility: "hidden" }}
              >
                {caption.kind === "cue" && <p className={styles.cue}>{caption.text}</p>}
                {caption.kind === "headline" && (
                  <h1 className={styles.headline}>
                    {caption.text}{caption.accent ? <><br /><em>{caption.accent}</em></> : null}
                  </h1>
                )}
                {caption.kind === "mark" && (
                  <div className={styles.reveal}>
                    <p>{caption.text}</p>
                    <h1>ORCA<span>.</span></h1>
                  </div>
                )}
              </div>
            ))}
          </div>
        <p id="orca-intro-description" className={styles.srOnly}>
          An illustrative ocean journey introducing ORCA — a fishing vessel at dawn, a dive beneath the swell, and the workspace assembling in the deep.
          Not live data or navigational advice. The workspace opens automatically when the sequence ends; press Escape or use Skip intro to open it now.
        </p>
      </div>

      {/* Foam across the lens as it goes through the surface. */}
      <div ref={flash} className={styles.flash} aria-hidden="true" style={{ opacity: 0 }} />
    </div>
  );
}

export function CinematicIntro() {
  const phase = useOrcaStore((state) => state.introPhase);
  const setIntroPhase = useOrcaStore((state) => state.setIntroPhase);
  useEffect(() => {
    if (phase !== "boot") return;
    const preference = new URLSearchParams(window.location.search).get("intro");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_SEEN_KEY) === "1"; } catch { /* Optional persistence. */ }
    if (reduced) setIntroPhase("done", true);
    else if (preference === "off" || (seen && preference !== "force")) setIntroPhase("assembly", true);
    else setIntroPhase("playing", false);
  }, [phase, setIntroPhase]);

  useEffect(() => {
    if (phase !== "assembly") return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => { if (motion.matches) setIntroPhase("done", true); };
    if (motion.matches) { reduce(); return; }
    const fast = useOrcaStore.getState().introFast;
    // Long enough for the canvas to dissolve over the page it just released.
    const timer = window.setTimeout(() => setIntroPhase("done"), (fast ? ASSEMBLY.done * 0.32 : ASSEMBLY.done) * 1000);
    motion.addEventListener("change", reduce);
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener("change", reduce);
    };
  }, [phase, setIntroPhase]);

  // The stage outlives `playing`: it dissolves over the workspace during
  // `assembly` and only unmounts once that phase completes.
  return phase === "playing" || phase === "assembly" ? <IntroStage /> : null;
}
