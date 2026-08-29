/**
 * ORCA — Workspace store (Zustand).
 *
 * Single source of truth for conversation, map commands, alerts and
 * toasts. The map never reads chat state; it only consumes a
 * monotonically increasing `mapCommand` queue, which keeps the chat →
 * map coupling declarative and testable.
 */

import { create } from "zustand";
import type {
  AppState,
  ChatMessage,
  Language,
  MapDelta,
  MapLayerId,
  MapLayers,
  MarineAlert,
  OrcaResponse,
  OrcaToast,
  ToastTone,
} from "@/types/orca";
import type { AgentId, RegionId } from "@/types/marine";
import { getRegion, REGIONS } from "./mock-marine-data";
import { PROCESSING_STAGES, synthesizeResponse } from "./mock-orca";

const DEFAULT_LAYERS: MapLayers = {
  vessel: true,
  risk: false,
  cyclone: false,
  pfz: false,
  safe: false,
  route: false,
  boundary: false,
};

let msgCounter = 0;
function mid(prefix: string): string {
  msgCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${msgCounter}`;
}

interface MapCommand {
  seq: number;
  delta: MapDelta;
  /** Direct fly request (alerts, region switch) */
  direct?: { position: { lat: number; lng: number }; zoom?: number };
}

interface OrcaState {
  /* app */
  appState: AppState;
  language: Language;
  regionId: RegionId;
  demoMode: boolean;
  bootedAt: number;

  /* conversation */
  messages: ChatMessage[];
  isProcessing: boolean;
  activeResponse: OrcaResponse | null;

  /* map */
  layers: MapLayers;
  mapCommand: MapCommand | null;
  mapTouched: boolean;

  /* alerts */
  alerts: MarineAlert[];
  unreadAlerts: number;
  activeAlert: MarineAlert | null;

  /* toasts */
  toasts: OrcaToast[];

  /* runners */
  runToken: number;
  errorProbe: boolean;

  /* actions */
  setLanguage: (l: Language) => void;
  setRegion: (r: RegionId) => void;
  toggleDemoMode: () => void;
  sendQuery: (text: string) => void;
  runSuggestion: (query: string) => void;
  retryLast: () => void;
  newSession: () => void;
  toggleLayer: (id: MapLayerId) => void;
  setLayers: (ids: Partial<MapLayers>) => void;
  applyMapDelta: (delta: MapDelta) => void;
  flyTo: (position: { lat: number; lng: number }, zoom?: number) => void;
  setActiveResponse: (r: OrcaResponse | null) => void;
  pushToast: (tone: ToastTone, title: string, description?: string) => void;
  dismissToast: (id: string) => void;
  raiseAlert: (alert: MarineAlert) => void;
  dismissAlert: () => void;
  viewAlertOnMap: (alert: MarineAlert) => void;
  markAlertsRead: () => void;
}

/** Build the proactive alert payload for the current region. */
function buildRegionAlert(regionId: RegionId): MarineAlert {
  const region = getRegion(regionId);
  const cyclone = region.cyclone;
  if (cyclone) {
    return {
      id: mid("alert"),
      title: "NEW MARINE ALERT",
      titleHi: "नई समुद्री चेतावनी",
      body: `Cyclone activity detected ${cyclone.distanceKm} km ${cyclone.bearing} of your monitored area. Squally winds likely.`,
      bodyHi: `आपके निगरानी क्षेत्र से ${cyclone.distanceKm} किमी ${cyclone.bearing} चक्रवाती गतिविधि पाई गई। तेज़ हवाएं संभव।`,
      severity: "warning",
      regionId,
      focus: { position: cyclone.center, zoom: 9 },
      enableLayers: ["risk", "cyclone"],
      createdAt: Date.now(),
    };
  }
  const hz = region.hazardZones[0];
  return {
    id: mid("alert"),
    title: "NEW MARINE ALERT",
    titleHi: "नई समुद्री चेतावनी",
    body: `${hz ? hz.label : "Rough sea"} detected near your monitored area. Review the zone before departure.`,
    bodyHi: `आपके निगरानी क्षेत्र के पास ${hz ? hz.labelHi : "कठोर समुद्र"} पाया गया। प्रस्थान से पहले क्षेत्र देखें।`,
    severity: hz?.severity === "high" ? "critical" : "warning",
    regionId,
    focus: { position: hz ? hz.center : region.vessel.position, zoom: 9 },
    enableLayers: ["risk", "vessel"],
    createdAt: Date.now(),
  };
}

export const useOrcaStore = create<OrcaState>((set, get) => {
  /* Staged processing runner — module scoped so timers stay chained. */
  const runPipeline = (queryText: string, token: number, processingId: string) => {
    const { regionId, language } = get();
    const response = synthesizeResponse(queryText, getRegion(regionId));
    const stageMs = response.stageMs ?? 600;
    const stages = PROCESSING_STAGES;

    const patchProcessing = (patch: Partial<ChatMessage>) =>
      set((s) => ({
        messages: s.messages.map((m) => (m.id === processingId ? { ...m, ...patch } : m)),
      }));

    /* Stage 0 lands immediately */
    patchProcessing({ stages, activeStage: 0 });
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === processingId
          ? { ...m, response: { ...response, agents: response.agents.map((a, i) => ({ ...a, status: i === 0 ? "active" : "pending" })) } }
          : m,
      ),
    }));

    /* Error probe: typing "error" simulates a mid-run failure */
    if (/^\s*(error|simulate error)\s*$/i.test(queryText)) {
      window.setTimeout(() => {
        if (get().runToken !== token) return;
        patchProcessing({ activeStage: 2 });
        window.setTimeout(() => {
          if (get().runToken !== token) return;
          set((s) => ({
            appState: "error",
            isProcessing: false,
            messages: s.messages.map((m) =>
              m.id === processingId
                ? {
                    ...m,
                    kind: "error" as const,
                    text: "Unable to retrieve marine information. Please try again.",
                    stages: undefined,
                  }
                : m,
            ),
          }));
        }, 1400);
      }, 1000);
      return;
    }

    let i = 0;
    const advance = () => {
      if (get().runToken !== token) return; // superseded by newer query
      i += 1;
      if (i < stages.length) {
        patchProcessing({ activeStage: i });
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === processingId && m.response
              ? {
                  ...m,
                  response: {
                    ...m.response,
                    agents: m.response.agents.map((a, ai) => ({
                      ...a,
                      status: ai < i ? ("complete" as const) : ai === i ? ("active" as const) : ("pending" as const),
                    })),
                  },
                }
              : m,
          ),
        }));
        window.setTimeout(advance, stageMs);
        return;
      }
      /* Pipeline complete → materialise result */
      const finalResponse: OrcaResponse = {
        ...response,
        agents: response.agents.map((a) => ({ ...a, status: "complete" as const })),
      };
      set((s) => ({
        appState: "answered",
        isProcessing: false,
        activeResponse: finalResponse,
        messages: s.messages.map((m) =>
          m.id === processingId
            ? { ...m, kind: "orca-result" as const, response: finalResponse, activeStage: undefined }
            : m,
        ),
        layers: {
          ...s.layers,
          ...(Object.fromEntries(
            (response.map.enableLayers ?? []).map((k) => [k, true]),
          ) as Partial<MapLayers>),
          ...(Object.fromEntries(
            (response.map.disableLayers ?? []).map((k) => [k, false]),
          ) as Partial<MapLayers>),
        },
        mapCommand: { seq: (s.mapCommand?.seq ?? 0) + 1, delta: response.map },
      }));
      get().pushToast("success", language === "hi" ? "विश्लेषण पूर्ण" : "Analysis complete",
        language === "hi" ? "नक्शा अपडेट हुआ" : "Map updated");
    };
    window.setTimeout(advance, stageMs);
  };

  return {
    appState: "idle",
    language: "en",
    regionId: "mumbai",
    demoMode: true,
    bootedAt: Date.now(),

    messages: [],
    isProcessing: false,
    activeResponse: null,

    layers: { ...DEFAULT_LAYERS },
    mapCommand: null,
    mapTouched: false,

    alerts: [],
    unreadAlerts: 0,
    activeAlert: null,

    toasts: [],

    runToken: 0,
    errorProbe: false,

    setLanguage: (l) => set({ language: l }),

    setRegion: (r) => {
      const prev = get().regionId;
      if (prev === r) return;
      set((s) => ({
        regionId: r,
        layers: { ...DEFAULT_LAYERS },
        activeResponse: null,
        mapCommand: {
          seq: (s.mapCommand?.seq ?? 0) + 1,
          delta: { focus: { kind: "position", position: getRegion(r).center, zoom: getRegion(r).defaultZoom }, enableLayers: ["vessel"], disableLayers: ["risk", "cyclone", "pfz", "safe", "route", "boundary"] },
        },
        messages: [
          ...s.messages,
          {
            id: mid("sys"),
            kind: "orca-system" as const,
            text: `Monitored region switched to ${getRegion(r).name}.`,
            textHi: `निगरानी क्षेत्र ${getRegion(r).nameHi} में बदला गया।`,
            createdAt: Date.now(),
          },
        ],
      }));
    },

    toggleDemoMode: () => set((s) => ({ demoMode: !s.demoMode })),

    sendQuery: (text) => {
      const trimmed = text.trim();
      if (!trimmed || get().isProcessing) return;
      const token = get().runToken + 1;
      set((s) => ({
        runToken: token,
        appState: "processing",
        isProcessing: true,
        activeResponse: null,
        messages: [
          ...s.messages,
          { id: mid("user"), kind: "user", text: trimmed, createdAt: Date.now() },
        ],
      }));
      /* Ack bubble */
      const ackPreview = synthesizeResponse(trimmed, getRegion(get().regionId));
      const processingId = mid("proc");
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: mid("ack"),
            kind: "orca-text",
            text: ackPreview.ack,
            textHi: ackPreview.ackHi,
            createdAt: Date.now(),
          },
          {
            id: processingId,
            kind: "orca-processing" as const,
            createdAt: Date.now(),
            stages: PROCESSING_STAGES,
            activeStage: -1,
          },
        ],
      }));
      runPipeline(trimmed, token, processingId);
    },

    runSuggestion: (query) => {
      /* Suggestions carry both languages; send the one matching current language */
      const { language } = get();
      const match = query;
      void match;
      void language;
      get().sendQuery(query);
    },

    retryLast: () => {
      const { messages } = get();
      const lastUser = [...messages].reverse().find((m) => m.kind === "user");
      if (lastUser?.text) get().sendQuery(lastUser.text);
    },

    newSession: () => {
      set((s) => ({
        runToken: s.runToken + 1,
        appState: "idle",
        messages: [],
        isProcessing: false,
        activeResponse: null,
        layers: { ...DEFAULT_LAYERS },
        mapCommand: {
          seq: (s.mapCommand?.seq ?? 0) + 1,
          delta: {
            focus: { kind: "position", position: getRegion(get().regionId).center, zoom: getRegion(get().regionId).defaultZoom },
            disableLayers: ["risk", "cyclone", "pfz", "safe", "route"],
          },
        },
      }));
    },

    toggleLayer: (id) => set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),

    setLayers: (ids) => set((s) => ({ layers: { ...s.layers, ...ids } })),

    applyMapDelta: (delta) =>
      set((s) => ({
        mapCommand: { seq: (s.mapCommand?.seq ?? 0) + 1, delta },
        mapTouched: true,
      })),

    flyTo: (position, zoom) =>
      set((s) => ({
        mapCommand: { seq: (s.mapCommand?.seq ?? 0) + 1, delta: { focus: { kind: "position", position, zoom } } },
        mapTouched: true,
      })),

    setActiveResponse: (r) => set({ activeResponse: r }),

    pushToast: (tone, title, description) => {
      const id = mid("toast");
      set((s) => ({ toasts: [...s.toasts, { id, tone, title, description }] }));
      window.setTimeout(() => get().dismissToast(id), 3400);
    },

    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    raiseAlert: (alert) => {
      const { language } = get();
      set((s) => ({
        appState: "alert",
        alerts: [alert, ...s.alerts],
        activeAlert: alert,
        unreadAlerts: s.unreadAlerts + 1,
        messages: [
          ...s.messages,
          {
            id: mid("sys"),
            kind: "orca-system" as const,
            alertId: alert.id,
            text: `A new marine alert has been detected near your monitored area. ${alert.body}`,
            textHi: `आपके निगरानी क्षेत्र के पास एक नई समुद्री चेतावनी पाई गई है। ${alert.bodyHi}`,
            createdAt: Date.now(),
          },
        ],
      }));
      get().pushToast("danger", language === "hi" ? "समुद्री चेतावनी प्राप्त हुई" : "Marine alert received");
    },

    dismissAlert: () => set({ activeAlert: null }),

    viewAlertOnMap: (alert) => {
      set((s) => ({
        activeAlert: null,
        layers: { ...s.layers, ...Object.fromEntries(alert.enableLayers.map((k) => [k, true])) } as MapLayers,
        mapCommand: {
          seq: (s.mapCommand?.seq ?? 0) + 1,
          delta: { focus: { kind: "position", position: alert.focus.position, zoom: alert.focus.zoom } },
        },
      }));
    },

    markAlertsRead: () => set({ unreadAlerts: 0 }),
  };
});

export { buildRegionAlert, REGIONS };
