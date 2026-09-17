/**
 * ORCA — camera choreography.
 *
 * One clock, one unbroken move. The camera rides a single centripetal
 * Catmull-Rom spline from the first frame under the hull to its resting
 * place in the deep, and its aim rides a second one. Both are sampled by
 * arc length through a monotone cubic time map, which is what keeps the
 * motion continuous: keyframes fix *when* the camera passes a point, but the
 * speed through that point is interpolated from its neighbours rather than
 * eased to zero and back. The only stops are the ones written in — rest at
 * the very start, rest at the very end.
 *
 * Nothing here mutates scene state — callers read a pose and apply it, which
 * keeps seeking and pausing exact.
 */

import type { Vector3 } from "three";
import { INTRO_BEATS } from "@/lib/intro";

type Three = typeof import("three");

/** Vessel heading, shared with the water shader's wake. */
export const BOAT_HEADING = { x: Math.sin(0.18), z: -Math.cos(0.18) };
const BOAT_SPEED = 0.65;

/** The vessel's position is a closed form of scene time, so any beat can ask for it. */
export function boatAt(time: number) {
  return {
    x: 5 + BOAT_HEADING.x * time * BOAT_SPEED,
    z: -3 + BOAT_HEADING.z * time * BOAT_SPEED,
  };
}

/**
 * Keyframes, vessel-relative. Positions are where the lens is; looks are
 * what it is pointed at. The vessel is on a heading of -Z with the sunrise
 * ahead of it, so "-Z" reads as "toward the light".
 */
/** Distance from the resting lens to the wall of instruments it frames. */
export const WALL_DISTANCE = 10;

/** Where the instruments assemble: ahead of and below the plunge point. */
export function wallCentre() {
  const boat = boatAt(INTRO_BEATS.plunge);
  return { x: boat.x + 6.1, y: -9.6, z: boat.z + 9 - 14 };
}

const KEYS: { t: number; pos: [number, number, number]; look: [number, number, number]; abs?: boolean }[] = [
  // Opening: under the swell off the port quarter, looking up steeply so the
  // hull sits inside Snell's window — the bright disc of sky — with the
  // caustic ceiling around it. Rising the whole time.
  { t: 0, pos: [-2.6, -3.9, 4.6], look: [0.3, 1.2, -0.9] },
  { t: 1.6, pos: [-2.9, -2.1, 5.2], look: [-0.2, 1.2, -0.9] },
  // Surface break, then a low skim alongside.
  { t: 3.2, pos: [-3.0, 0.5, 6.6], look: [-0.9, 0.85, -0.6] },
  { t: 5.3, pos: [0.2, 0.95, 6.2], look: [-1.4, 0.9, -1.6] },
  // Craning up and around the bow.
  { t: 7.6, pos: [5.4, 2.4, 4.9], look: [-1.8, 0.95, -2.4] },
  { t: 9.9, pos: [10.0, 4.9, 1.0], look: [-2.4, 0.9, -3.6] },
  // Wide, into the sunrise, horizon high in frame.
  { t: 12.0, pos: [13.2, 7.0, -4.2], look: [-3.2, 1.5, -5.4] },
  { t: 13.8, pos: [16.4, 9.6, 5.4], look: [-4.4, 1.6, -7.0] },
  // Apex of the crane, then the dive: the lens turns down toward open water.
  { t: 15.2, pos: [16.0, 11.8, 13.5], look: [-1.0, 1.0, -4.0] },
  { t: 16.8, pos: [9.5, 5.6, 12.2], look: [3.6, -1.6, 1.0] },
  // Through the surface at the plunge point, then a long glide down through
  // the deep toward the sunken instruments (wall-relative from here on).
  { t: INTRO_BEATS.plunge, pos: [5.6, 0.0, 9.0], look: [3.2, -4.2, -1.0] },
  { t: INTRO_BEATS.deep, pos: [1.8, 6.4, 13.5], look: [0.2, 0.4, 0.0], abs: true },
  { t: 20.4, pos: [0.7, 2.6, 11.4], look: [0.1, -0.2, 0.0], abs: true },
  // Resting exactly at the wall's viewing distance, dead on. Tangent zero here.
  { t: INTRO_BEATS.align, pos: [0, 0, WALL_DISTANCE], look: [0, 0, 0], abs: true },
];

/** Where the lens breaks the water on the way down, for the splash. */
export function plungePoint() {
  const boat = boatAt(INTRO_BEATS.plunge);
  const key = KEYS.find((k) => k.t === INTRO_BEATS.plunge)!;
  return { x: boat.x + key.pos[0], z: boat.z + key.pos[2] };
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson) through (x, y) samples with
 * a prescribed tangent at each end. Returns y(x); clamps outside the range.
 */
function monotoneMap(xs: number[], ys: number[], startSlope: number, endSlope: number) {
  const n = xs.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1));
  const m: number[] = new Array(n).fill(0);
  m[0] = startSlope;
  m[n - 1] = endSlope;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  // Limit tangents so the interpolant stays monotone: no overshoot, no reversal.
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      m[i] = k * a * d[i];
      m[i + 1] = k * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && xs[i + 1] < x) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

export interface Track {
  position: InstanceType<Three["CatmullRomCurve3"]>;
  look: InstanceType<Three["CatmullRomCurve3"]>;
  /** Time → arc-length fraction, one per curve. */
  positionAt: (time: number) => number;
  lookAt: (time: number) => number;
}

/** Arc-length fraction of each control point of a curve. */
function controlFractions(THREE: Three, curve: InstanceType<Three["CatmullRomCurve3"]>, count: number) {
  const divisions = 800;
  const lengths = curve.getLengths(divisions);
  const total = lengths[divisions] || 1;
  const fractions: number[] = [];
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    fractions.push(lengths[Math.round(u * divisions)] / total);
  }
  // Guard against a degenerate (repeated) control point.
  for (let i = 1; i < fractions.length; i++) fractions[i] = Math.max(fractions[i], fractions[i - 1] + 1e-5);
  fractions[fractions.length - 1] = 1;
  void THREE;
  return fractions;
}

export function buildTrack(THREE: Three): Track {
  const position: InstanceType<Three["Vector3"]>[] = [];
  const look: InstanceType<Three["Vector3"]>[] = [];
  const wall = wallCentre();
  for (const key of KEYS) {
    const origin = key.abs ? wall : { ...boatAt(key.t), y: 0 };
    position.push(new THREE.Vector3(origin.x + key.pos[0], origin.y + key.pos[1], origin.z + key.pos[2]));
    look.push(new THREE.Vector3(origin.x + key.look[0], origin.y + key.look[1], origin.z + key.look[2]));
  }
  const positionCurve = new THREE.CatmullRomCurve3(position, false, "centripetal");
  const lookCurve = new THREE.CatmullRomCurve3(look, false, "centripetal");
  const times = KEYS.map((key) => key.t);
  return {
    position: positionCurve,
    look: lookCurve,
    // From rest, to rest. Everything between flows.
    positionAt: monotoneMap(times, controlFractions(THREE, positionCurve, KEYS.length), 0, 0),
    lookAt: monotoneMap(times, controlFractions(THREE, lookCurve, KEYS.length), 0, 0),
  };
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

export interface Shot {
  fov: number;
  /** Camera roll in radians. */
  roll: number;
  /** 1 while the lens is below the waterline. */
  under: number;
}

/**
 * Resolve the camera pose for a moment. `position` and `target` are written
 * in place; the returned `Shot` carries the scalars.
 */
export function resolveShot(track: Track, time: number, aspect: number, position: Vector3, target: Vector3): Shot {
  const baseFov = aspect < 0.8 ? 58 : 48;
  track.position.getPointAt(track.positionAt(time), position);
  track.look.getPointAt(track.lookAt(time), target);

  // Afloat: a small vertical breath while the lens is near the surface. It
  // never rolls the horizon, and it is gone by the time the dive begins.
  const afloat = smoothstep(2.4, 3.6, time) * (1 - smoothstep(INTRO_BEATS.horizon, INTRO_BEATS.descent, time));
  position.y += Math.sin(time * 0.65) * 0.055 * afloat;

  // In the deep the lens is never still — a slow swim with a wandering aim
  // — until the wall locks, when it has to be dead on for the page.
  const resting = smoothstep(INTRO_BEATS.deep, INTRO_BEATS.align + 0.6, time) * (1 - smoothstep(INTRO_BEATS.flatten - 1.4, INTRO_BEATS.flatten - 0.2, time));
  position.x += (Math.sin(time * 0.31) * 0.36 + Math.sin(time * 0.87) * 0.07) * resting;
  position.y += (Math.cos(time * 0.24) * 0.3 + Math.sin(time * 0.71) * 0.05) * resting;
  position.z += Math.sin(time * 0.19) * 0.25 * resting;
  target.x += Math.sin(time * 0.27 + 1.0) * 0.42 * resting;
  target.y += Math.sin(time * 0.21) * 0.3 * resting;

  // A slightly longer lens for the sunrise, opening back up for the dive.
  const wide = smoothstep(INTRO_BEATS.signals, INTRO_BEATS.horizon, time) * (1 - smoothstep(INTRO_BEATS.descent, INTRO_BEATS.plunge, time));
  const fov = baseFov - 5 * wide;

  const under = (1 - smoothstep(2.6, 3.4, time)) + smoothstep(INTRO_BEATS.plunge - 0.04, INTRO_BEATS.plunge + 0.06, time);
  return { fov, roll: Math.sin(time * 0.17) * 0.012 * resting, under: Math.min(1, under) };
}

/* ── Scalar cues the renderer needs ─────────────────────────────────── */

export interface SceneCues {
  /** God-ray strength under the surface. */
  rays: number;
  /** Sonar rings and route overlay on the water. */
  signals: number;
  route: number;
  /** Crater and foam where the lens went through. */
  splash: number;
  /** A brief white-out of foam across the lens at the plunge. */
  flash: number;
  /** The canvas has done its work; dissolve it over the assembled page. */
  handoff: number;
  /** Bubble column in the deep. */
  bubbles: number;
  /** The instruments: presence, the ping, the flight, the lock. */
  presence: number;
  pulse: number;
  align: number;
  flatten: number;
}

export function cuesAt(time: number): SceneCues {
  const sinceSplash = time - INTRO_BEATS.plunge;
  return {
    rays: (1 - smoothstep(2.6, 4.2, time)) + smoothstep(INTRO_BEATS.plunge, INTRO_BEATS.plunge + 0.7, time),
    signals: smoothstep(6.4, 8.4, time) * (1 - smoothstep(14.4, 15.6, time)),
    route: smoothstep(10.2, 12.4, time) * (1 - smoothstep(14.4, 15.6, time)),
    splash: sinceSplash < -0.3 ? 0 : Math.max(0, 1 - Math.abs(sinceSplash + 0.05) * 0.9) * smoothstep(-0.3, 0.02, sinceSplash),
    flash: Math.exp(-Math.pow(sinceSplash / 0.16, 2)) * smoothstep(-0.4, 0, sinceSplash),
    handoff: smoothstep(INTRO_BEATS.flatten + 0.15, INTRO_BEATS.end - 0.1, time),
    bubbles: smoothstep(INTRO_BEATS.plunge + 0.2, INTRO_BEATS.deep + 0.8, time) * 0.75,
    presence: smoothstep(INTRO_BEATS.plunge - 0.2, INTRO_BEATS.deep + 0.4, time),
    pulse: smoothstep(INTRO_BEATS.pulse, INTRO_BEATS.align + 0.7, time),
    align: smoothstep(INTRO_BEATS.align, INTRO_BEATS.flatten - 0.3, time),
    flatten: smoothstep(INTRO_BEATS.flatten - 0.5, INTRO_BEATS.flatten + 0.25, time),
  };
}
