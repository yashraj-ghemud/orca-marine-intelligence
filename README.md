# ORCA — Marine Ecosystem Reasoning with Collaborative Agents

Production-quality interactive frontend prototype: a **conversational marine intelligence workspace** combining an **interactive ocean map** (Leaflet + Esri Ocean basemap) with a **chat-driven reasoning workflow** (simulated multi-agent pipeline).

> All data is simulated. The UI carries honest "DEMO DATA" badges throughout — this is a frontend prototype with a mock intent router, not a live forecast service.

## Quick Start

```bash
npm install        # or: bun install
npm run dev        # or: bun run dev
```

Open **http://localhost:3000** — desktop-first design (verified at 1440×900 and 1280×800; responsive down to mobile).

> Requires Node 18+ (or Bun). Leaflet CSS is bundled via `globals.css`; map tiles load from Esri (internet required).

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
- **4 regions** (Mumbai / Goa / Kerala / Chennai) with distinct risk profiles; **EN ↔ हिन्दी** full i18n.
- **State machine**: `idle → processing → answered / alert / error` driven by a token-invalidating pipeline runner; map commands decouple chat → map via a sequence queue.

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
npm run build   # production build (standalone)
npm run lint    # eslint
npm run db:push # prisma schema push (DB is scaffolded, not used by the prototype)
```
