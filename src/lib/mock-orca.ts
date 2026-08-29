/**
 * ORCA — Mock intent router + response synthesis engine.
 *
 * Simulates the multi-agent pipeline completely on the frontend:
 *   intent → weather/ocean → geospatial/risk → data discovery →
 *   verification → synthesis
 *
 * The shape of OrcaResponse mirrors what a real backend would return,
 * so the store can later swap `synthesizeResponse` for an API call
 * without touching any UI component.
 */

import type {
  AgentId,
  AgentRun,
  EvidenceItem,
  MarineRegion,
  RiskLevel,
} from "@/types/marine";
import type { IntentKind, OrcaResponse } from "@/types/orca";
import { haversineKm, bearingLabel } from "./map-utils";

/* ────────────────────────────────────────────────────────────
   Intent routing — keyword based, English + Hindi (incl. romanised)
   ──────────────────────────────────────────────────────────── */

const INTENT_KEYWORDS: Record<Exclude<IntentKind, "unknown">, string[]> = {
  safety: [
    "safe", "safety", "sail", "venture", "go fishing", "go out",
    "surakshit", "suraksha", "jaana", "jana chahiye", "kya kal", "subah",
    "निरापद", "सुरक्षित", "जाना", "कल सुबह",
  ],
  pfz: [
    "pfz", "fishing zone", "zone", "where to fish", "fish today", "nearest",
    "catch", "machhli", "machli", "machli pakadne", "kshetra",
    "मछली", "क्षेत्र", "नज़दीकी", "नजदीकी",
  ],
  hazard: [
    "hazard", "cyclone", "storm", "danger", "alert", "warning", "risk",
    "khatra", "khatar", "toofan", "चक्रवात", "खतरा", "तूफान", "चेतावनी",
  ],
  route: [
    "route", "avoid", "path", "navigate", "way", "reach", "how can i",
    "rasta", "raasta", "bachav", "bache", "मार्ग", "रास्ता", "बच",
  ],
  conditions: [
    "condition", "weather", "wave", "wind", "temperature", "sst",
    "forecast", "haalat", "paristhiti", "मौसम", "परिस्थिति", "हालात", "लहर", "हवा",
  ],
};

/** Classify a free-text query. Hindi and romanised Hindi included. */
export function routeIntent(raw: string): IntentKind {
  const q = raw.toLowerCase().trim();
  if (!q) return "unknown";

  // PFZ must outrank safety when both appear ("safe fishing zone")
  const scores = (Object.keys(INTENT_KEYWORDS) as Exclude<IntentKind, "unknown">[])
    .map((intent) => {
      const hits = INTENT_KEYWORDS[intent].filter((kw) => q.includes(kw)).length;
      return { intent, hits };
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (scores.length === 0) return "unknown";
  // mild disambiguation: hazard intent beats safety if "cyclone/storm" present
  if (scores[0].intent === "safety" && (q.includes("cyclone") || q.includes("चक्रवात") || q.includes("toofan") || q.includes("तूफान"))) {
    return "hazard";
  }
  return scores[0].intent;
}

/* ────────────────────────────────────────────────────────────
   Agent pipeline scaffolding
   ──────────────────────────────────────────────────────────── */

const AGENT_META: Record<AgentId, { label: string; labelHi: string }> = {
  intent: { label: "Request understanding", labelHi: "अनुरोध समझ" },
  weatherOcean: { label: "Weather & Ocean", labelHi: "मौसम और महासागर" },
  geospatialRisk: { label: "Geospatial & Risk", labelHi: "भू-स्थानिक और जोखिम" },
  dataDiscovery: { label: "Marine data discovery", labelHi: "समुद्री डेटा खोज" },
  verification: { label: "Data verification", labelHi: "डेटा सत्यापन" },
  synthesis: { label: "Response synthesis", labelHi: "उत्तर संश्लेषण" },
};

function agentRuns(
  contributions: Partial<Record<AgentId, { en: string; hi: string }>>,
): AgentRun[] {
  return (Object.keys(AGENT_META) as AgentId[]).map((id) => ({
    id,
    label: AGENT_META[id].label,
    labelHi: AGENT_META[id].labelHi,
    status: "pending" as const,
    contribution: contributions[id]?.en ?? "",
    contributionHi: contributions[id]?.hi ?? "",
  }));
}

export const PROCESSING_STAGES: AgentId[] = [
  "intent",
  "weatherOcean",
  "geospatialRisk",
  "dataDiscovery",
  "verification",
  "synthesis",
];

/* ────────────────────────────────────────────────────────────
   Evidence builders
   ──────────────────────────────────────────────────────────── */

function waveTone(m: number): EvidenceItem["tone"] {
  if (m >= 2.5) return "danger";
  if (m >= 1.5) return "warn";
  return "good";
}
function cycloneTone(km: number): EvidenceItem["tone"] {
  if (km < 120) return "danger";
  if (km < 250) return "warn";
  return "good";
}
function riskFromRegion(region: MarineRegion): RiskLevel {
  const wave = region.conditions.waveHeightM;
  const cycloneClose = region.cyclone ? region.cyclone.distanceKm < 120 : false;
  const severeHazard = region.hazardZones.some((h) => h.severity === "high" || h.severity === "severe");
  if (cycloneClose || (wave >= 2.6 && severeHazard)) return "high";
  if (wave >= 1.8 || severeHazard) return "moderate";
  return "low";
}

/* ────────────────────────────────────────────────────────────
   Response synthesis per intent
   ──────────────────────────────────────────────────────────── */

let responseCounter = 0;
function rid(): string {
  responseCounter += 1;
  return `resp-${Date.now().toString(36)}-${responseCounter}`;
}

export function synthesizeResponse(query: string, region: MarineRegion): OrcaResponse {
  const intent = routeIntent(query);
  const c = region.conditions;
  const v = region.vessel;
  const pfz = [...region.pfzZones].sort((a, b) => a.distanceKm - b.distanceKm)[0];

  switch (intent) {
    /* ── SAFETY ─────────────────────────────────────────── */
    case "safety": {
      const risk = riskFromRegion(region);
      const cyclone = region.cyclone;
      const evidence: EvidenceItem[] = [
        {
          category: "weather",
          label: "Wave height",
          labelHi: "तरंग ऊंचाई",
          value: `${c.waveHeightM.toFixed(1)} m`,
          tone: waveTone(c.waveHeightM),
        },
        {
          category: "weather",
          label: "Wind",
          labelHi: "हवा",
          value: `${c.windSpeedKmph} km/h · gusts ${c.windGustKmph}`,
          tone: c.windGustKmph >= 35 ? "warn" : "neutral",
        },
        ...(cyclone
          ? [
              {
                category: "geospatial" as const,
                label: "Cyclone proximity",
                labelHi: "चक्रवात दूरी",
                value: `${cyclone.distanceKm} km ${cyclone.bearing}`,
                tone: cycloneTone(cyclone.distanceKm),
              },
            ]
          : []),
        {
          category: "marine",
          label: "Advisory",
          labelHi: "सलाह",
          value: c.advisoryActive ? "Active" : "Clear",
          tone: c.advisoryActive ? "warn" : "good",
        },
        {
          category: "ocean",
          label: "Visibility",
          labelHi: "दृश्यता",
          value: `${c.visibilityKm} km`,
          tone: c.visibilityKm < 5 ? "warn" : "neutral",
        },
      ];
      const whyHigh = [
        `Wave height ${c.waveHeightM.toFixed(1)} m exceeds the 2.5 m small-vessel threshold`,
        `Wind gusts up to ${c.windGustKmph} km/h from ${c.windDirection}`,
        ...(cyclone
          ? [`Cyclonic storm "${cyclone.name}" is ~${cyclone.distanceKm} km ${cyclone.bearing} of your vessel`]
          : []),
        ...(c.advisoryActive ? ["An official-style marine advisory is active for this coast"] : []),
      ];
      const whyMod = [
        `Wave height ${c.waveHeightM.toFixed(1)} m is near the caution threshold`,
        `Wind ${c.windSpeedKmph} km/h with gusts ${c.windGustKmph} km/h`,
        ...(c.advisoryActive ? ["A marine advisory is in effect — verify locally before departing"] : []),
      ];
      const whyLow = [
        `Wave height ${c.waveHeightM.toFixed(1)} m is within safe operating range`,
        `Light winds ${c.windSpeedKmph} km/h from ${c.windDirection}`,
        "No active marine advisory for this coast",
      ];
      const why = risk === "high" ? whyHigh : risk === "moderate" ? whyMod : whyLow;
      const summary =
        risk === "high"
          ? "Conditions near the selected location indicate elevated marine risk. Staying in harbour is strongly advised."
          : risk === "moderate"
            ? "Marginal conditions near the selected location. Proceed only with caution and local verification."
            : "Favourable conditions near the selected location. Standard safety checks still apply.";
      const summaryHi =
        risk === "high"
          ? "चयनित स्थान के पास परिस्थितियां बढ़ी हुई समुद्री जोखिम दर्शाती हैं। बंदरगाह में रहने की सलाह दी जाती है।"
          : risk === "moderate"
            ? "चयनित स्थान के पास सीमांत परिस्थितियां। केवल सावधानी से और स्थानीय सत्यापन के साथ ही आगे बढ़ें।"
            : "चयनित स्थान के पास अनुकूल परिस्थितियां। सामान्य सुरक्षा जांच फिर भी जरूरी हैं।";
      return {
        id: rid(),
        intent,
        ack: "I'll check the marine conditions for your area.",
        ackHi: "मैं आपके क्षेत्र की समुद्री परिस्थितियों की जांच करता हूं।",
        verdict: {
          kind: "risk",
          title: risk === "high" ? "HIGH MARINE RISK" : risk === "moderate" ? "MODERATE RISK" : "LOW RISK",
          titleHi: risk === "high" ? "उच्च समुद्री जोखिम" : risk === "moderate" ? "मध्यम जोखिम" : "कम जोखिम",
          riskLevel: risk,
          summary,
          summaryHi,
        },
        evidence,
        why,
        whyHi: why,
        agents: agentRuns({
          intent: { en: "Classified as a safety check for tomorrow morning", hi: "कल सुबह के लिए सुरक्षा जांच के रूप में वर्गीकृत" },
          weatherOcean: { en: `Retrieved waves ${c.waveHeightM.toFixed(1)} m, wind ${c.windSpeedKmph} km/h`, hi: `लहरें ${c.waveHeightM.toFixed(1)} मी, हवा ${c.windSpeedKmph} किमी/घंटा प्राप्त` },
          geospatialRisk: {
            en: cyclone ? `Located vessel; cyclone influence ${cyclone.distanceKm} km away` : "Located vessel; no cyclone influence found",
            hi: cyclone ? `जहाज की स्थिति; चक्रवात प्रभाव ${cyclone.distanceKm} किमी दूर` : "जहाज की स्थिति; कोई चक्रवात प्रभाव नहीं",
          },
          dataDiscovery: { en: c.advisoryActive ? "Found 1 active coastal advisory" : "No active advisories found", hi: c.advisoryActive ? "1 सक्रिय तटीय सलाह मिली" : "कोई सक्रिय सलाह नहीं मिली" },
          verification: { en: "Cross-checked 3 data sources — consistent", hi: "3 डेटा स्रोतों से क्रॉस-जांच — सुसंगत" },
          synthesis: { en: `Composed verdict: ${risk} risk`, hi: `निष्कर्ष: ${risk} जोखिम` },
        }),
        analysis: {
          intent: "safety",
          intentLabel: "Safety check",
          intentLabelHi: "सुरक्षा जांच",
          sources: ["Weather forecast", "Ocean state", "Geospatial hazards", "Marine advisories"],
          sourcesHi: ["मौसम पूर्वानुमान", "महासागर स्थिति", "भू-स्थानिक खतरे", "समुद्री सलाह"],
          conclusion: `${risk === "high" ? "High" : risk === "moderate" ? "Moderate" : "Low"} marine risk near ${v.name}'s position`,
          conclusionHi: `${v.name} की स्थिति के पास ${risk === "high" ? "उच्च" : risk === "moderate" ? "मध्यम" : "कम"} समुद्री जोखिम`,
        },
        map: {
          focus: { kind: "bounds", bounds: vesselHazardBounds(region), padding: [80, 90, 240, 90] },
          enableLayers: ["risk", "cyclone", "vessel"],
          disableLayers: ["pfz", "route"],
        },
        followUps: [
          { en: "Nearest safer fishing zone?", hi: "नज़दीकी सुरक्षित मात्स्यिकी क्षेत्र?", query: "Nearest fishing zone today?", queryHi: "आज का नज़दीकी मात्स्यिकी क्षेत्र?" },
          { en: "How can I avoid the hazard?", hi: "मैं खतरे से कैसे बचूं?", query: "How can I avoid the hazard zone?", queryHi: "मैं खतरे के क्षेत्र से कैसे बच सकता हूं?" },
          { en: "What hazards are active?", hi: "क्ये खतरे सक्रिय हैं?", query: "What hazards are near my location?", queryHi: "मेरे स्थान के पास क्ये खतरे हैं?" },
        ],
        stageMs: 620,
      };
    }

    /* ── PFZ ────────────────────────────────────────────── */
    case "pfz": {
      if (!pfz) {
        return unknownResponse(region);
      }
      const dist = haversineKm(v.position, pfz.center);
      const evidence: EvidenceItem[] = [
        {
          category: "geospatial",
          label: "Distance",
          labelHi: "दूरी",
          value: `${dist.toFixed(1)} km`,
          tone: dist <= 30 ? "good" : "info",
        },
        { category: "ocean", label: "SST at zone", labelHi: "क्षेत्र का SST", value: `${pfz.sst.toFixed(1)} °C`, tone: "info" },
        {
          category: "ocean",
          label: "Chlorophyll",
          labelHi: "क्लोरोफिल",
          value: `${pfz.chlorophyll.toFixed(1)} mg/m³`,
          tone: pfz.chlorophyll >= 2.5 ? "good" : "info",
        },
        { category: "ocean", label: "Depth", labelHi: "गहराई", value: `${pfz.depthM} m`, tone: "neutral" },
        ...(pfz.signals.sstFront
          ? [{ category: "ocean" as const, label: "SST front", labelHi: "SST फ्रंट", value: "Detected", tone: "good" as const }]
          : []),
      ];
      const why = [
        `A sharp sea-surface temperature front (~${pfz.sst.toFixed(1)} °C) concentrates baitfish`,
        `Chlorophyll-a at ${pfz.chlorophyll.toFixed(1)} mg/m³ indicates plankton productivity ${pfz.chlorophyll >= 2.5 ? "well above" : "above"} baseline`,
        `Zone lies in ~${pfz.depthM} m depth — accessible for small vessels in ${Math.round((dist / 9) * 60)} min at cruise speed`,
      ];
      return {
        id: rid(),
        intent,
        ack: "Looking for productive zones near you.",
        ackHi: "आपके पास उत्पादक क्षेत्रों की तलाश कर रहा हूं।",
        verdict: {
          kind: "pfz",
          title: "POTENTIAL FISHING ZONE DETECTED",
          titleHi: "संभावित मात्स्यिकी क्षेत्र मिला",
          riskLevel: "low",
          summary: `${pfz.label} is the strongest signal near your location, about ${dist.toFixed(1)} km away.`,
          summaryHi: `${pfz.label} आपके स्थान के पास सबसे प्रबल संकेत है, लगभग ${dist.toFixed(1)} किमी दूर।`,
        },
        evidence,
        why,
        whyHi: why,
          agents: agentRuns({
            intent: { en: "Classified as a fishing-zone lookup", hi: "मात्स्यिकी क्षेत्र खोज के रूप में वर्गीकृत" },
            weatherOcean: { en: `SST ${pfz.sst.toFixed(1)} °C, chlorophyll ${pfz.chlorophyll.toFixed(1)} mg/m³`, hi: `SST ${pfz.sst.toFixed(1)} °C, क्लोरोफिल ${pfz.chlorophyll.toFixed(1)} मि.ग्रा/मी³` },
            geospatialRisk: { en: `Distance from vessel ${dist.toFixed(1)} km; route outside hazard zones`, hi: `जहाज से दूरी ${dist.toFixed(1)} किमी; खतरे के क्षेत्रों से बाहर मार्ग` },
            dataDiscovery: { en: "1 satellite-derived PFZ polygon matched", hi: "1 उपग्रह-व्युत्पन्न PFZ क्षेत्र मेल" },
            verification: { en: "Signal strength verified across 2 passes", hi: "2 पास में संकेत शक्ति सत्यापित" },
            synthesis: { en: "Zone recommendation prepared", hi: "क्षेत्र सिफारिश तैयार" },
          }),
          analysis: {
            intent: "pfz",
            intentLabel: "Fishing zone lookup",
            intentLabelHi: "मात्स्यिकी क्षेत्र खोज",
            sources: ["SST field", "Chlorophyll-a", "Geospatial distance", "Vessel position"],
            sourcesHi: ["SST क्षेत्र", "क्लोरोफिल-a", "भू-स्थानिक दूरी", "जहाज स्थिति"],
            conclusion: `${pfz.label} · ${dist.toFixed(1)} km · evidence-backed`,
            conclusionHi: `${pfz.label} · ${dist.toFixed(1)} किमी · साक्ष्य-आधारित`,
          },
          map: {
            focus: { kind: "position", position: pfz.center, zoom: 10 },
            enableLayers: ["pfz", "vessel"],
            disableLayers: ["route"],
          },
          followUps: [
            { en: "Is it safe to go there?", hi: "वहां जाना सुरक्षित है?", query: "Is it safe to go fishing tomorrow?", queryHi: "क्या कल सुबह समुद्र में जाना सुरक्षित है?" },
            { en: "Expected species?", hi: "अपेक्षित प्रजातियां?", query: "What species are expected in this zone?", queryHi: "इस क्षेत्र में क्ये प्रजातियां अपेक्षित हैं?" },
          ],
          stageMs: 560,
        };
      }

    /* ── HAZARD ─────────────────────────────────────────── */
    case "hazard": {
      const cyclone = region.cyclone;
      const nearest = [...region.hazardZones].sort(
        (a, b) => haversineKm(v.position, a.center) - haversineKm(v.position, b.center),
      )[0];
      const nearestKm = nearest ? haversineKm(v.position, nearest.center) : 0;
      const risk: RiskLevel = cyclone ? "high" : nearestKm < 30 ? "high" : "moderate";
      const evidence: EvidenceItem[] = [
        ...(cyclone
          ? [
              {
                category: "geospatial" as const,
                label: `Cyclone ${cyclone.name}`,
                labelHi: `चक्रवात ${cyclone.name}`,
                value: `${cyclone.distanceKm} km ${cyclone.bearing} · ${cyclone.windKmph} km/h`,
                tone: cycloneTone(cyclone.distanceKm),
              },
            ]
          : []),
        ...(nearest
          ? [
              {
                category: "geospatial" as const,
                label: nearest.label,
                labelHi: nearest.labelHi,
                value: `${nearestKm.toFixed(1)} km · ${nearest.severity}`,
                tone: (nearest.severity === "moderate" ? "warn" : "danger") as "warn" | "danger",
              },
            ]
          : []),
        {
          category: "weather",
          label: "Wave height",
          labelHi: "तरंग ऊंचाई",
          value: `${c.waveHeightM.toFixed(1)} m`,
          tone: waveTone(c.waveHeightM),
        },
        {
          category: "weather",
          label: "Wind",
          labelHi: "हवा",
          value: `${c.windSpeedKmph} km/h · gusts ${c.windGustKmph}`,
          tone: (c.windGustKmph >= 35 ? "warn" : "neutral") as "warn" | "neutral",
        },
      ];
      const why = [
        ...(cyclone
          ? [`"${cyclone.name}" (${cyclone.category}) is tracking ${cyclone.movement}, ~${cyclone.distanceKm} km ${cyclone.bearing}`]
          : []),
        ...(nearest ? [`${nearest.label} — ${nearest.detail}`] : []),
        `Current wave height ${c.waveHeightM.toFixed(1)} m with ${c.windGustKmph} km/h gusts`,
      ];
      return {
        id: rid(),
        intent,
        ack: "Scanning hazards around your monitored area.",
        ackHi: "आपके निगरानी क्षेत्र के आसपास खतरों की जांच कर रहा हूं।",
        verdict: {
          kind: "hazard",
          title: risk === "high" ? "ACTIVE HAZARDS NEARBY" : "HAZARDS IN REGION",
          titleHi: risk === "high" ? "आसपास सक्रिय खतरे" : "क्षेत्र में खतरे",
          riskLevel: risk,
          summary: cyclone
            ? `Cyclonic activity is influencing conditions near ${region.name}. ${region.hazardZones.length} hazard zone${region.hazardZones.length > 1 ? "s" : ""} active on the map.`
            : `${nearest ? nearest.label : "Marine hazards"} detected near ${region.name}. Review zones on the map before departure.`,
          summaryHi: cyclone
            ? `चक्रवाती गतिविधि ${region.name} के पास परिस्थितियों को प्रभावित कर रही है। नक्शे पर ${region.hazardZones.length} खतरा क्षेत्र सक्रिय है।`
            : `${nearest ? nearest.labelHi : "समुद्री खतरे"} ${region.nameHi} के पास पाए गए। प्रस्थान से पहले नक्शे पर क्षेत्र देखें।`,
        },
        evidence,
        why,
        whyHi: why,
          agents: agentRuns({
            intent: { en: "Classified as a hazard scan", hi: "खतरा स्कैन के रूप में वर्गीकृत" },
            weatherOcean: { en: `Waves ${c.waveHeightM.toFixed(1)} m · wind ${c.windSpeedKmph} km/h`, hi: `लहरें ${c.waveHeightM.toFixed(1)} मी · हवा ${c.windSpeedKmph} किमी/घंटा` },
            geospatialRisk: {
              en: `${region.hazardZones.length} hazard zones within 60 km${cyclone ? ` · cyclone ${cyclone.distanceKm} km` : ""}`,
              hi: `60 किमी के भीतर ${region.hazardZones.length} खतरा क्षेत्र${cyclone ? ` · चक्रवात ${cyclone.distanceKm} किमी` : ""}`,
            },
            dataDiscovery: { en: "Checked cyclone bulletins and wave advisories", hi: "चक्रवात बुलेटिन और लहर सलाह जांची" },
            verification: { en: "Zone boundaries cross-verified", hi: "क्षेत्र सीमाएं क्रॉस-सत्यापित" },
            synthesis: { en: `Hazard summary: ${risk} risk`, hi: `खतरा सारांश: ${risk} जोखिम` },
          }),
          analysis: {
            intent: "hazard",
            intentLabel: "Hazard scan",
            intentLabelHi: "खतरा स्कैन",
            sources: ["Cyclone bulletins", "Wave advisories", "Geospatial zones"],
            sourcesHi: ["चक्रवात बुलेटिन", "लहर सलाह", "भू-स्थानिक क्षेत्र"],
            conclusion: `${region.hazardZones.length} active hazard zones${cyclone ? " + cyclone influence" : ""}`,
            conclusionHi: `${region.hazardZones.length} सक्रिय खतरा क्षेत्र${cyclone ? " + चक्रवात प्रभाव" : ""}`,
          },
          map: {
            focus: { kind: "bounds", bounds: vesselHazardBounds(region), padding: [80, 90, 240, 90] },
            enableLayers: ["risk", "cyclone", "vessel"],
            disableLayers: ["pfz", "route"],
          },
          followUps: [
            { en: "How can I avoid the hazard?", hi: "मैं खतरे से कैसे बचूं?", query: "How can I avoid the hazard zone?", queryHi: "मैं खतरे के क्षेत्र से कैसे बच सकता हूं?" },
            { en: "Nearest safer anchorage?", hi: "नज़दीकी सुरक्षित लंगर?", query: "How can I avoid the hazard zone?", queryHi: "मैं खतरे के क्षेत्र से कैसे बच सकता हूं?" },
          ],
          stageMs: 560,
        };
      }

    /* ── ROUTE ──────────────────────────────────────────── */
    case "route": {
      const route = region.suggestedRoute;
      if (!route) {
        return unknownResponse(region);
      }
      const safe = region.safeZones[0];
      const avoidsHi = [
        ...region.hazardZones.map((h) => h.labelHi),
        ...(region.cyclone ? ["चक्रवात प्रभाव क्षेत्र"] : []),
      ].slice(0, 3);
      const evidence: EvidenceItem[] = [
        { category: "geospatial", label: "Distance", labelHi: "दूरी", value: `${route.distanceKm.toFixed(1)} km`, tone: "info" },
        { category: "geospatial", label: "ETA", labelHi: "अनुमानित समय", value: `${route.etaMinutes} min`, tone: "neutral" },
        { category: "geospatial", label: "Avoids", labelHi: "से बचता है", value: route.avoids.join(", "), valueHi: avoidsHi.join(", "), tone: "good" },
        ...(safe
          ? [{ category: "geospatial" as const, label: "Destination", labelHi: "गंतव्य", value: safe.label, valueHi: safe.labelHi, tone: "good" as const }]
          : []),
      ];
      const why = [
        `Path keeps ≥ ${Math.round((region.hazardZones[0]?.radiusKm ?? 20) * 0.4)} km clearance from "${region.hazardZones[0]?.label ?? "hazard zones"}"`,
        ...(safe ? [`Destination offers sheltered water: ${safe.reason}`] : []),
        "Simulated recommendation — verify against on-board navigation",
      ];
      return {
        id: rid(),
        intent,
        ack: "Finding a safer path for you.",
        ackHi: "आपके लिए एक सुरक्षित मार्ग खोज रहा हूं।",
        verdict: {
          kind: "route",
          title: "SUGGESTED SAFER PATH",
          titleHi: "सुझाया गया सुरक्षित मार्ग",
          riskLevel: "low",
          summary: `A ${route.distanceKm.toFixed(1)} km route to ${safe?.label ?? "safer water"} avoids ${route.avoids.join(" and ").toLowerCase()}. ETA ${route.etaMinutes} min at cruise speed.`,
          summaryHi: `${safe?.labelHi ?? "सुरक्षित जल"} तक ${route.distanceKm.toFixed(1)} किमी का मार्ग ${route.avoids.join(" और ")} से बचता है। क्रूज़ गति पर ${route.etaMinutes} मिनट।`,
        },
        evidence,
        why,
        whyHi: why,
          agents: agentRuns({
            intent: { en: "Classified as a navigation request", hi: "नेविगेशन अनुरोध के रूप में वर्गीकृत" },
            weatherOcean: { en: "Currents along path are favourable", hi: "मार्ग के साथ धाराएं अनुकूल हैं" },
            geospatialRisk: { en: `Path computed clear of ${route.avoids.length} hazard zone(s)`, hi: `${route.avoids.length} खतरा क्षेत्र(ों) से मुक्त पथ गणना` },
            dataDiscovery: { en: "Depth and clearance data verified", hi: "गहराई और निकासी डेटा सत्यापित" },
            verification: { en: "Path sanity-checked against zones", hi: "क्षेत्रों के विरुद्ध पथ जांचा" },
            synthesis: { en: "Route suggestion prepared (simulated)", hi: "मार्ग सुझाव तैयार (सिम्युलेटेड)" },
          }),
          analysis: {
            intent: "route",
            intentLabel: "Safer navigation",
            intentLabelHi: "सुरक्षित नेविगेशन",
            sources: ["Hazard zones", "Vessel position", "Safe anchorages"],
            sourcesHi: ["खतरा क्षेत्र", "जहाज स्थिति", "सुरक्षित लंगर स्थल"],
            conclusion: `${route.distanceKm.toFixed(1)} km · ${route.etaMinutes} min · avoids ${route.avoids.length} zone(s)`,
            conclusionHi: `${route.distanceKm.toFixed(1)} किमी · ${route.etaMinutes} मिनट · ${route.avoids.length} क्षेत्र(ों) से बचता है`,
          },
          map: {
            focus: { kind: "bounds", bounds: routeBounds(route.path), padding: [80, 90, 240, 90] },
            enableLayers: ["route", "safe", "vessel"],
            disableLayers: ["pfz"],
          },
          followUps: [
            { en: "What's at the destination?", hi: "गंतव्य पर क्या है?", query: "What hazards are near my location?", queryHi: "मेरे स्थान के पास क्ये खतरे हैं?" },
            { en: "Nearest PFZ after docking", hi: "लंगर के बाद नज़दीकी PFZ", query: "Nearest fishing zone today?", queryHi: "आज का नज़दीकी मात्स्यिकी क्षेत्र?" },
          ],
          stageMs: 560,
        };
      }

    /* ── CONDITIONS ─────────────────────────────────────── */
    case "conditions": {
      const evidence: EvidenceItem[] = [
        { category: "weather", label: "Wave height", labelHi: "तरंग ऊंचाई", value: `${c.waveHeightM.toFixed(1)} m · ${c.wavePeriodS} s`, tone: waveTone(c.waveHeightM) },
        { category: "weather", label: "Wind", labelHi: "हवा", value: `${c.windSpeedKmph} km/h ${c.windDirection} · gusts ${c.windGustKmph}`, tone: c.windGustKmph >= 35 ? "warn" : "neutral" },
        { category: "ocean", label: "SST", labelHi: "SST", value: `${c.sst.toFixed(1)} °C`, tone: "info" },
        { category: "ocean", label: "Chlorophyll", labelHi: "क्लोरोफिल", value: `${c.chlorophyll.toFixed(1)} mg/m³`, tone: "info" },
        { category: "marine", label: "Current", labelHi: "धारा", value: `${c.currentKnots} kn`, tone: "neutral" },
        { category: "marine", label: "Advisory", labelHi: "सलाह", value: c.advisoryActive ? "Active" : "Clear", tone: c.advisoryActive ? "warn" : "good" },
      ];
      const why = [
        `Updated ${c.updatedAt} (simulated feed)`,
        ...(c.advisoryActive ? [`Advisory: ${c.advisory}`] : ["No active advisory for this coast"]),
        `Tide: high ${c.tide.high}, low ${c.tide.low} · Sunrise ${c.sunrise}, sunset ${c.sunset}`,
      ];
      return {
        id: rid(),
        intent,
        ack: "Pulling the latest marine observations.",
        ackHi: "नवीनतम समुद्री अवलोकन ला रहा हूं।",
        verdict: {
          kind: "info",
          title: "MARINE CONDITIONS",
          titleHi: "समुद्री परिस्थितियां",
          riskLevel: c.waveHeightM >= 2.5 ? "high" : c.waveHeightM >= 1.8 ? "moderate" : "low",
          summary: c.advisoryActive ? c.advisory : `Sea state is workable near ${region.name}. No advisories in effect.`,
          summaryHi: c.advisoryActive ? c.advisoryHi : `${region.nameHi} के पास समुद्र की स्थिति कार्ययोग्य है। कोई सलाह लागू नहीं।`,
        },
        evidence,
        why,
        whyHi: why,
          agents: agentRuns({
            intent: { en: "Classified as a conditions lookup", hi: "परिस्थिति खोज के रूप में वर्गीकृत" },
            weatherOcean: { en: "Fetched wave, wind and SST fields", hi: "लहर, हवा और SST क्षेत्र प्राप्त" },
            geospatialRisk: { en: "No hazard change near vessel", hi: "जहाज के पास कोई खतरा परिवर्तन नहीं" },
            dataDiscovery: { en: "Advisory feed checked", hi: "सलाह फीड जांची" },
            verification: { en: "Timestamps and units validated", hi: "टाइमस्टैम्प और इकाइयां सत्यापित" },
            synthesis: { en: "Conditions summary prepared", hi: "परिस्थिति सारांश तैयार" },
          }),
          analysis: {
            intent: "conditions",
            intentLabel: "Conditions lookup",
            intentLabelHi: "परिस्थिति खोज",
            sources: ["Wave & wind fields", "SST", "Advisory feed"],
            sourcesHi: ["लहर और हवा क्षेत्र", "SST", "सलाह फीड"],
            conclusion: `Sea state ${c.waveHeightM.toFixed(1)} m · wind ${c.windSpeedKmph} km/h`,
            conclusionHi: `समुद्र की स्थिति ${c.waveHeightM.toFixed(1)} मी · हवा ${c.windSpeedKmph} किमी/घंटा`,
          },
          map: {
            focus: { kind: "position", position: v.position, zoom: 10 },
            enableLayers: ["vessel"],
            disableLayers: [],
          },
          followUps: [
            { en: "Safe to sail?", hi: "जाना सुरक्षित है?", query: "Is it safe to go fishing tomorrow?", queryHi: "क्या कल सुबह समुद्र में जाना सुरक्षित है?" },
            { en: "Nearest PFZ", hi: "नज़दीकी PFZ", query: "Nearest fishing zone today?", queryHi: "आज का नज़दीकी मात्स्यिकी क्षेत्र?" },
          ],
          stageMs: 520,
        };
      }

    default:
      return unknownResponse(region);
  }
}

function unknownResponse(region: MarineRegion): OrcaResponse {
  const text =
    "I can help with marine safety, potential fishing zones, hazards and safer routes for your area. Try one of the suggestions below.";
  const textHi =
    "मैं आपके क्षेत्र के लिए समुद्री सुरक्षा, संभावित मात्स्यिकी क्षेत्रों, खतरों और सुरक्षित मार्गों में मदद कर सकता हूं। नीचे दिए सुझाव आज़माएं।";
  return {
    id: rid(),
    intent: "unknown",
    ack: "Let me see how I can help.",
    ackHi: "देखता हूं मैं कैसे मदद कर सकता हूं।",
    verdict: {
      kind: "info",
      title: "HERE'S WHAT I CAN DO",
      titleHi: "मैं यह कर सकता हूं",
      riskLevel: "low",
      summary: text,
      summaryHi: textHi,
    },
    evidence: [
      { category: "weather", label: "Safety checks", labelHi: "सुरक्षा जांच", value: "Is it safe to sail?", tone: "info" },
      { category: "ocean", label: "Fishing zones", labelHi: "मात्स्यिकी क्षेत्र", value: "Nearest PFZ today?", tone: "info" },
      { category: "geospatial", label: "Hazards", labelHi: "खतरे", value: "What's active nearby?", tone: "info" },
      { category: "geospatial", label: "Routes", labelHi: "मार्ग", value: "Avoid the hazard zone", tone: "info" },
    ],
    why: ["Ask about safety, fishing zones (PFZ), hazards, routes or conditions."],
    whyHi: ["सुरक्षा, मात्स्यिकी क्षेत्र (PFZ), खतरों, मार्गों या परिस्थितियों के बारे में पूछें।"],
      agents: agentRuns({
        intent: { en: "Ambiguous query — offering capabilities", hi: "अस्पष्ट प्रश्न — क्षमताएं पेश कर रहे हैं" },
      }),
      analysis: {
        intent: "unknown",
        intentLabel: "Capability offer",
        intentLabelHi: "क्षमता प्रस्ताव",
        sources: ["—"],
        sourcesHi: ["—"],
        conclusion: "Awaiting a specific marine query",
        conclusionHi: "एक विशिष्ट समुद्री प्रश्न की प्रतीक्षा",
      },
      map: {
        focus: { kind: "position", position: region.vessel.position, zoom: region.defaultZoom },
        enableLayers: ["vessel"],
        disableLayers: [],
      },
      followUps: [
        { en: "Safe to sail?", hi: "जाना सुरक्षित है?", query: "Is it safe to go fishing tomorrow?", queryHi: "क्या कल सुबह समुद्र में जाना सुरक्षित है?" },
        { en: "Nearest PFZ", hi: "नज़दीकी PFZ", query: "Nearest fishing zone today?", queryHi: "आज का नज़दीकी मात्स्यिकी क्षेत्र?" },
        { en: "Marine hazards", hi: "समुद्री खतरे", query: "What hazards are near my location?", queryHi: "मेरे स्थान के पास क्ये खतरे हैं?" },
      ],
      stageMs: 420,
    };
}

/* ── Bounds helpers (map deltas) ────────────────────────────── */
import type { LatLng } from "@/types/marine";

function vesselHazardBounds(region: MarineRegion): [LatLng, LatLng] {
  const pts: LatLng[] = [region.vessel.position];
  region.hazardZones.forEach((h) => pts.push(h.center));
  if (region.cyclone) pts.push(region.cyclone.center);
  return [pts.reduce((acc, p) => ({ lat: Math.min(acc.lat, p.lat), lng: Math.min(acc.lng, p.lng) })), pts.reduce((acc, p) => ({ lat: Math.max(acc.lat, p.lat), lng: Math.max(acc.lng, p.lng) }))];
}

function pfzBounds(region: MarineRegion, pfzCenter: LatLng): [LatLng, LatLng] {
  const a = region.vessel.position;
  const b = pfzCenter;
  return [
    { lat: Math.min(a.lat, b.lat), lng: Math.min(a.lng, b.lng) },
    { lat: Math.max(a.lat, b.lat), lng: Math.max(a.lng, b.lng) },
  ];
}

function routeBounds(path: LatLng[]): [LatLng, LatLng] {
  return [
    path.reduce((acc, p) => ({ lat: Math.min(acc.lat, p.lat), lng: Math.min(acc.lng, p.lng) })),
    path.reduce((acc, p) => ({ lat: Math.max(acc.lat, p.lat), lng: Math.max(acc.lng, p.lng) })),
  ];
}

export { bearingLabel };
