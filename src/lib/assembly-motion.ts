"use client";

/**
 * ORCA — the page fading in beneath the intro's last frame.
 *
 * The intro ends on a wall of 3D instruments that already sits exactly over
 * the layout (`scene/instruments.ts`). What the DOM does is small: each piece
 * fades in with a hair of depth, in the same centre-out order the sonar ping
 * woke its 3D counterpart, while the canvas dissolves above it. Nothing here
 * should draw attention; the cut has to be invisible.
 */

import type { Transition } from "framer-motion";
import { ASSEMBLY, introDelay } from "@/lib/intro";

export type PanelKey =
  | "header" | "tabs" | "chat" | "chart"
  | "chatHeader" | "chatGreeting" | "chatCard" | "composer"
  | "layers" | "actions" | "legend" | "sonar" | "hint";

/** 0 centre → 1 edge: the order the ping reached each piece. */
const ORDER: Record<PanelKey, number> = {
  header: 0.55, tabs: 0.5, chat: 0.72, chatHeader: 0.62, chatGreeting: 0.48, chatCard: 0.58, composer: 0.8,
  chart: 0.25, layers: 0.6, actions: 0.6, legend: 0.8, sonar: 0.5, hint: 0.1,
};

/** Framer props for a piece. `settled` drops the compositing hint once home. */
export function assemblyMotion(key: PanelKey, shown: boolean, fast: boolean, settled = false) {
  const delay = introDelay(fast, ORDER[key] * 0.16);
  const hidden = { opacity: 0, scale: 0.992, z: -6, transformPerspective: 1400 };
  const style = settled ? undefined : { willChange: "transform, opacity", backfaceVisibility: "hidden" as const };
  if (!shown) return { initial: hidden, animate: hidden, transition: { duration: 0 } satisfies Transition, style };
  const transition: Transition = { duration: (fast ? 0.32 : 1) * ASSEMBLY.appear, delay, ease: [0.22, 1, 0.36, 1] };
  return { initial: hidden, animate: { opacity: 1, scale: 1, z: 0, transformPerspective: 1400 }, transition, style };
}

/** Delay for elements that are not part of the assembly and arrive once it is home. */
export function afterAssembly(fast: boolean, offset = 0) {
  return (fast ? 0.32 : 1) * (ASSEMBLY.home + offset);
}
