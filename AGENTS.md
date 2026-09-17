# AGENTS.md

## Project

ORCA — Marine Ecosystem Reasoning with Collaborative Agents. A frontend prototype of a conversational marine intelligence workspace: an interactive ocean map paired with a chat-driven, simulated multi-agent reasoning pipeline. All data is mocked; the UI carries "DEMO DATA" badges throughout.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui (Radix primitives) for components
- Leaflet with an Esri Ocean basemap for the map view
- Zustand (`src/lib/store.ts`) for client state

## Key directories

- `src/app` — routes; `page.tsx` renders the `OrcaWorkspace` root component
- `src/components/workspace` — top-level workspace layout tying map, chat, and evidence panels together
- `src/components/map` — Leaflet map and marine overlay components
- `src/components/chat` — conversational UI for the simulated agent pipeline
- `src/components/evidence` / `src/components/alerts` — supporting panels for the reasoning workflow
- `src/components/intro` — the cinematic intro; `scene/` holds the WebGL scene modules (shaders, shark rig, workspace slabs, camera choreography, ocean world)
- `src/components/ui` — shadcn/ui primitives
- `src/lib/mock-marine-data.ts`, `src/lib/mock-orca.ts` — simulated datasets driving the demo
- `src/lib/i18n.ts` — copy/translation strings
- `src/types` — shared TypeScript types for marine and orca domain models

## The cinematic intro

One 25s clock (`INTRO_BEATS` in `src/lib/intro.ts`) drives everything — camera,
captions, and the hand-off. It is a single unbroken camera move, not a
chaptered slideshow:

1. **Under the hull** (0–3.2s) — just below the swell, looking up at the keel
   inside Snell's window, rising.
2. **The vessel** (3.2–15.2s) — breaks the surface, skims alongside, cranes
   around the bow into the sunrise.
3. **The dive** (15.2–18.5s) — turns down toward open water, goes through the
   surface (foam flash, crater in the water shader), and settles in the deep.
4. **The sunken instruments** (18.5–25s) — on the seabed the workspace's
   panels lie as real objects: bevelled slabs with a dark glass edge and a
   painted screen (`scene/instruments.ts`), dark and tilted, caustics playing
   across them. A sonar ping (with its own light) wakes them in centre-out
   order; they light up, lift, and rise into a wall that faces the lens and
   exactly fills its frustum at `WALL_DISTANCE`. The edges thin away as it
   locks, the real page fades in beneath in the same order, and the canvas
   dissolves. The cut is meant to be invisible.

Things worth knowing before changing it:

- The camera is sampled by **arc length through a monotone cubic time map**
  (`scene/choreography.ts`). Keyframes fix when the lens passes a point;
  speed through it is interpolated, never eased to zero. If you add a
  keyframe, the camera will not pause there.
- Every visual is a **pure function of the clock**. Do not integrate state
  across frames in the scene.
- `?intro=force` replays it, `?intro=off` skips it, `&from=17.9` plays from a
  beat and `&at=17.9` holds that single frame.
- `instruments.ts`'s `workspaceLayout()` mirrors the real shell's CSS in CSS
  pixels (header height, chat rail width, the chat's inner pieces, map
  furniture insets). If that layout changes, change it here too or the wall
  will lock off its DOM counterparts. The DOM's own fade is in
  `src/lib/assembly-motion.ts`; `useIntroGate().shown` turns on at `assembly`,
  not `done`, so the page is fading in while the wall is still up.
- `TopHeader` takes `choreographed={false}` from the workspace so it renders
  complete while adrift; its own logo/bell collision only runs standalone.
- Budget: below the surface the canvas hides everything above it; the
  ambient three.js instruments in the page (chat ribbon, sonar dome) hold a
  still frame whenever the intro is on stage, so there is one live WebGL
  context during the sequence.
- A shader compile error degrades silently to the painted SVG fallback. The
  host element's `data-ready` attribute is the signal — `"true"` means WebGL
  is live, `"false"` means it fell back.

## Non-obvious decisions

- `prisma/` and `src/lib/db.ts` exist but are unused dead code from the starter template — no route or component imports them. There is no live database; do not wire up features to Prisma without first setting up a real Netlify Database (see the `netlify-database` skill).
- `next.config.ts` intentionally does not set `output: "standalone"` — Netlify's Next.js runtime manages the build/runtime output itself.
- Map tiles are fetched from Esri at runtime, so the map view requires network access even in local dev.
- Adapter and engine URLs (`ORCA_*_ADAPTER_URL`, `*_ENGINE_URL`) are `/api/...` paths by default, resolved against the origin of the request being served — the six services are routes in this same app. An absolute https URL means an external service. An `http://localhost` value is re-pointed at the serving origin with a trace note, so a laptop `.env` deployed to Netlify still works; never hardcode a host.
- `GET /api/orca?probe=1` is the live preflight: it really calls the provider, every feed and every engine and reports per-service ok/latency/ORCA code (no URLs or keys). The status panel's "Check connection" button uses it. `GET /api/orca` alone is presence-only.
- Server error codes are localised client-side via `errorText()` in `src/lib/i18n.ts` (`err_<CODE>` keys); unknown codes fall back to the server's sanitised English message.
- Voice: `/api/speech/transcribe` (Groq Whisper) and `/api/speech/synthesize` (ElevenLabs → Groq Orpheus → 204 = browser voice) keep provider keys server-side; `src/lib/speech.ts` is the client. An answer is read aloud only when its question came in by voice (`voiceReply` in the store).
- The chat rail has no scripted or seeded conversation. Every message comes from a real `/api/orca` round trip, so an empty rail on load is correct.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
