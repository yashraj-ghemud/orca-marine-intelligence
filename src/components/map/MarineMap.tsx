"use client";

/**
 * ORCA — Marine map (Leaflet).
 * Client-only. Consumes declarative `mapCommand`s from the store so the
 * chat panel can drive the map without coupling to it.
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Circle,
  CircleMarker,
  Marker,
  Tooltip,
  Popup,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { MarineRegion, PFZZone } from "@/types/marine";
import type { MapDelta } from "@/types/orca";
import { useOrcaStore } from "@/lib/store";
import { getRegion, CYCLONE_RINGS_KM } from "@/lib/mock-marine-data";
import { circlePolygon, haversineKm } from "@/lib/map-utils";

/* Shared popup behaviour: never hides behind floating panels */
const POPUP_OPTS = {
  autoPanPaddingTopLeft: [250, 110] as [number, number],
  autoPanPaddingBottomRight: [90, 270] as [number, number],
};

/* ── Icons (inline SVG divIcons — no emoji, no external sprite) ── */

function divIcon(html: string, size: [number, number], className = ""): L.DivIcon {
  return L.divIcon({ html, className: `orca-icon ${className}`, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] });
}

const vesselIcon = (heading: number, live: boolean) =>
  divIcon(
    `<div class="relative flex items-center justify-center ${live ? "vessel-live" : ""}">
       <span class="vessel-sonar"></span>
       <span class="vessel-sonar s2"></span>
       <span class="vessel-sonar s3"></span>
       <span class="vessel-pulse-ring absolute inset-0 rounded-full" style="background:rgba(18,78,120,.35)"></span>
       <span class="vessel-bob" style="width:26px;height:26px;border-radius:9999px;background:#124E78;border:2px solid #fff;box-shadow:0 1px 4px rgba(23,35,45,.35);display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg)">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(-90deg)"><path d="M12 3l4 9H8z" fill="#fff" stroke="none"/><rect x="7" y="14" width="10" height="4" rx="1" fill="#fff" stroke="none"/></svg>
       </span>
     </div>`,
    [26, 26],
  );

const cycloneIcon = () =>
  divIcon(
    `<div class="relative flex items-center justify-center" style="width:58px;height:58px">
       <svg class="cyclone-spiral" width="58" height="58" viewBox="0 0 58 58" fill="none" style="left:0;top:0">
         <g stroke="#B42318" stroke-width="2" stroke-linecap="round" opacity="0.8">
           <path d="M29 29C29 20 36 13 45 15"/>
           <path d="M29 29C29 38 22 45 13 43"/>
           <path d="M29 29C38 29 45 36 43 45"/>
           <path d="M29 29C20 29 13 22 15 13"/>
         </g>
       </svg>
       <span class="ring-breathe" style="position:absolute;inset:8px;border-radius:9999px;border:1.5px dashed rgba(180,35,24,.75)"></span>
       <div class="cyclone-core hazard-dot-pulse" style="position:relative;width:30px;height:30px;border-radius:9999px;background:#B42318;border:2px solid #fff;display:flex;align-items:center;justify-content:center">
         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M12 10c0-4 3-7 7-6M12 14c0 4-3 7-7 6M14 12c4 0 7 3 6 7M10 12c-4 0-7-3-6-7"/></svg>
       </div>
     </div>`,
    [58, 58],
  );

const pfzIcon = (active: boolean) =>
  divIcon(
    `<div style="width:${active ? 26 : 20}px;height:${active ? 26 : 20}px;border-radius:9999px;background:#0F766E;border:2px solid #fff;box-shadow:0 1px 5px rgba(15,118,110,.4);display:flex;align-items:center;justify-content:center">
       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M2 12s4-6 10-6c4 0 8 3 10 6-2 3-6 6-10 6-6 0-10-6-10-6z" fill="#fff" stroke="none"/><circle cx="17" cy="11" r="1.2" fill="#0F766E" stroke="none"/><path d="M2 12l-1.5-3M2 12l-1.5 3" stroke="#fff" stroke-width="0"/></svg>
     </div>`,
    [26, 26],
  );

const safeIcon = () =>
  divIcon(
    `<div style="width:22px;height:22px;border-radius:9999px;background:#2E7D5B;border:2px solid #fff;box-shadow:0 1px 4px rgba(46,125,91,.35);display:flex;align-items:center;justify-content:center">
       <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r="2.4"/><path d="M12 7.4V20M12 20c-3.6 0-6.4-2.4-7.2-5.4M12 20c3.6 0 6.4-2.4 7.2-5.4M8 10.5h8"/></svg>
     </div>`,
    [22, 22],
  );

const destIcon = () =>
  divIcon(
    `<div style="width:18px;height:18px;border-radius:9999px;background:#0E7490;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(14,116,144,.4)"></div>`,
    [18, 18],
  );

/* ── Store-driven imperatives ──────────────────────────────── */

function MapCommandListener() {
  const map = useMap();
  const mapCommand = useOrcaStore((s) => s.mapCommand);
  const lastSeq = useRef(-1);

  useEffect(() => {
    if (!mapCommand || mapCommand.seq === lastSeq.current) return;
    lastSeq.current = mapCommand.seq;
    const delta: MapDelta = mapCommand.delta;
    if (!delta.focus) return;
    if (delta.focus.kind === "position") {
      map.flyTo([delta.focus.position.lat, delta.focus.position.lng], delta.focus.zoom ?? map.getZoom(), { duration: 1.35 });
    } else {
      const b = L.latLngBounds([
        [delta.focus.bounds[0].lat, delta.focus.bounds[0].lng],
        [delta.focus.bounds[1].lat, delta.focus.bounds[1].lng],
      ]);
      const p = delta.focus.padding ?? [90, 90, 90, 90];
      map.flyToBounds(b, {
        paddingTopLeft: [p[3] ?? 90, p[0] ?? 90],
        paddingBottomRight: [p[1] ?? 90, p[2] ?? 90],
        duration: 1.35,
        maxZoom: 10,
      });
    }
  }, [mapCommand, map]);

  /* Invalidate size after layout settles (drawer, fonts) */
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 250);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  return null;
}

function Readout() {
  const map = useMap();
  const readoutRef = useRef<HTMLDivElement | null>(null);
  useMapEvents({
    move: () => {
      const el = readoutRef.current;
      if (!el) return;
      const c = map.getCenter();
      el.textContent = `${c.lat.toFixed(3)}° N  ·  ${Math.abs(c.lng).toFixed(3)}° E  ·  z${map.getZoom().toFixed(1)}`;
    },
  });
  return (
    <div
      ref={readoutRef}
      className="pointer-events-none absolute bottom-3 right-3 z-[500] rounded-md border border-ocean-line bg-white/90 px-2.5 py-1 font-mono text-[10.5px] tracking-wide text-ocean-slate shadow-sm"
      aria-hidden
    />
  );
}

/* ── Layers ────────────────────────────────────────────────── */

function HazardLayer({ region, visible }: { region: MarineRegion; visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      {region.hazardZones.map((h) => (
        <Polygon
          key={`${region.id}-${h.id}`}
          positions={h.polygon ?? circlePolygon(h.center, h.radiusKm)}
          pathOptions={{
            color: "#B4453A",
            weight: 1.6,
            dashArray: "5 5",
            fillColor: h.severity === "moderate" ? "#C86A2E" : "#B4453A",
            fillOpacity: h.severity === "moderate" ? 0.12 : 0.16,
            className: "hazard-breathe",
          }}
        >
          <Tooltip className="orca-tooltip" direction="top" offset={[0, -6]}>
            {region.id === "mumbai" && h.type === "highWaves" ? h.label : h.label}
          </Tooltip>
          <Popup {...POPUP_OPTS}>
            <div className="min-w-[180px]">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ocean-danger-fg">{h.label}</div>
              <div className="text-[12px] leading-relaxed text-ocean-ink/80">{h.detail}</div>
              <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-ocean-slate">
                severity · {h.severity}
              </div>
            </div>
          </Popup>
        </Polygon>
      ))}
      {region.hazardZones.map((h) => (
        <CircleMarker
          key={`${region.id}-${h.id}-dot`}
          center={[h.center.lat, h.center.lng]}
          radius={5}
          pathOptions={{ color: "#fff", weight: 1.5, fillColor: "#B4453A", fillOpacity: 1 }}
        />
      ))}
    </>
  );
}

function CycloneLayer({ region, visible }: { region: MarineRegion; visible: boolean }) {
  const cyclone = region.cyclone;
  if (!visible || !cyclone) return null;
  return (
    <>
      {CYCLONE_RINGS_KM.map((km, i) => (
        <Circle
          key={`${region.id}-cyc-${km}`}
          center={[cyclone.center.lat, cyclone.center.lng]}
          radius={km * 1000}
          pathOptions={{
            color: "#B42318",
            weight: 1.2,
            dashArray: i === CYCLONE_RINGS_KM.length - 1 ? "3 6" : undefined,
            fillColor: "#B42318",
            fillOpacity: i === 0 ? 0.1 : i === 1 ? 0.05 : 0.025,
            interactive: false,
            className: `ring-breathe${i === 1 ? " d1" : i === 2 ? " d2" : ""}`,
          }}
        />
      ))}
      <Marker position={[cyclone.center.lat, cyclone.center.lng]} icon={cycloneIcon()} zIndexOffset={400}>
        <Tooltip className="orca-tooltip" direction="top" offset={[0, -16]} permanent>
          {`CS ${cyclone.name} · ${cyclone.distanceKm} km ${cyclone.bearing}`}
        </Tooltip>
        <Popup {...POPUP_OPTS}>
          <div className="min-w-[190px]">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ocean-danger-fg">
              Cyclonic Storm {cyclone.name}
            </div>
            <div className="text-[12px] text-ocean-ink/80">
              {cyclone.category} · winds {cyclone.windKmph} km/h
              <br />
              Moving {cyclone.movement}, {cyclone.distanceKm} km {cyclone.bearing} of vessel
            </div>
          </div>
        </Popup>
      </Marker>
    </>
  );
}

function PFZLayer({ region, visible }: { region: MarineRegion; visible: boolean }) {
  if (!visible) return null;
  const vessel = region.vessel.position;
  return (
    <>
      {region.pfzZones.map((z: PFZZone) => {
        const liveDist = haversineKm(vessel, z.center);
        return (
        <Polygon
          key={`${region.id}-${z.id}`}
          positions={z.polygon}
          pathOptions={{
            color: "#0F766E",
            weight: 1.8,
            dashArray: "7 5",
            fillColor: "#0F766E",
            fillOpacity: 0.13,
            className: "pfz-flow",
          }}
        >
          <Tooltip className="orca-tooltip" direction="top" offset={[0, -6]}>
            {z.label}
          </Tooltip>
          <Popup {...POPUP_OPTS}>
            <div className="min-w-[210px]">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ocean-teal-fg">{z.label}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-ocean-ink/85">
                <span className="text-ocean-slate">Distance</span>
                <span className="data-value text-right font-medium">{liveDist.toFixed(1)} km</span>
                <span className="text-ocean-slate">SST</span>
                <span className="data-value text-right font-medium">{z.sst.toFixed(1)} °C</span>
                <span className="text-ocean-slate">Chlorophyll</span>
                <span className="data-value text-right font-medium">{z.chlorophyll.toFixed(1)} mg/m³</span>
                <span className="text-ocean-slate">Depth</span>
                <span className="data-value text-right font-medium">{z.depthM} m</span>
              </div>
              <div className="mt-2 border-t border-ocean-line pt-1.5 text-[11px] text-ocean-slate">
                Expected: {z.expectedSpecies.join(" · ")}
              </div>
            </div>
          </Popup>
        </Polygon>
        );
      })}
      {region.pfzZones.map((z) => (
        <Marker key={`${region.id}-${z.id}-m`} position={[z.center.lat, z.center.lng]} icon={pfzIcon(false)} zIndexOffset={300}>
          <Tooltip className="orca-tooltip" direction="top" offset={[0, -12]} permanent>
            {`PFZ · ${haversineKm(vessel, z.center).toFixed(1)} km`}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

function SafeZoneLayer({ region, visible }: { region: MarineRegion; visible: boolean }) {
  if (!visible) return null;
  return (
    <>
      {region.safeZones.map((z) => (
        <Circle
          key={`${region.id}-${z.id}`}
          center={[z.center.lat, z.center.lng]}
          radius={z.radiusKm * 1000}
          pathOptions={{ color: "#2E7D5B", weight: 1.4, dashArray: "4 5", fillColor: "#2E7D5B", fillOpacity: 0.09, className: "safe-breathe" }}
        >
          <Tooltip className="orca-tooltip" direction="top" offset={[0, -6]}>
            {z.label}
          </Tooltip>
        </Circle>
      ))}
      {region.safeZones.map((z) => (
        <Marker key={`${region.id}-${z.id}-m`} position={[z.center.lat, z.center.lng]} icon={safeIcon()} zIndexOffset={200}>
          <Tooltip className="orca-tooltip" direction="top" offset={[0, -12]} permanent>
            {z.label}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

function RouteLayer({ region, visible }: { region: MarineRegion; visible: boolean }) {
  const route = region.suggestedRoute;
  if (!visible || !route) return null;
  const pts = route.path.map((p) => [p.lat, p.lng]) as [number, number][];
  const dest = route.path[route.path.length - 1];
  return (
    <>
      {/* Energy underlay — wider, marching dashes beneath the route spine */}
      <Polyline
        positions={pts}
        pathOptions={{ color: "#22B8CF", weight: 8.5, opacity: 0.3, className: "route-under", interactive: false }}
      />
      <Polyline positions={pts} pathOptions={{ color: "#0E7490", weight: 3.2, opacity: 0.9, className: "route-draw" }}>
        <Tooltip className="orca-tooltip" direction="top" offset={[0, -8]} permanent>
          {`${route.label} · ${route.distanceKm.toFixed(1)} km · ${route.etaMinutes} min`}
        </Tooltip>
      </Polyline>
      <Marker position={[dest.lat, dest.lng]} icon={destIcon()} zIndexOffset={250} />
    </>
  );
}

function BoundaryLayer({ region, visible }: { region: MarineRegion; visible: boolean }) {
  if (!visible || !region.boundary) return null;
  const pts = region.boundary.path.map((p) => [p.lat, p.lng]) as [number, number][];
  return (
    <Polyline positions={pts} pathOptions={{ color: "#7C8B96", weight: 1.2, dashArray: "2 8", className: "boundary-march" }}>
      <Tooltip className="orca-tooltip" direction="left" offset={[-6, 0]}>
        {region.boundary.label}
      </Tooltip>
    </Polyline>
  );
}

/* ── Main component ────────────────────────────────────────── */

export default function MarineMap() {
  const regionId = useOrcaStore((s) => s.regionId);
  const layers = useOrcaStore((s) => s.layers);
  const isProcessing = useOrcaStore((s) => s.isProcessing);
  const regionData = getRegion(regionId);

  return (
    <MapContainer
      center={[regionData.center.lat, regionData.center.lng]}
      zoom={regionData.defaultZoom}
      zoomControl={false}
      zoomSnap={1}
      zoomDelta={1}
      wheelPxPerZoomLevel={110}
      className="h-full w-full"
      attributionControl
      minZoom={5}
      maxZoom={12}
    >
      <TileLayer
        attribution='Ocean basemap &copy; <a href="https://www.esri.com/">Esri</a>, GEBCO, NOAA · place names &copy; Esri · overlays simulated'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={13}
        maxNativeZoom={10}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}"
        maxZoom={13}
        maxNativeZoom={10}
        opacity={0.85}
      />
      <ZoomControl position="bottomright" />
      <MapCommandListener />
      <Readout />

      <BoundaryLayer region={regionData} visible={layers.boundary} />
      <SafeZoneLayer region={regionData} visible={layers.safe} />
      <PFZLayer region={regionData} visible={layers.pfz} />
      <HazardLayer region={regionData} visible={layers.risk} />
      <CycloneLayer region={regionData} visible={layers.cyclone} />
      <RouteLayer region={regionData} visible={layers.route} />

      {/* Vessel — always on top */}
      {layers.vessel && (
        <Marker position={[regionData.vessel.position.lat, regionData.vessel.position.lng]} icon={vesselIcon(regionData.vessel.headingDeg, isProcessing)} zIndexOffset={600}>
          <Tooltip className="orca-tooltip" direction="top" offset={[0, -14]} permanent>
            {`${regionData.vessel.name} · ${regionData.vessel.status}`}
          </Tooltip>
          <Popup {...POPUP_OPTS}>
            <div className="min-w-[180px]">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ocean-navy">{regionData.vessel.name}</div>
              <div className="text-[12px] text-ocean-ink/80">
                Fishing vessel · {regionData.vessel.status}
                <br />
                Position {regionData.vessel.position.lat.toFixed(3)}° N, {Math.abs(regionData.vessel.position.lng).toFixed(3)}° E
              </div>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
