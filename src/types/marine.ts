/**
 * ORCA — Marine geospatial & oceanographic data types.
 * All data in the prototype is SIMULATED. Types are shaped so a real
 * backend (INCOIS/ISRO/MOSDAC-style feeds) can replace the mock layer
 * without touching UI components.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type RiskLevel = "low" | "moderate" | "high";

export type HazardType = "cyclone" | "highWaves" | "lightning" | "roughSea";

export interface VesselInfo {
  id: string;
  name: string;
  type: "fishing" | "research" | "patrol" | "cargo";
  position: LatLng;
  headingDeg: number;
  speedKnots: number;
  status: "anchored" | "underway" | "moored";
}

export interface HazardZone {
  id: string;
  label: string;
  labelHi: string;
  type: HazardType;
  /** Center of the hazard influence area */
  center: LatLng;
  radiusKm: number;
  /** Irregular polygon outline for the risk zone (fallback: circle from radius) */
  polygon?: LatLng[];
  severity: "moderate" | "high" | "severe";
  /** Short reason shown in popups / evidence */
  detail: string;
  detailHi: string;
}

export interface CycloneInfo {
  name: string;
  category: "Depression" | "Deep Depression" | "Cyclonic Storm" | "Severe Cyclonic Storm";
  center: LatLng;
  distanceKm: number;
  bearing: string;
  windKmph: number;
  movement: string;
}

export interface SafeZone {
  id: string;
  label: string;
  labelHi: string;
  center: LatLng;
  radiusKm: number;
  reason: string;
  reasonHi: string;
}

export interface PFZZone {
  id: string;
  label: string;
  labelHi: string;
  polygon: LatLng[];
  center: LatLng;
  distanceKm: number;
  /** Sea surface temperature at the zone */
  sst: number;
  /** Chlorophyll-a concentration mg/m³ */
  chlorophyll: number;
  signals: {
    sstFront: boolean;
    chlorophyllElevated: boolean;
    thermoclineShallow: boolean;
  };
  expectedSpecies: string[];
  depthM: number;
}

export interface TideWindow {
  high: string;
  low: string;
}

export interface MarineConditions {
  waveHeightM: number;
  wavePeriodS: number;
  windSpeedKmph: number;
  windGustKmph: number;
  windDirection: string;
  sst: number;
  chlorophyll: number;
  currentKnots: number;
  visibilityKm: number;
  advisory: string;
  advisoryHi: string;
  advisoryActive: boolean;
  tide: TideWindow;
  sunrise: string;
  sunset: string;
  updatedAt: string;
}

export type RegionId = "mumbai" | "goa" | "kerala" | "chennai";

export interface MarineRegion {
  id: RegionId;
  name: string;
  nameHi: string;
  /** Map default view */
  center: LatLng;
  defaultZoom: number;
  coastline: LatLng[];
  vessel: VesselInfo;
  hazardZones: HazardZone[];
  safeZones: SafeZone[];
  pfzZones: PFZZone[];
  cyclone: CycloneInfo | null;
  conditions: MarineConditions;
  /** Suggested safer path from vessel → safe zone (route demo) */
  suggestedRoute: {
    id: string;
    label: string;
    labelHi: string;
    path: LatLng[];
    distanceKm: number;
    etaMinutes: number;
    avoids: string[];
  } | null;
  /** Offshore boundary line (e.g., territorial water limit, simplified) */
  boundary?: {
    label: string;
    path: LatLng[];
  };
}

/** A single piece of evidence backing an answer. */
export interface EvidenceItem {
  category: "weather" | "geospatial" | "marine" | "ocean";
  label: string;
  labelHi: string;
  value: string;
  /** Optional Hindi variant of the value (falls back to value) */
  valueHi?: string;
  /** Optional indicator for muted semantic color */
  tone?: "neutral" | "warn" | "danger" | "good" | "info";
}

/** Agent pipeline stages surfaced in the UI (high-level only, no CoT). */
export type AgentId =
  | "intent"
  | "weatherOcean"
  | "geospatialRisk"
  | "dataDiscovery"
  | "verification"
  | "synthesis";

export type AgentStatus = "pending" | "active" | "complete" | "error";

export interface AgentRun {
  id: AgentId;
  label: string;
  labelHi: string;
  status: AgentStatus;
  /** One-line human-readable contribution, shown in analysis summary */
  contribution: string;
  contributionHi: string;
}
