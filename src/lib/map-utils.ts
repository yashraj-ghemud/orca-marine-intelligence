/**
 * ORCA — Geospatial helpers for the marine map layer.
 * Pure functions, no dependencies on Leaflet so they are testable
 * and reusable by both mock data generation and UI logic.
 */

import type { LatLng } from "@/types/marine";

const EARTH_RADIUS_KM = 6371;
const DEG = Math.PI / 180;

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

/** Move from an origin by `distanceKm` along `bearingDeg` (0 = north). */
export function destinationPoint(
  origin: LatLng,
  bearingDeg: number,
  distanceKm: number,
): LatLng {
  const brng = bearingDeg * DEG;
  const lat1 = origin.lat * DEG;
  const lng1 = origin.lng * DEG;
  const dr = distanceKm / EARTH_RADIUS_KM;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dr) * Math.cos(lat1),
      Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: lat2 / DEG, lng: ((lng2 / DEG + 540) % 360) - 180 };
}

/**
 * Regular polygon approximating a circle of `radiusKm` around `center`.
 * Used for influence areas (cyclone wind field, safe anchorages).
 */
export function circlePolygon(
  center: LatLng,
  radiusKm: number,
  segments = 40,
): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i < segments; i++) {
    pts.push(destinationPoint(center, (360 / segments) * i, radiusKm));
  }
  return pts;
}

/** Deterministic pseudo-random from an integer seed ([-1, 1]). */
function seededNoise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Organic, irregular blob polygon — makes hazard zones look like real
 * met-ocean contour regions instead of perfect geometric circles.
 */
export function irregularBlob(
  center: LatLng,
  radiusKm: number,
  seed = 1,
  wobble = 0.28,
  segments = 22,
): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (360 / segments) * i;
    const r =
      radiusKm *
      (1 + wobble * seededNoise(seed * 31 + i) * 0.5 + wobble * 0.35 * seededNoise(seed * 77 + i * 3));
    pts.push(destinationPoint(center, angle, Math.max(radiusKm * 0.45, r)));
  }
  return pts;
}

/** Compass bearing (16-wind rose) from a → b. */
export function bearingLabel(a: LatLng, b: LatLng): string {
  const dLng = (b.lng - a.lng) * DEG;
  const lat1 = a.lat * DEG;
  const lat2 = b.lat * DEG;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = ((Math.atan2(y, x) / DEG) + 360) % 360;
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(brng / 22.5) % 16];
}

/** Leaflet-style bounds for a set of points. */
export function boundsOf(points: LatLng[]): [[number, number], [number, number]] {
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/** Human readable bearing arrow for wind/current. */
export function compassArrow(dir: string): string {
  const map: Record<string, string> = {
    N: "↓", NNE: "↙", NE: "↙", ENE: "←", E: "←", ESE: "↖", SE: "↖",
    SSE: "↑", S: "↑", SSW: "↗", SW: "↗", WSW: "→", W: "→", WNW: "↘",
    NW: "↘", NNW: "↓",
  };
  return map[dir] ?? "·";
}
