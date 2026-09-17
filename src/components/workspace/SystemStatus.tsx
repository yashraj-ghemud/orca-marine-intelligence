"use client";

import { useEffect, useId, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Activity, CheckCircle2, ChevronDown, Info, Minus, RefreshCw, Wifi, X, XCircle } from "lucide-react";
import { z } from "zod";
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";
import { useOrcaStore } from "@/lib/store";

// Accept only the public configuration summary, never raw settings or errors.
const namedStatus = z.object({ name: z.string(), configured: z.boolean() });
const modelStatus = z.object({ displayName: z.string(), configured: z.boolean(), visionConfigured: z.boolean().optional() });
const healthSchema = z.object({
  liveConfigured: z.boolean(),
  connectivityChecked: z.boolean(),
  roles: z.array(modelStatus.extend({ role: z.string(), provider: z.string() })),
  fallbacks: z.array(modelStatus),
  adapters: z.array(namedStatus),
  engines: z.array(namedStatus),
});
type Health = z.infer<typeof healthSchema>;

// The live preflight: real calls, per-service results, never URLs or keys.
const probeResult = z.object({ name: z.string(), ok: z.boolean(), ms: z.number(), code: z.string().optional() });
const preflightSchema = z.object({
  connectivityChecked: z.literal(true),
  checkedAt: z.string(),
  ok: z.boolean(),
  configured: z.boolean(),
  configError: z.object({ code: z.string(), fields: z.array(z.string()).optional() }).optional(),
  providers: z.array(probeResult),
  feeds: z.array(probeResult),
  engines: z.array(probeResult),
  rewired: z.array(z.string()),
});
type Preflight = z.infer<typeof preflightSchema>;

/** Plain-language meaning of the probe's error codes, for an operator. */
const PROBE_HINTS: Record<string, string> = {
  UPSTREAM_NETWORK: "Connection refused or DNS failed — the endpoint is unreachable from this deployment.",
  UPSTREAM_TIMEOUT: "No response within the time limit.",
  UPSTREAM_HTTP: "The service answered with an error status.",
  UPSTREAM_SCHEMA: "The service answered, but not in ORCA's contract.",
  MODEL_ACCESS_DENIED: "The provider rejected the API key.",
  DATA_STALE: "The feed's data is older than the allowed age.",
  DATA_INVALID_TIME: "The feed's timestamps are invalid or in the future.",
  REGION_MISMATCH: "The feed answered for a different region.",
  ENGINE_PROVENANCE: "The engine did not reference the supplied observations.",
  SKIPPED: "Not checked because an earlier service failed.",
  CONFIG_MISSING: "Required settings are missing.",
  CONFIG_INVALID: "A setting has an invalid value.",
};

function ProbeRow({ result }: { result: z.infer<typeof probeResult> }) {
  const Icon = result.ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2 border-b border-ocean-line/60 py-1.5 text-[12px] last:border-0">
      <Icon aria-hidden className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${result.ok ? "text-ocean-success" : "text-ocean-danger-fg"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-ocean-ink">{result.name.toUpperCase()}</span>
          <span className="tabular-nums text-ocean-slate">{result.ok ? `${result.ms} ms` : result.code ?? "failed"}</span>
        </div>
        {!result.ok && result.code && <p className="mt-0.5 text-[11px] leading-snug text-ocean-slate">{PROBE_HINTS[result.code] ?? "See the server log for detail."}</p>}
      </div>
      <span className="sr-only">{result.ok ? "reachable" : "unreachable"}</span>
    </li>
  );
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean-blue";
const settingCopy = {
  en: {
    present: "Setting present", missing: "Setting missing", vision: "Vision",
    disclaimer: "Setting present means a nonempty value was supplied, not that it is valid or connected. This is not a live connection test.",
    ready: "Required settings present", incomplete: "Live setup incomplete",
    summary: "Presence does not verify credentials, endpoints, model access, or service availability. Ask your administrator to review missing settings and verify the setup.",
    fallbacks: "Listed alternatives, not evidence that a fallback is valid, connected, or active.",
  },
  hi: {
    present: "सेटिंग मौजूद है", missing: "सेटिंग अनुपस्थित है", vision: "विज़न",
    disclaimer: "सेटिंग मौजूद होने का मतलब केवल एक गैर-खाली मान दिया गया है, न कि वह मान्य या जुड़ा हुआ है। यह लाइव कनेक्शन परीक्षण नहीं है।",
    ready: "आवश्यक सेटिंग मौजूद हैं", incomplete: "लाइव सेटअप अधूरा है",
    summary: "मौजूदगी से क्रेडेंशियल, एंडपॉइंट, मॉडल एक्सेस या सेवा उपलब्धता सत्यापित नहीं होती। व्यवस्थापक से अनुपस्थित सेटिंग की समीक्षा और सेटअप की जांच करवाएं।",
    fallbacks: "सूचीबद्ध विकल्प किसी फ़ॉलबैक के मान्य, जुड़े या सक्रिय होने का प्रमाण नहीं हैं।",
  },
  gu: {
    present: "સેટિંગ હાજર છે", missing: "સેટિંગ ખૂટે છે", vision: "વિઝન",
    disclaimer: "સેટિંગ હાજર હોવાનો અર્થ માત્ર બિનખાલી મૂલ્ય અપાયું છે, તે માન્ય કે જોડાયેલું છે એવો નથી. આ લાઇવ કનેક્શન પરીક્ષણ નથી.",
    ready: "જરૂરી સેટિંગ હાજર છે", incomplete: "લાઇવ સેટઅપ અધૂરું છે",
    summary: "હાજરીથી ઓળખપત્રો, એન્ડપોઇન્ટ, મોડલ ઍક્સેસ કે સેવાની ઉપલબ્ધતા ચકાસાતી નથી. સંચાલકને ખૂટતી સેટિંગની સમીક્ષા અને સેટઅપની ચકાસણી કરવા કહો.",
    fallbacks: "સૂચિબદ્ધ વિકલ્પો કોઈ ફોલબેક માન્ય, જોડાયેલો કે સક્રિય હોવાનો પુરાવો નથી.",
  },
};

function StatusRow({ name, detail, configured, visionConfigured }: {
  name: string; detail?: string; configured: boolean; visionConfigured?: boolean;
}) {
  const language = useOrcaStore((s) => s.language);
  const copy = settingCopy[language];
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-ocean-line/70 py-3 last:border-0">
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words text-[12px] font-medium text-ocean-ink">{name}</p>
        {detail && <p className="mt-0.5 text-[11px] text-ocean-slate">{detail}</p>}
        {visionConfigured !== undefined && (
          <p lang={language} className="mt-0.5 text-[11px] text-ocean-slate">{copy.vision}: {visionConfigured ? copy.present : copy.missing}</p>
        )}
      </div>
      <span lang={language} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${configured ? "bg-ocean-info text-ocean-blue" : "bg-ocean-warn text-ocean-warn-fg"}`}>
        {configured ? <Info aria-hidden className="h-3 w-3" /> : <Minus aria-hidden className="h-3 w-3" />}
        {configured ? copy.present : copy.missing}
      </span>
    </li>
  );
}

export function SystemStatus() {
  const demoMode = useOrcaStore((s) => s.demoMode);
  const toggleDemoMode = useOrcaStore((s) => s.toggleDemoMode);
  const language = useOrcaStore((s) => s.language);
  const copy = settingCopy[language];
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [probe, setProbe] = useState<Preflight | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState(false);
  const probeRef = useRef<AbortController | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const modeHintId = useId();
  const modeLabel = demoMode ? t(language, "demoData") : ({ en: "Live mode", hi: "लाइव मोड", gu: "લાઇવ મોડ" }[language]);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
    probeRef.current?.abort();
    probeRef.current = null;
  }, []);

  /* The connection check makes real upstream calls, so it runs only on request. */
  async function checkConnection() {
    probeRef.current?.abort();
    const request = new AbortController();
    probeRef.current = request;
    const timeout = window.setTimeout(() => request.abort(), 40_000);
    setProbing(true);
    setProbeError(false);
    try {
      const response = await fetch("/api/orca?probe=1", { method: "GET", cache: "no-store", signal: request.signal });
      if (!response.ok) throw new Error("Preflight unavailable");
      const result = preflightSchema.parse(await response.json());
      if (probeRef.current === request) setProbe(result);
    } catch {
      if (probeRef.current === request) setProbeError(true);
    } finally {
      window.clearTimeout(timeout);
      if (probeRef.current === request) setProbing(false);
    }
  }

  async function refresh() {
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    const timeout = window.setTimeout(() => request.abort(), 12_000);
    setLoading(true);
    setError(false);
    setHealth(null);
    try {
      const response = await fetch("/api/orca", { method: "GET", cache: "no-store", signal: request.signal });
      if (!response.ok) throw new Error("Status unavailable");
      const summary = healthSchema.parse(await response.json());
      if (requestRef.current === request) setHealth(summary);
    } catch {
      if (requestRef.current === request) setError(true);
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === request) setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) void refresh();
      else {
        requestRef.current?.abort();
        requestRef.current = null;
      }
    }}>
      <DialogTrigger asChild>
        <button type="button" aria-label={`System status: ${modeLabel}${demoMode ? ", simulated data" : ", connectivity not verified"}`}
          title="System status and data mode"
          className={`flex h-11 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors sm:h-8 ${focusRing} ${demoMode ? "border-ocean-line bg-ocean-bg text-ocean-slate hover:bg-ocean-info" : "border-ocean-warn-fg/30 bg-ocean-warn text-ocean-warn-fg hover:border-ocean-warn-fg/60"}`}>
          <Activity aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {modeLabel}
          <ChevronDown aria-hidden className="h-3 w-3 shrink-0" />
        </button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="z-[1600] bg-ocean-navy/40 backdrop-blur-sm motion-reduce:animate-none" />
        {/* The shared content wrapper fixes its overlay at z-50, below the map/header. */}
        <DialogPrimitive.Content lang="en" className="fixed left-1/2 top-1/2 z-[1601] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-ocean-line bg-white text-ocean-ink shadow-[0_24px_80px_rgba(23,35,45,0.25)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none">
          <div className="shrink-0 border-b border-ocean-line px-5 py-4 pr-16">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ocean-blue">ORCA / configuration</p>
            <DialogTitle className="text-xl text-ocean-navy">System Status</DialogTitle>
            <DialogDescription lang={language} className="mt-2 text-[12px] leading-relaxed text-ocean-slate">
              {copy.disclaimer}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button type="button" aria-label="Close system status" className={`absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg text-ocean-slate hover:bg-ocean-bg ${focusRing}`}>
              <X aria-hidden className="h-4 w-4" />
            </button>
          </DialogClose>
          <div className="orca-scroll min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            <section aria-label="Data mode" className="rounded-xl border border-ocean-line bg-ocean-bg p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[12px] font-semibold text-ocean-navy">{demoMode ? "Demo mode" : "Live mode selected"}</h3>
                  <p className="mt-1 text-[11px] text-ocean-slate">{demoMode ? "Simulated marine data" : probe ? (probe.ok ? `All services reachable · checked ${new Date(probe.checkedAt).toLocaleTimeString()}` : `Some services unreachable · checked ${new Date(probe.checkedAt).toLocaleTimeString()}`) : "Connectivity not verified — run the check below"}</p>
                </div>
                <button type="button" role="switch" aria-checked={demoMode} aria-label="Demo mode" aria-describedby={modeHintId}
                  onClick={toggleDemoMode}
                  className={`flex min-h-11 items-center gap-2 rounded-lg border border-ocean-line bg-white px-3 text-[12px] font-medium text-ocean-navy ${focusRing}`}>
                  Demo {demoMode ? "on" : "off"}
                  <span aria-hidden className={`h-5 w-9 rounded-full p-0.5 ${demoMode ? "bg-ocean-teal-fg" : "bg-ocean-slate"}`}>
                    <span className={`block h-4 w-4 rounded-full bg-white transition-transform motion-reduce:transition-none ${demoMode ? "translate-x-4" : ""}`} />
                  </span>
                </button>
              </div>
              <p id={modeHintId} className="mt-3 text-[11px] leading-relaxed text-ocean-slate">Switching modes starts a new conversation. Selecting live mode does not verify providers or feeds.</p>
            </section>

            <div role="status" aria-live="polite" className="mt-4 text-[12px] leading-relaxed text-ocean-slate">
              {loading && <p className="rounded-xl border border-ocean-line p-4">Loading configuration summary...</p>}
              {health && (
                <div className="flex gap-2 rounded-xl border border-ocean-line bg-ocean-info/50 p-3.5">
                  <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ocean-blue" />
                  <div>
                    <p lang={language} className="font-semibold text-ocean-navy">{health.liveConfigured ? copy.ready : copy.incomplete}</p>
                    <p lang={language} className="mt-1">{copy.summary}</p>
                    <p className="mt-1">Presence is not connectivity. Use the connection check below for real per-service results.</p>
                  </div>
                </div>
              )}
            </div>

            {!demoMode && (
              <section aria-label="Connection check" className="mt-4 rounded-xl border border-ocean-line p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[12px] font-semibold text-ocean-navy">Connection check</h3>
                    <p className="mt-0.5 text-[11px] text-ocean-slate">Calls every feed, engine and the model provider the way a live question does.</p>
                  </div>
                  <button type="button" onClick={() => void checkConnection()} disabled={probing}
                    className={`flex min-h-11 items-center gap-2 rounded-lg border border-ocean-line bg-white px-3 text-[12px] font-medium text-ocean-navy disabled:opacity-60 ${focusRing}`}>
                    <Wifi aria-hidden className={`h-3.5 w-3.5 ${probing ? "animate-pulse" : ""}`} />
                    {probing ? "Checking…" : probe ? "Check again" : "Check connection"}
                  </button>
                </div>
                {probeError && <p role="alert" className="mt-3 rounded-lg bg-ocean-warn p-2.5 text-[11px] text-ocean-warn-fg">The check itself could not run. Retry, or see the server log.</p>}
                {probe && (
                  <div role="status" aria-live="polite" className="mt-3">
                    {!probe.configured && probe.configError && (
                      <p className="rounded-lg bg-ocean-danger p-2.5 text-[11px] text-ocean-danger-fg">
                        {PROBE_HINTS[probe.configError.code] ?? probe.configError.code}{probe.configError.fields?.length ? ` — ${probe.configError.fields.join(", ")}` : ""}
                      </p>
                    )}
                    {probe.configured && (
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div><h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ocean-blue">Provider</h4><ul className="mt-1">{probe.providers.map((r) => <ProbeRow key={r.name} result={r} />)}</ul></div>
                        <div><h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ocean-blue">Data feeds</h4><ul className="mt-1">{probe.feeds.map((r) => <ProbeRow key={r.name} result={r} />)}</ul></div>
                        <div><h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ocean-blue">Engines</h4><ul className="mt-1">{probe.engines.map((r) => <ProbeRow key={r.name} result={r} />)}</ul></div>
                      </div>
                    )}
                    {probe.rewired.length > 0 && (
                      <p className="mt-3 text-[11px] leading-snug text-ocean-slate">
                        {probe.rewired.join(", ")} pointed at localhost and were resolved against this deployment. Set them to <code className="rounded bg-ocean-bg px-1">/api/…</code> paths to make that explicit.
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}
            {error && <p role="alert" className="mt-4 rounded-xl border border-ocean-warn-fg/30 bg-ocean-warn p-3.5 text-[12px] leading-relaxed text-ocean-warn-fg">Configuration summary unavailable. No connectivity conclusion can be drawn. Retry below; the mode switch remains available.</p>}

            {health && <div className="mt-5 space-y-5">
              <section aria-label="Role pipeline">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ocean-blue">Role pipeline</h3>
                <ol className="mt-1">
                  {health.roles.filter((role) => role.role !== "simple").map((role, index) => (
                    <StatusRow key={role.role} name={role.displayName} detail={`${index + 1}. ${role.role} / ${role.provider}`} configured={role.configured} visionConfigured={role.visionConfigured} />
                  ))}
                </ol>
                <ul>
                  {health.roles.filter((role) => role.role === "simple").map((role) => (
                    <StatusRow key={role.role} name={role.displayName} detail={`Independent greeting/help / ${role.provider}`} configured={role.configured} />
                  ))}
                </ul>
              </section>
              <div className="grid gap-5 sm:grid-cols-2">
                <section aria-label="Data feeds">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ocean-blue">Data feeds</h3>
                  <ul className="mt-1">{health.adapters.map((feed) => <StatusRow key={feed.name} name={feed.name.toUpperCase()} configured={feed.configured} />)}</ul>
                </section>
                <section aria-label="Engines">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ocean-blue">Engines</h3>
                  <ul className="mt-1">{health.engines.map((engine) => <StatusRow key={engine.name} name={`${engine.name.charAt(0).toUpperCase()}${engine.name.slice(1)}`} configured={engine.configured} />)}</ul>
                </section>
              </div>
              <section aria-label="Fallback models">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ocean-blue">Fallback models</h3>
                <p lang={language} className="mt-1 text-[11px] text-ocean-slate">{copy.fallbacks}</p>
                <ul className="mt-1">{health.fallbacks.map((model) => <StatusRow key={model.displayName} name={model.displayName} configured={model.configured} visionConfigured={model.visionConfigured} />)}</ul>
              </section>
            </div>}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ocean-line px-5 py-3">
            <p className="text-[10px] leading-relaxed text-ocean-slate">Configuration only.<br />No credentials or endpoint details shown.</p>
            <button type="button" disabled={loading} onClick={() => void refresh()}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-ocean-line bg-white px-3 text-[12px] font-medium text-ocean-navy hover:bg-ocean-info disabled:cursor-wait disabled:opacity-50 ${focusRing}`}>
              <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
              {loading ? "Loading" : error ? "Retry" : "Refresh"}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
