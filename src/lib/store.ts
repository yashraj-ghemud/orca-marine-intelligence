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
import type { RegionId } from "@/types/marine";
import type { OrcaRequest, OrcaResult, TraceEntry } from "./server/contracts";
import { getRegion, REGIONS } from "./mock-marine-data";
import { errorText, t } from "./i18n";

const DEFAULT_LAYERS: MapLayers = {
  vessel: true,
  risk: false,
  cyclone: false,
  pfz: false,
  safe: false,
  route: false,
  boundary: false,
};

const LIVE_LAYERS: MapLayers = { ...DEFAULT_LAYERS, vessel: false };
const ALL_LAYERS = Object.keys(DEFAULT_LAYERS) as MapLayerId[];

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

/*
 * Cinematic intro state machine:
 *   boot     — SSR + first client frame; every shell element hidden
 *   playing  — full-screen cinematic overlay (ocean → title → handoff)
 *   assembly — overlay lifted; elements fly / collide / cascade into place
 *   done     — app fully revealed; ambient motion takes over
 */
export type IntroPhase = "boot" | "playing" | "assembly" | "done";

interface OrcaState {
  /* app */
  appState: AppState;
  language: Language;
  mobileTab: "chat" | "chart";
  regionId: RegionId;
  demoMode: boolean;
  bootedAt: number;
  sessionRevision: number;

  /* cinematic intro */
  introPhase: IntroPhase;
  introFast: boolean;

  /* conversation */
  messages: ChatMessage[];
  isProcessing: boolean;
  activeResponse: OrcaResponse | null;
  pipelineTrace: TraceEntry[];
  backendStatus: OrcaResult["status"] | null;
  queryImage: string | null;

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

  /**
   * The answer to speak aloud. Set only when the question came in by voice,
   * so a typed question is never read back unasked. `id` changes per answer.
   */
  voiceReply: { id: string; text: string; language: Language } | null;
  clearVoiceReply: () => void;

  /* actions */
  setIntroPhase: (phase: IntroPhase, fast?: boolean) => void;
  setLanguage: (l: Language) => void;
  setMobileTab: (tab: "chat" | "chart") => void;
  setRegion: (r: RegionId) => void;
  toggleDemoMode: () => void;
  sendQuery: (text: string, image?: string, options?: { spoken?: boolean }) => void;
  cancelQuery: () => void;
  setQueryImage: (image: string | null) => void;
  runSuggestion: (query: string) => void;
  retryLast: (messageId?: string) => void;
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
  let controller: AbortController | null = null;
  const requests = new Map<string, OrcaRequest>();

  const spoken = new Set<string>();
  const runRequest = async (request: OrcaRequest, retryId?: string, options: { spoken?: boolean } = {}) => {
    if (get().isProcessing) return;
    const token = get().runToken + 1;
    const processingId = retryId ?? mid("proc");
    if (options.spoken) spoken.add(processingId);
    const processingMessage: ChatMessage = {
      id: processingId, kind: "orca-processing", responseMode: request.mode,
      originalLanguage: request.language, createdAt: Date.now(),
    };
    const currentController = new AbortController();
    controller = currentController;
    requests.set(processingId, request);
    set((s) => ({
      runToken: token, appState: "processing", isProcessing: true,
      activeResponse: null, pipelineTrace: [], backendStatus: null, queryImage: null,
      layers: { ...(s.demoMode ? DEFAULT_LAYERS : LIVE_LAYERS) },
      mapCommand: { seq: (s.mapCommand?.seq ?? 0) + 1, delta: {
        disableLayers: ALL_LAYERS.filter(id => !s.demoMode || id !== "vessel"),
      } },
      // Keep the mission's message ID on retry without retaining old result/error fields.
      messages: retryId ? s.messages.map(m => m.id === retryId ? { ...processingMessage, createdAt: m.createdAt } : m) : [...s.messages,
        { id: mid("user"), kind: "user", text: request.query, image: request.image, responseMode: request.mode, originalLanguage: request.language, createdAt: Date.now() },
        processingMessage,
      ],
    }));
    try {
      const http = await fetch("/api/orca", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request), signal: currentController.signal,
      });
      const result: OrcaResult = await http.json();
      if (currentController.signal.aborted || get().runToken !== token) return;
      if (!result || !Array.isArray(result.trace)) throw new Error("Invalid API response");
      set({ pipelineTrace: result.trace });
      if (result.status === "error") {
        // Only the API's safe error envelope is shown, never raw transport errors or HTML.
        const message = errorText(request.language, result.error?.code, typeof result.error?.message === "string" ? result.error.message : undefined);
        set((s) => ({
          appState: "error", isProcessing: false, backendStatus: "error",
          messages: s.messages.map(m => m.id === processingId ? { ...m, kind: "error", text: message, backendStatus: result.status, pipelineTrace: result.trace } : m),
        }));
        return;
      }
      if (!http.ok || !["ok", "degraded"].includes(result.status) || result.mode !== request.mode || !result.response?.verdict || !result.response.map) {
        throw new Error("Invalid API response");
      }
      const response = { ...result.response, responseMode: result.mode, originalLanguage: request.language };
      const delta: MapDelta = request.mode === "live" ? { disableLayers: ALL_LAYERS } : response.map;
      set((s) => ({
        appState: "answered", isProcessing: false, activeResponse: response, backendStatus: result.status,
        messages: s.messages.map(m => m.id === processingId ? { ...m, kind: "orca-result", response, backendStatus: result.status, pipelineTrace: result.trace } : m),
        layers: request.mode === "live" ? { ...LIVE_LAYERS } : {
          ...DEFAULT_LAYERS,
          ...Object.fromEntries((delta.enableLayers ?? []).map(id => [id, true])),
          ...Object.fromEntries((delta.disableLayers ?? []).map(id => [id, false])),
        },
        mapCommand: { seq: (s.mapCommand?.seq ?? 0) + 1, delta },
      }));
      get().pushToast(result.status === "degraded" ? "warn" : "success", t(request.language, result.status === "degraded" ? "analysisDegraded" : "analysisComplete"));
      if (spoken.delete(processingId)) {
        // Read the card's headline and summary in the language of the question.
        const hi = request.language === "hi";
        const text = [hi ? response.ackHi : response.ack, hi ? response.verdict.summaryHi : response.verdict.summary]
          .filter((part, i, all) => part && all.indexOf(part) === i).join(" ");
        set({ voiceReply: { id: processingId, text, language: request.language } });
      }
    } catch {
      if (currentController.signal.aborted || get().runToken !== token) return;
      set((s) => ({
        appState: "error", isProcessing: false, backendStatus: "error",
        messages: s.messages.map(m => m.id === processingId ? { ...m, kind: "error", text: t(request.language, "requestFailed"), backendStatus: "error", pipelineTrace: s.pipelineTrace } : m),
      }));
    } finally {
      if (controller === currentController) controller = null;
    }
  };

  return {
    appState: "idle",
    language: "en",
    mobileTab: "chat",
    regionId: "mumbai",
    demoMode: true,
    bootedAt: Date.now(),
    sessionRevision: 0,

    introPhase: "boot" as IntroPhase,
    introFast: false,

    setIntroPhase: (phase, fast) =>
      set((s) => ({
        introPhase: phase,
        introFast: fast ?? (phase === "assembly" ? s.introFast : false),
      })),

    messages: [],
    isProcessing: false,
    activeResponse: null,
    pipelineTrace: [],
    backendStatus: null,
    queryImage: null,

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
    setMobileTab: (tab) => set({ mobileTab: tab }),

    setRegion: (r) => {
      const prev = get().regionId;
      if (prev === r) return;
      get().cancelQuery();
      requests.clear();
      set((s) => ({
        regionId: r,
        sessionRevision: s.sessionRevision + 1,
        appState: "idle",
        mobileTab: "chat",
        pipelineTrace: [], backendStatus: null, queryImage: null,
        alerts: [], unreadAlerts: 0, activeAlert: null, toasts: [], mapTouched: false,
        layers: { ...(s.demoMode ? DEFAULT_LAYERS : LIVE_LAYERS) },
        activeResponse: null,
        mapCommand: {
          seq: (s.mapCommand?.seq ?? 0) + 1,
          delta: { focus: { kind: "position", position: getRegion(r).center, zoom: getRegion(r).defaultZoom }, enableLayers: s.demoMode ? ["vessel"] : [], disableLayers: ALL_LAYERS.filter(id => !s.demoMode || id !== "vessel") },
        },
        messages: [
          {
            id: mid("sys"),
            kind: "orca-system" as const,
            originalLanguage: s.language,
            text: `Monitored region switched to ${getRegion(r).name}.`,
            textHi: `निगरानी क्षेत्र ${getRegion(r).nameHi} में बदला गया।`,
            textGu: `નિરીક્ષણ ક્ષેત્ર ${getRegion(r).name} પર બદલાયું.`,
            createdAt: Date.now(),
          },
        ],
      }));
    },

    toggleDemoMode: () => {
      set((s) => ({ demoMode: !s.demoMode }));
      get().newSession();
    },

    sendQuery: (text, image, options) => {
      const trimmed = text.trim();
      if (!trimmed || get().isProcessing) return;
      const { regionId, language, demoMode } = get();
      void runRequest({ query: trimmed, regionId, language, mode: demoMode ? "demo" : "live", ...(image ? { image } : {}) }, undefined, options);
    },

    voiceReply: null,
    clearVoiceReply: () => set({ voiceReply: null }),

    setQueryImage: (image) => set({ queryImage: get().demoMode ? null : image }),

    cancelQuery: () => {
      controller?.abort();
      controller = null;
      set((s) => ({
        runToken: s.runToken + 1, isProcessing: false,
        appState: s.activeResponse ? "answered" : "idle",
        messages: s.messages.map(m => m.kind === "orca-processing" ? {
          ...m, kind: "orca-system", text: t("en", "requestCancelled"),
          textHi: t("hi", "requestCancelled"), textGu: t("gu", "requestCancelled"),
        } : m),
      }));
    },

    runSuggestion: (query) => get().sendQuery(query),

    retryLast: (messageId) => {
      const { messages, regionId, demoMode } = get();
      const id = messageId ?? [...messages].reverse().find(m => requests.has(m.id))?.id;
      const request = id ? requests.get(id) : undefined;
      if (request && request.regionId === regionId && request.mode === (demoMode ? "demo" : "live")) void runRequest(request, id);
    },

    newSession: () => {
      get().cancelQuery();
      requests.clear();
      set((s) => ({
        runToken: s.runToken + 1,
        sessionRevision: s.sessionRevision + 1,
        appState: "idle",
        messages: [],
        mobileTab: "chat",
        isProcessing: false,
        activeResponse: null,
        pipelineTrace: [], backendStatus: null, queryImage: null,
        alerts: [], unreadAlerts: 0, activeAlert: null, toasts: [], mapTouched: false,
        layers: { ...(s.demoMode ? DEFAULT_LAYERS : LIVE_LAYERS) },
        mapCommand: {
          seq: (s.mapCommand?.seq ?? 0) + 1,
          delta: {
            focus: { kind: "position", position: getRegion(get().regionId).center, zoom: getRegion(get().regionId).defaultZoom },
            enableLayers: s.demoMode ? ["vessel"] : [],
            disableLayers: ALL_LAYERS.filter(id => !s.demoMode || id !== "vessel"),
          },
        },
      }));
    },

    toggleLayer: (id) => set((s) => ({ layers: s.demoMode ? { ...s.layers, [id]: !s.layers[id] } : { ...LIVE_LAYERS } })),

    setLayers: (ids) => set((s) => ({ layers: s.demoMode ? { ...s.layers, ...ids } : { ...LIVE_LAYERS } })),

    applyMapDelta: (delta) =>
      set((s) => ({
        mapCommand: { seq: (s.mapCommand?.seq ?? 0) + 1, delta: s.demoMode ? delta : { disableLayers: ALL_LAYERS } },
        // Reopening an answer must not inherit overlays from a later answer.
        layers: s.demoMode ? {
          ...DEFAULT_LAYERS,
          ...Object.fromEntries((delta.enableLayers ?? []).map(id => [id, true])),
          ...Object.fromEntries((delta.disableLayers ?? []).map(id => [id, false])),
        } : { ...LIVE_LAYERS },
        mapTouched: true,
        mobileTab: "chart",
      })),

    flyTo: (position, zoom) =>
      set((s) => ({
        mapCommand: { seq: (s.mapCommand?.seq ?? 0) + 1, delta: { focus: { kind: "position", position, zoom } } },
        mapTouched: true,
      })),

    setActiveResponse: (r) => {
      if (r && (r.responseMode ?? "demo") !== (get().demoMode ? "demo" : "live")) return;
      set({ activeResponse: r });
    },

    pushToast: (tone, title, description) => {
      const id = mid("toast");
      set((s) => ({ toasts: [...s.toasts, { id, tone, title, description }] }));
      window.setTimeout(() => get().dismissToast(id), 3400);
    },

    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    raiseAlert: (alert) => {
      if (!get().demoMode || alert.regionId !== get().regionId) return;
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
            originalLanguage: language,
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
      if (!get().demoMode || alert.regionId !== get().regionId) return;
      set((s) => ({
        activeAlert: null,
        mobileTab: "chart",
        mapTouched: true,
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
