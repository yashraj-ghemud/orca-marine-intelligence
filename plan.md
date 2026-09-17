# ORCA Completion Plan

## Goal
Complete and polish the existing marine intelligence prototype, preserving its ocean visual identity and real Three.js scene. Tell a clear story: departure, reading the signals, making a human decision. Keep simulated data unmistakable. A successful demo is not a certified marine safety or navigation service.

## 1. Establish the Baseline
- [x] Inspect the supplied archive, architecture, project instructions, and main flows.
- [x] Review workspace, map, chat, evidence, state, and backend boundaries.
- [ ] Install dependencies outside the limited artifact workspace.
- [ ] Run baseline type checking, lint, and existing orchestration tests.

## 2. Story and Smooth 3D Experience
- [ ] Keep the existing procedural water, boat buoyancy, wake, birds, and cinematic camera.
- [ ] Add pause/resume, chapter navigation, and replay-friendly story controls.
- [ ] Synchronize chapter text, progress, and camera; pause the clock in background tabs.
- [ ] Give the ending time to breathe; let users enter instead of forcing navigation.
- [ ] Preserve keyboard access, focus trapping/restoration, reduced motion, WebGL fallback, mobile layouts, and resource cleanup.
- [ ] Add a guided three-step demo mission from the empty conversation: check conditions, inspect fishing zones, review hazards. Show progress and let users leave the tour without blocking normal chat.

## 3. Functional Reliability
- [ ] Restore answer-specific map layers when reopening evidence.
- [ ] Make explicit evidence/map actions reveal the mobile Chart tab.
- [ ] Use accessible native checkboxes for whole-row layer activation.
- [ ] Disable mock-only map controls in live mode with an explanation.
- [ ] Keep marine alerts across unrelated requests and cancellation.
- [ ] Never mix mock region conditions into live response evidence.
- [ ] Persist degraded-response status and trace with each answer.
- [ ] Label historical answers with their original language instead of implying translation.
- [ ] Clarify that health configuration presence does not prove validity or connectivity.
- [ ] Add a useful export of the conversation, with mode and safety context.

## 4. Verification
- [ ] Add focused regression tests for store actions, alert persistence, cancellation, map layers, and response metadata.
- [ ] Run all tests, TypeScript, ESLint, and a production build; fix attributable failures.
- [ ] Test the real app in the provisioned browser on desktop and mobile.
- [ ] Check intro chapters, pause, skip, replay, reduced motion, and fallback.
- [ ] Check guided mission, chat, evidence navigation, layers, regions, language, new session, export, and unconfigured live-mode errors.
- [ ] Inspect layout overflow and browser runtime errors.

## 5. Delivery
- [ ] Update README with accurate requirements, scripts, new features, and limitations.
- [ ] Record actual verification results and remaining production prerequisites.
- [ ] Package source and lockfile without dependencies, build caches, or secrets.
- [ ] Supply the finished archive and a concise visual delivery page.

## Acceptance Criteria
1. Demo mode works without API keys, and end-to-end queries produce consistent chat and map state.
2. Intro controls are usable with mouse, touch, and keyboard, and reduced-motion users are not forced through cinematic movement.
3. A small-screen user can reach the evidence they requested without discovering an unrelated hidden tab.
4. Live mode neither fabricates availability nor displays fixture conditions as real measurements.
5. Automated checks pass, and any untested environments or external-service limitations are explicitly documented.

## Scope Boundaries
Real OpenRouter/adapter credentials, operational marine feeds, authentication, rate limiting, paid-provider budgets, and production deployment are not supplied. Preserve and test the existing server integration contract; do not invent credentials or claim live connectivity. No software can be guaranteed bug-free; delivery will state what was actually verified.

## Verification Log
To be updated as checks complete.
