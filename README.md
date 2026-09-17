# ORCA — Marine Ecosystem Reasoning with Collaborative Agents

Production-quality interactive marine intelligence workspace: a **conversational marine platform** combining an **interactive ocean map** (Leaflet + Esri Ocean basemap) with a **chat-driven reasoning workflow** and **real-time marine data integration**.

> 🌊 **NEW:** ORCA now includes production-ready API integration with INCOIS, Copernicus Marine, IMD, and OpenWeatherMap for real marine data! See [API Integration Guide](./README-API.md) for details.

> The demo mode uses simulated data with "DEMO DATA" badges. Configure API keys in `.env` to enable live data from authoritative sources.

## Quick Start

See **START-HERE.md** for startup shortcuts, presentation steps, verification and prototype limitations.

### Demo Mode (No API Keys Required)

```bash
npm ci             # installs the tested dependency versions
npm run dev        # or: bun run dev
```

Open **http://localhost:3000** — desktop-first design (verified at 1440×900 and 1280×800; responsive down to mobile).

### Live Data Mode (API Keys Required)

1. Get free API keys from INCOIS, Copernicus, IMD, OpenWeatherMap
2. Configure `.env` with your keys (see `.env.example`)
3. Start server: `npm run dev`
4. Test integration: Visit `http://localhost:3000/api/test-marine`
5. See [API Quick Start](./API-QUICK-START.md) for detailed setup

> **Real Data Integration:** See [README-API.md](./README-API.md) for complete API documentation and setup instructions.

> Requires Node.js 20.9+ (Node.js 22 LTS recommended). No API key or database is needed in Demo mode. Leaflet CSS is bundled via `globals.css`; map tiles load from Esri (internet required).

## What It Does

| Scenario | Try asking |
|---|---|
| Safety verdict | "Is it safe for fishing today?" |
| PFZ (Potential Fishing Zones) | "Show me PFZ near Kochi" |
| Hazard overlay | "Any hazards near Mumbai?" |
| Route planning | "Plan a safe route from Vizhinjam to Kochi" |
| Conditions | "How are conditions tomorrow?" |
| Unknown intent | "Can you book tickets?" (capabilities response) |
| Error + retry | Type `error` (simulated failure with retry affordance) |

Each query runs through a **staged agent pipeline** (visible as live processing stages in chat), produces a verdict card with **evidence grid**, a **"Why"** explanation, **agent contribution analysis**, and a **map command** — the map flies to the region, draws hazard polygons, PFZ zones, cyclone rings, safe zones and animated routes in sync with the conversation.

## Feature Map

- **Interactive marine map** (not a static image): pan/zoom/integer-zoom Esri Ocean base + Reference layers, clickable vessels/hazards/PFZ polygons with popups, live haversine distances, layer toggles, quick actions, coordinate readout, pulsing vessel marker.
- **Conversational workflow** (not a dashboard): suggested queries, staged processing states, follow-up chips, evidence drawer, proactive alerts (bell + toasts), error/retry state machine.
- **Live marine data integration** (real APIs): INCOIS Ocean State Forecast, Copernicus Marine Service, IMD weather & cyclones, aggregated data with quality indicators, fallback handling.
- **4 regions** (Mumbai / Goa / Kerala / Chennai) with distinct risk profiles; **EN ↔ हिन्दी** full i18n.
- **State machine**: `idle → processing → answered / alert / error` driven by a token-invalidating pipeline runner; map commands decouple chat → map via a sequence queue.

## Marine Data Sources

ORCA integrates with authoritative marine data sources:

| Source | Data Types | Coverage | Access |
|--------|------------|----------|--------|
| **INCOIS** | OSF, PFZ, Waves, SST | Indian Ocean | Free (Registration) |
| **Copernicus** | Waves, Currents, SST, Chlorophyll | Global | Free Account |
| **IMD** | Weather, Cyclones, Warnings | India | Free API Key |
| **OpenWeatherMap** | Weather, Wind, Forecasts | Global | Free 1000/day |

**Key Features:**
- ✅ Smart data aggregation from multiple sources
- ✅ Quality assessment and fallback handling
- ✅ TypeScript API clients with full type safety
- ✅ React hooks for easy integration
- ✅ REST API endpoints
- ✅ Bilingual support (English + Hindi)

See [API Documentation](./README-API.md) for setup and usage.

## Architecture

```
src/
├─ app/                  # Next.js App Router entry (page, layout, globals.css = design tokens)
├─ components/
│  ├─ workspace/         # OrcaWorkspace shell (35/65 split), TopHeader
│  ├─ map/               # MarineMap (react-leaflet), MapControls (layers/legend)
│  ├─ chat/              # ChatPanel, MessageBubble+ResultCard, Composer, SuggestedQueries
│  ├─ evidence/          # EvidenceDrawer (grouped, collapsible)
│  └─ alerts/            # AlertToast, AlertsPopover
├─ lib/
│  ├─ store.ts           # Zustand store — app state machine, pipeline runner, map command queue
│  ├─ mock-orca.ts       # Intent router (EN/HI/romanised) + response synthesis
│  ├─ mock-marine-data.ts# 4 regions: vessels, hazards, PFZs, cyclone, routes, conditions
│  ├─ map-utils.ts       # haversine, destinationPoint, circlePolygon, irregularBlob
│  └─ i18n.ts            # EN/हिन्दी tables
└─ types/                # marine.ts, orca.ts (fully typed contracts)
```

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · shadcn/ui · Leaflet + react-leaflet · Zustand.

## Design Tokens

Defined in `src/app/globals.css` — marine palette (`#124E78` deep ocean primary, `#2F6F95` mid, `#EAF4F8` surface, `#E9F5F2` safe / `#FFF2E8` caution / `#FDECEC` danger), radii 6/10/14, subtle elevation shadows, custom Leaflet overrides, marker/route/drawer animations.

## Backend Contract

`lib/mock-orca.ts` mirrors a future server API: a query → `{ verdict, riskLevel, evidence[], why, agents[], analysis, mapDelta, followUps[] }` response shape. Swap the mock router for a real API client without touching UI components.

## Scripts

```bash
npm run dev     # dev server on :3000
npm run build   # production build
npm run lint    # eslint
npm run db:push # prisma schema push (DB is scaffolded, not used by the prototype)
```
