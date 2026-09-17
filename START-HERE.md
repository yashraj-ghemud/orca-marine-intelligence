# Run the ORCA Prototype

## First Run

1. Install Node.js 22 LTS from https://nodejs.org.
2. Extract the ZIP completely.
3. Open a terminal in the extracted `orca` folder.
4. Run:

```sh
npm ci
npm run dev
```

5. Open http://localhost:3000 in Chrome, Edge, Firefox or Safari.

Windows shortcut: double-click `START-WINDOWS.bat` after installing Node.js.
macOS/Linux shortcut: run `sh start.sh` from the project folder.
Keep the terminal open while using the app. Ctrl+C stops it.

## Presentation Flow

- Watch the three-chapter ocean story. Pause, select a chapter, or skip at any time.
- Click Enter ORCA to open the workspace. The header replay button restarts the story.
- Click Start guided mission, then complete Conditions, Fishing zones and Hazards.
- Scroll back to the mission card above the messages for the next step.
- Click Review on chart to inspect the result and evidence.
- Try chat, map layers, region/language switching, evidence, alerts and conversation export.
- On phones, use the Chat and Chart tabs.
- To force the intro after refresh, visit http://localhost:3000/?intro=force.

## Production Run

```sh
npm run build
npm start
```

## Verification

Validated with Node.js 22 on Linux:

- Production build passed.
- TypeScript and ESLint passed.
- 118 automated tests passed (run `bun test` with Bun installed).
- Browser: desktop story rendered; pause and chapter navigation worked.
- Browser: all three guided mission steps completed with API responses.
- Browser: mobile chat, composer and chart checked at 375 x 667, with no horizontal page overflow.
- No uncaught browser errors in the tested flow.

## Fixes Included

- Stable intro clock, pause/resume/replay lifecycle and complete workspace handoff.
- Painted story fallback when WebGL is unavailable; reduced-motion handling.
- Mission retries preserve the original attempt so progress can advance.
- Each answer resets map overlays instead of inheriting historical evidence layers.
- Drafts reset on new sessions, region changes and mode changes.
- Short-screen chat scrolling, responsive map popups and bounded alert surfaces.
- Clean typecheck/lint, reproducible npm lockfile and corrected Node requirements.

## Prototype Boundaries

This is a runnable prototype, not a live marine forecasting or navigation service.
Demo mode uses simulated datasets and does not require API keys or a database.
Internet is required for installing packages, loading map tiles and the build-time font download.
Live mode, image analysis and external agents need your configured services; see BACKEND.md and .env.example.
Browser speech input depends on browser support and microphone permission.
Conversation state is in memory; export it before refreshing or starting a new session.
No guarantee is made for untested browsers or external service availability.

If port 3000 is occupied, use `npm run dev -- --port 3001`, then open http://localhost:3001.
