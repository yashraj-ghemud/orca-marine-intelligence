import { randomUUID } from "node:crypto";
import type { EvidenceItem } from "../../types/marine";
import type { IntentKind, OrcaResponse } from "../../types/orca";
import type { EngineResult, EvidenceId, Language, OrcaRequest, SimpleKind, Sources, VisionResult } from "./contracts";

// Fixed localized text keeps untrusted model prose out of safety and navigation decisions.
const copy = {
  en: {
    high: "HIGH MARINE RISK", moderate: "CAUTION: SAFETY NOT ESTABLISHED",
    summary: "Current regional screening only, not a vessel-specific assessment or forecast. No navigation safety guarantee. Check official local advisories and onboard navigation before any decision.",
    blocked: "One or more deterministic risk criteria are elevated. Do not treat a fishing signal or image as permission to depart.",
    caution: "No high-risk screening threshold was triggered, but safety is not established and unobserved hazards may exist.",
    insufficient: "The supplied observations do not establish an answer to every part of this request.",
    ack: "Validated live regional data and received configured engine results. Assessment limitations are listed below.",
    leadHigh: "High marine risk near {region} right now.", leadModerate: "Caution near {region}: no high-risk threshold hit, but safety is not established.",
    routeBlockedShort: "Route: blocked.", pfzYes: "Official PFZ signal: available.", pfzNo: "Official PFZ signal: none today.",
    partial: "Part of your question cannot be answered from today's observations.", notClearance: "Not a departure clearance — see why below.",
    engineRisk: "Engine-reported risk (not safety clearance)", engineBoundary: "Geospatial engine boundary",
    engineRoute: "Route engine", conflict: "Boundary conflict: INCOIS and geospatial engine disagree; no boundary clearance is established.",
    not_evaluated: "Route not evaluated. No navigable route is available.",
    insufficient_context: "Insufficient route context. No navigable route is available.",
    routeBlocked: "Route blocked by the deterministic engine. No navigable route is provided.",
    intent: "Regional observations", demo: "DEMO: SIMULATED DATA ONLY",
    demoSummary: "Illustrative mock scenario, not live observations. No model or external engine was called. Do not use this output for navigation.",
    vision: "Unverified image classification (not marine evidence): ",
  },
  hi: {
    high: "उच्च समुद्री जोखिम", moderate: "सावधानी: सुरक्षा स्थापित नहीं है",
    summary: "केवल वर्तमान क्षेत्रीय जांच, जहाज-विशिष्ट आकलन या पूर्वानुमान नहीं। सुरक्षित नौवहन की कोई गारंटी नहीं। निर्णय से पहले आधिकारिक स्थानीय सलाह और जहाज के नौवहन उपकरण जांचें।",
    blocked: "एक या अधिक निश्चित जोखिम मानदंड बढ़े हुए हैं। मछली पकड़ने के संकेत या चित्र को प्रस्थान की अनुमति न मानें।",
    caution: "जांच में उच्च जोखिम सीमा पार नहीं हुई, लेकिन सुरक्षा स्थापित नहीं है और अनदेखे खतरे हो सकते हैं।",
    insufficient: "दिए गए अवलोकन इस अनुरोध के हर भाग का उत्तर स्थापित नहीं करते।",
    ack: "लाइव क्षेत्रीय डेटा सत्यापित किया और निर्धारित इंजन परिणाम प्राप्त किए। आकलन की सीमाएं नीचे दी गई हैं।",
    leadHigh: "{region} के पास अभी समुद्री जोखिम उच्च है।", leadModerate: "{region} के पास सावधानी: कोई उच्च-जोखिम सीमा पार नहीं हुई, पर सुरक्षा स्थापित नहीं है।",
    routeBlockedShort: "मार्ग: अवरुद्ध।", pfzYes: "आधिकारिक PFZ संकेत: उपलब्ध।", pfzNo: "आधिकारिक PFZ संकेत: आज नहीं।",
    partial: "आपके प्रश्न का कुछ हिस्सा आज के अवलोकनों से नहीं बताया जा सकता।", notClearance: "यह प्रस्थान की अनुमति नहीं है — नीचे कारण देखें।",
    engineRisk: "इंजन द्वारा बताया जोखिम (सुरक्षा अनुमति नहीं)", engineBoundary: "भूस्थानिक इंजन की सीमा स्थिति",
    engineRoute: "मार्ग इंजन", conflict: "सीमा में विरोध: INCOIS और भूस्थानिक इंजन सहमत नहीं हैं; सीमा पार करने की अनुमति स्थापित नहीं है।",
    not_evaluated: "मार्ग का मूल्यांकन नहीं हुआ। नौवहन योग्य मार्ग उपलब्ध नहीं है।",
    insufficient_context: "मार्ग के लिए अपर्याप्त संदर्भ। नौवहन योग्य मार्ग उपलब्ध नहीं है।",
    routeBlocked: "निश्चित इंजन ने मार्ग अवरुद्ध किया। नौवहन योग्य मार्ग नहीं दिया गया है।",
    intent: "क्षेत्रीय अवलोकन", demo: "डेमो: केवल काल्पनिक डेटा",
    demoSummary: "यह काल्पनिक उदाहरण है, लाइव अवलोकन नहीं। किसी मॉडल या बाहरी इंजन को नहीं बुलाया गया। नौवहन के लिए उपयोग न करें।",
    vision: "असत्यापित चित्र वर्गीकरण (समुद्री साक्ष्य नहीं): ",
  },
  gu: {
    high: "ઊંચું દરિયાઈ જોખમ", moderate: "સાવચેતી: સલામતી સ્થાપિત નથી",
    summary: "માત્ર વર્તમાન પ્રાદેશિક તપાસ, જહાજ-વિશિષ્ટ મૂલ્યાંકન કે આગાહી નહીં. સુરક્ષિત નૌવહનની કોઈ ગેરંટી નથી. નિર્ણય પહેલાં સત્તાવાર સ્થાનિક સૂચનાઓ અને જહાજના નૌવહન સાધનો તપાસો.",
    blocked: "એક અથવા વધુ નિશ્ચિત જોખમ માપદંડ ઊંચા છે. માછીમારીના સંકેત કે ચિત્રને પ્રસ્થાનની પરવાનગી ન માનો.",
    caution: "તપાસમાં ઊંચા જોખમની મર્યાદા ઓળંગાઈ નથી, પરંતુ સલામતી સ્થાપિત નથી અને અજાણ્યા જોખમો હોઈ શકે છે.",
    insufficient: "આપેલા અવલોકનો વિનંતીના દરેક ભાગનો જવાબ સ્થાપિત કરતા નથી.",
    ack: "લાઇવ પ્રાદેશિક ડેટા ચકાસ્યો અને નિર્ધારિત એન્જિનનાં પરિણામ મેળવ્યાં. આકલનની મર્યાદાઓ નીચે છે.",
    leadHigh: "{region} પાસે અત્યારે દરિયાઈ જોખમ ઊંચું છે.", leadModerate: "{region} પાસે સાવધાની: કોઈ ઊંચા જોખમની મર્યાદા ઓળંગાઈ નથી, પણ સલામતી સ્થાપિત નથી.",
    routeBlockedShort: "માર્ગ: અવરોધિત.", pfzYes: "સત્તાવાર PFZ સંકેત: ઉપલબ્ધ.", pfzNo: "સત્તાવાર PFZ સંકેત: આજે નથી.",
    partial: "તમારા પ્રશ્નનો કેટલોક ભાગ આજના અવલોકનોથી કહી શકાય તેમ નથી.", notClearance: "આ પ્રસ્થાનની મંજૂરી નથી — નીચે કારણો જુઓ.",
    engineRisk: "એન્જિન દ્વારા દર્શાવેલું જોખમ (સલામતીની મંજૂરી નહીં)", engineBoundary: "ભૌગોલિક એન્જિનની સીમા સ્થિતિ",
    engineRoute: "માર્ગ એન્જિન", conflict: "સીમામાં વિરોધ: INCOIS અને ભૌગોલિક એન્જિન અસહમત છે; સીમા પાર કરવાની મંજૂરી સ્થાપિત નથી.",
    not_evaluated: "માર્ગનું મૂલ્યાંકન થયું નથી. નૌવહન માટે માર્ગ ઉપલબ્ધ નથી.",
    insufficient_context: "માર્ગ માટે અપૂરતો સંદર્ભ. નૌવહન માટે માર્ગ ઉપલબ્ધ નથી.",
    routeBlocked: "નિશ્ચિત એન્જિને માર્ગ અવરોધ્યો છે. નૌવહન માટે માર્ગ આપવામાં આવ્યો નથી.",
    intent: "પ્રાદેશિક અવલોકનો", demo: "ડેમો: માત્ર કાલ્પનિક ડેટા",
    demoSummary: "આ કાલ્પનિક ઉદાહરણ છે, લાઇવ અવલોકનો નથી. કોઈ મોડલ કે બાહ્ય એન્જિનનો ઉપયોગ થયો નથી. નૌવહન માટે ઉપયોગ ન કરો.",
    vision: "અચકાસાયેલ ચિત્ર વર્ગીકરણ (દરિયાઈ પુરાવો નથી): ",
  },
};
const labels: Record<EvidenceId, [string, string, string]> = {
  waves: ["Wave height", "लहर की ऊंचाई", "મોજાની ઊંચાઈ"],
  wind: ["Wind / gusts", "हवा / झोंके", "પવન / ઝાપટા"],
  visibility: ["Visibility", "दृश्यता", "દૃશ્યતા"],
  sst: ["Sea surface temperature", "समुद्र सतह तापमान", "દરિયાની સપાટીનું તાપમાન"],
  chlorophyll: ["Chlorophyll-a", "क्लोरोफिल-ए", "ક્લોરોફિલ-એ"],
  current: ["Current", "धारा", "પ્રવાહ"],
  advisory: ["Advisory active", "सक्रिय सलाह", "સક્રિય સૂચના"],
  hazards: ["Hazard severity", "खतरे की गंभीरता", "જોખમની તીવ્રતા"],
  cyclone: ["Cyclone distance", "चक्रवात दूरी", "ચક્રવાતનું અંતર"],
  boundary: ["Boundary status", "सीमा स्थिति", "સીમાની સ્થિતિ"],
  pfz: ["Official PFZ signal available", "आधिकारिक PFZ संकेत उपलब्ध", "સત્તાવાર PFZ સંકેત ઉપલબ્ધ"],
};
const values: Record<string, [string, string, string]> = {
  true: ["Yes", "हाँ", "હા"], false: ["No", "नहीं", "ના"],
  none: ["None reported", "कोई सूचना नहीं", "કોઈ નોંધ નથી"], moderate: ["Moderate", "मध्यम", "મધ્યમ"],
  low: ["Low", "कम", "ઓછું"],
  high: ["High", "उच्च", "ઊંચું"], severe: ["Severe", "गंभीर", "ગંભીર"],
  clear: ["Clear in supplied data only", "केवल दिए गए डेटा में स्पष्ट", "માત્ર આપેલા ડેટામાં સ્પષ્ટ"],
  restricted: ["Restricted", "प्रतिबंधित", "પ્રતિબંધિત"], unknown: ["Unknown", "अज्ञात", "અજ્ઞાત"],
  ocean: ["Ocean", "समुद्र", "દરિયો"], chart: ["Chart", "चार्ट", "ચાર્ટ"],
  document: ["Document", "दस्तावेज़", "દસ્તાવેજ"], other: ["Other", "अन्य", "અન્ય"], unclear: ["Unclear", "अस्पष्ट", "અસ્પષ્ટ"],
};

export function evidenceCatalog(sources: Sources, language: Language): Record<EvidenceId, EvidenceItem> {
  const i = sources.incois.data, c = sources.copernicus.data, w = sources.weather.data;
  const fields: Record<EvidenceId, [EvidenceItem["category"], string]> = {
    waves: ["ocean", `${c.waveHeightM} m`], wind: ["weather", `${w.windKmph} / ${w.gustKmph} km/h`],
    visibility: ["weather", `${w.visibilityKm} km`], sst: ["ocean", `${c.sstC} C`],
    chlorophyll: ["ocean", `${c.chlorophyllMgM3} mg/m3`], current: ["marine", `${c.currentKnots} kn`],
    advisory: ["marine", String(i.advisoryActive)], hazards: ["geospatial", i.hazardSeverity],
    cyclone: ["geospatial", i.cycloneDistanceKm === null ? "none" : `${i.cycloneDistanceKm} km`],
    boundary: ["geospatial", i.boundaryStatus], pfz: ["marine", String(i.pfzAvailable)],
  };
  const primary = language === "gu" ? 2 : 0;
  return Object.fromEntries(Object.entries(fields).map(([id, [category, value]]) => [id, {
    category, label: labels[id as EvidenceId][primary], labelHi: labels[id as EvidenceId][1],
    value: values[value]?.[primary] ?? value, valueHi: values[value]?.[1] ?? value, tone: "neutral",
  }])) as Record<EvidenceId, EvidenceItem>;
}

export function assembleResponse(input: {
  request: OrcaRequest; sources: Sources; engines: EngineResult[]; risk: "high" | "moderate"; intent: IntentKind;
  selected: EvidenceId[]; insufficient: boolean; vision?: VisionResult;
}): OrcaResponse {
  const { request, sources, engines, risk, intent } = input;
  const primary = request.language === "gu" ? "gu" : "en";
  const c = copy[primary], h = copy.hi;
  const catalog = evidenceCatalog(sources, request.language);
  // Models may rank facts but may not hide mandatory evidence or policy warnings.
  const allIds = [...new Set([...input.selected, ...Object.keys(catalog) as EvidenceId[]])];
  // Render only validated enums and provenance, never upstream/model navigation prose.
  const decisions = engines.map(engine => {
    const provenance = `${engine.engine} engine (${engine.regionId}): observed ${engine.observedAt}; valid until ${engine.validUntil}; source observations: ${Object.entries(engine.sourceObservations).map(([name, at]) => `${name}=${at}`).join(", ")}; evidence IDs: ${engine.evidenceIds.join(", ")}`;
    const reason = (language: Language) => {
      const text = copy[language], index = language === "gu" ? 2 : language === "hi" ? 1 : 0;
      const parts = [`${engine.engine}: ${text.engineRisk}: ${values[engine.riskLevel][index]}`];
      if (engine.engine === "geospatial") {
        parts.push(`${text.engineBoundary}: ${values[engine.boundaryStatus][index]}`);
        if (engine.boundaryStatus !== sources.incois.data.boundaryStatus) {
          parts.push(`${text.conflict} INCOIS: ${values[sources.incois.data.boundaryStatus][index]}`);
        }
      }
      if (engine.engine === "route") parts.push(`${text.engineRoute}: ${text[engine.routeStatus === "blocked" ? "routeBlocked" : engine.routeStatus]}`);
      return parts.join(". ");
    };
    const danger = engine.riskLevel === "high" || (engine.engine === "geospatial" && (engine.boundaryStatus !== "clear" || sources.incois.data.boundaryStatus !== "clear"))
      || (engine.engine === "route" && engine.routeStatus === "blocked");
    const evidence: EvidenceItem = {
      category: engine.engine === "risk" ? "marine" : "geospatial",
      label: `${engine.engine} engine`, labelHi: `${engine.engine} इंजन`,
      value: `${reason(primary)}. ${provenance}`, valueHi: `${reason("hi")}. ${provenance}`,
      tone: danger ? "danger" : engine.engine === "route" ? "warn" : "neutral"
    };
    return { reason, provenance, evidence };
  });
  const why = (language: "en" | "hi" | "gu") => [
    copy[language].summary,
    copy[language][risk === "high" ? "blocked" : "caution"],
    ...(input.insufficient ? [copy[language].insufficient] : []),
    ...decisions.map(decision => decision.reason(language)),
    ...(input.vision ? [copy[language].vision + values[input.vision.scene][language === "gu" ? 2 : language === "hi" ? 1 : 0]] : []),
    ...input.selected.map(id => `${language === "hi" ? catalog[id].labelHi : catalog[id].label}: ${language === "hi" ? catalog[id].valueHi : catalog[id].value}`),
  ];
  const provenance = [...Object.values(sources).map(source => `${source.source}: observed ${source.observedAt}; valid until ${source.validUntil}`),
  ...decisions.map(decision => decision.provenance)];
  // The card leads with the decision and the numbers behind it; the standing
  // safety text and every engine's reasoning sit under "Why this result?".
  const regionName = sources.incois.regionId.charAt(0).toUpperCase() + sources.incois.regionId.slice(1);
  const route = engines.find(engine => engine.engine === "route");
  const brief = (language: Language) => {
    const text = copy[language];
    const index = language === "gu" ? 2 : language === "hi" ? 1 : 0;
    const key = (id: EvidenceId) => `${labels[id][index]}: ${language === "hi" ? catalog[id].valueHi : catalog[id].value}`;
    const facts = (["waves", "wind", "visibility", "advisory", "cyclone"] as EvidenceId[]).filter(id => catalog[id]).map(key).join(" · ") + (language === "hi" ? "।" : ".");
    const lines = [
      (risk === "high" ? text.leadHigh : text.leadModerate).replace("{region}", regionName),
      facts,
      ...(intent === "pfz" ? [sources.incois.data.pfzAvailable ? text.pfzYes : text.pfzNo] : []),
      ...(route?.routeStatus === "blocked" ? [text.routeBlockedShort] : []),
      ...(input.insufficient ? [text.partial] : []),
      text.notClearance,
    ];
    return lines.join(" ");
  };
  const summary = brief(primary);
  const summaryHi = brief("hi");
  return {
    id: randomUUID(), intent, ack: c.ack, ackHi: h.ack,
    verdict: { kind: intent === "pfz" ? "pfz" : intent === "hazard" ? "hazard" : intent === "route" ? "route" : "risk", title: c[risk], titleHi: h[risk], riskLevel: risk, summary, summaryHi },
    evidence: [...allIds.map(id => catalog[id]), ...decisions.map(decision => decision.evidence)], why: why(primary), whyHi: why("hi"),
    agents: [
      { id: "dataDiscovery", label: "Live adapters", labelHi: "लाइव डेटा", contribution: "Validated INCOIS, Copernicus and weather adapter contracts" },
      { id: "intent", label: "Planner", labelHi: "योजनाकार", contribution: `Structured intent: ${intent}` },
      { id: "weatherOcean", label: "Parallel domain agents", labelHi: "क्षेत्रीय विश्लेषण", contribution: "Weather, marine, PFZ and geospatial agents completed in parallel using verified sources" },
      { id: "geospatialRisk", label: "Risk / Geo / Route engines", labelHi: "निश्चित जोखिम", contribution: decisions.map(decision => decision.reason(primary)).join("; "), contributionHi: decisions.map(decision => decision.reason("hi")).join("; ") },
      { id: "verification", label: "Freshness + provenance", labelHi: "समय और स्रोत जांच", contribution: "Required data revalidated before response assembly" },
      { id: "synthesis", label: "Synthesis + response", labelHi: "संश्लेषण और उत्तर", contribution: `Structured evidence selection rendered with fixed ${request.language} safety text; see trace for actual models` },
    ].map(agent => ({ ...agent, id: agent.id as OrcaResponse["agents"][number]["id"], status: "complete", contributionHi: agent.contributionHi ?? agent.contribution })),
    analysis: { intent, intentLabel: c.intent, intentLabelHi: h.intent, sources: provenance, sourcesHi: provenance, conclusion: summary, conclusionHi: summaryHi },
    // Existing map overlays are mock data. Never enable them for a live response.
    map: { disableLayers: ["vessel", "risk", "cyclone", "pfz", "safe", "route", "boundary"] },
    followUps: [],
  };
}

/**
 * Anything that could be read as a question about the water. A query that
 * touches these goes through the full planner/domain/engine pipeline, never
 * the conversational role.
 */
const MARINE_TERMS = /weather|wave|wind|fish|pfz|cyclone|storm|safe|sail|depart|route|\bsea\b|ocean|hazard|current|tide|boat|vessel|port|coast|risk|swell|forecast|warning|alert|monsoon|mumbai|goa|kerala|chennai|समुद्र|मौसम|लहर|हवा|मछली|चक्रवात|सुरक्ष|खतर|नाव|तट|દરિયા|હવામાન|મોજા|લહેર|પવન|માછલી|ચક્રવાત|સલામત|જોખમ|હોડી/iu;

export function classifySimpleQuery(request: OrcaRequest): SimpleKind | undefined {
  if (request.image) return;
  const query = request.query.toLowerCase().replace(/[.!?।]+$/u, "").trim();
  if (["hi", "hello", "hey", "namaste", "नमस्ते", "નમસ્તે", "how are you", "how are you doing",
    "whats up", "what's up", "sup", "good morning", "good afternoon", "good evening",
    "kaise ho", "kya haal hai", "kaise hain", "सुप्रभात", "नमस्कार",
    "kya chal raha hai", "kaise hai", "kya hal hai"].includes(query)) return "greeting";
  if (["help", "what can you do", "how do i use orca", "मदद", "મદદ"].includes(query)) return "help";
  // Short conversational turns with no marine vocabulary ("who are you", "thanks",
  // "what does ORCA stand for") are answered by the model, not by an 8-call pipeline.
  if (query.length <= 120 && !query.includes("\n") && !MARINE_TERMS.test(query)) return "chat";
}

/**
 * The conversational reply is the model's own words (already validated by
 * `simpleSchema`). The server adds only the one thing the model cannot
 * vouch for: that no marine data was consulted, so nothing here is a
 * safety assessment.
 */
export function simpleResponse(request: OrcaRequest, kind: SimpleKind, reply: string, replyHi: string): OrcaResponse {
  const label = { greeting: ["Greeting", "अभिवादन", "અભિવાદન"], help: ["Help", "सहायता", "મદદ"], chat: ["Conversation", "बातचीत", "વાતચીત"] }[kind];
  const title = request.language === "hi" ? label[1] : request.language === "gu" ? label[2] : label[0];
  const note = {
    en: "Conversational reply. No marine data or engines were consulted, so safety has not been assessed and no navigation guidance is given.",
    hi: "बातचीत का उत्तर। कोई समुद्री डेटा या इंजन नहीं देखा गया, इसलिए सुरक्षा का आकलन नहीं हुआ है और कोई नौवहन मार्गदर्शन नहीं है।",
    gu: "વાતચીતનો જવાબ. કોઈ દરિયાઈ ડેટા કે એન્જિન તપાસ્યાં નથી, તેથી સલામતીનું મૂલ્યાંકન થયું નથી અને કોઈ નેવિગેશન માર્ગદર્શન નથી.",
  };
  const c = note[request.language], h = note.hi;
  const first = reply.split(/(?<=[.!?।])\s+/u)[0] ?? reply;
  const firstHi = replyHi.split(/(?<=[.!?।])\s+/u)[0] ?? replyHi;
  return {
    id: randomUUID(), intent: "unknown", ack: first, ackHi: firstHi,
    verdict: { kind: "info", title, titleHi: label[1], riskLevel: "moderate", summary: reply, summaryHi: replyHi },
    evidence: [], why: [c], whyHi: [h],
    agents: [{ id: "synthesis", label: title, labelHi: label[1], status: "complete", contribution: c, contributionHi: h }],
    analysis: { intent: "unknown", intentLabel: title, intentLabelHi: label[1], sources: [], sourcesHi: [], conclusion: reply, conclusionHi: replyHi },
    map: { disableLayers: ["vessel", "risk", "cyclone", "pfz", "safe", "route", "boundary"] }, followUps: [],
  };
}

export async function demoResponse(request: OrcaRequest): Promise<OrcaResponse> {
  const [{ REGIONS }, { synthesizeResponse }] = await Promise.all([import("../mock-marine-data"), import("../mock-orca")]);
  const response = synthesizeResponse(request.query, REGIONS[request.regionId]);
  const c = copy[request.language === "gu" ? "gu" : "en"];
  response.ack = c.demoSummary;
  response.ackHi = copy.hi.demoSummary;
  response.verdict.title = `${c.demo}: ${request.language === "gu" ? c.intent : response.verdict.title}`;
  response.verdict.titleHi = `${copy.hi.demo}: ${response.verdict.titleHi}`;
  response.verdict.summary = request.language === "gu" ? c.demoSummary : `${c.demoSummary} ${response.verdict.summary}`;
  response.verdict.summaryHi = `${copy.hi.demoSummary} ${response.verdict.summaryHi}`;
  response.why = request.language === "gu" ? [c.demoSummary] : [c.demoSummary, ...response.why];
  response.whyHi = [copy.hi.demoSummary, ...response.whyHi];
  response.agents = response.agents.map(agent => ({ ...agent, status: "complete", contribution: c.demoSummary, contributionHi: copy.hi.demoSummary }));
  response.analysis.sources = ["Existing mock-marine-data.ts fixture; no live source retrieval"];
  response.analysis.sourcesHi = [copy.hi.demo];
  response.analysis.conclusion = c.demoSummary;
  response.analysis.conclusionHi = copy.hi.demoSummary;
  if (request.language === "gu") {
    response.analysis.intentLabel = c.intent;
    response.followUps = [];
  }
  delete response.stageMs;
  return response;
}
