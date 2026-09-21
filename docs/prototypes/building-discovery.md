# Building discovery prototype

Throwaway artifact for [Prototype the building discovery journey](https://github.com/danielluis07/habitta/issues/4), within [Shape a fictional 3D architecture studio portfolio](https://github.com/danielluis07/habitta/issues/1).

Status: **awaiting human review**. None of these options is an accepted decision. Do not promote this code to production. The final renderer and asset pipeline remain part of [Choose the 3D scene and asset approach](https://github.com/danielluis07/habitta/issues/9).

## Run

On branch `prototype/building-discovery`, run `bun install`, then `bun run dev`. Open `http://localhost:3000/?variant=A`.

The floating bottom switcher and left/right arrow keys cycle through A, B, and C. Each option has a shareable URL. The switcher and state inspector are development tools and are hidden in production builds.

## Question

How should a visitor arrive, identify and select a building, open its featured residence, and return to the collection?

| Variant | Entry and structure | Main affordance | Tradeoff to judge |
| --- | --- | --- | --- |
| A: Guided arrival | Full scene with a studio introduction; an explicit Explore action moves into the district | Arrival, then spatial labels | Does the introduction establish place, or add an unnecessary step? |
| B: Open district | The district is interactive immediately; selecting a building opens a panel on the right | Direct building selection | Is the scene clear enough to explore without an introduction? |
| C: Collection index | A persistent index sits beside the district; on narrow screens the index sits above it | Building names and types, linked to 3D | Does the index make discovery easier, or take too much attention away from the world? |

## Shared behavior being proposed

- Three distinct draft buildings stand on a continuous landscape, with shared streets, light, and a low cloud layer.
- Drag to orbit, scroll/pinch to zoom. Vertical angles and distance are bounded; panning is disabled. Buildings and their name labels are selectable, and the building index offers ordinary keyboard-operable controls.
- Selecting a building saves the district viewpoint and moves the camera toward the building. Choosing a different building retains the original district viewpoint for return.
- The preview identifies the building and its one featured residence. An explicit action opens a placeholder residence story.
- Returning from the story to the building keeps the selection. Returning to the district restores the saved viewpoint. Reset view restores the default overview.
- Camera moves last 1.5 seconds and disable scene dragging during the move. The motion control and system reduced-motion preference make moves immediate and stop cloud drift. Skip arrival also makes the initial move immediate.
- Escape closes the residence story, building index, or selected building, in that order. Opening the story moves keyboard focus to its heading; closing it returns focus to the action that opened it.
- The prototype notes disclose the variant, stage, selected building, motion setting, index state, and initialization status.

## What is provisional

The building names Vale, Serra, and Pátio, their geometry, materials, and residence descriptions are invented to make the interaction review concrete. They do not settle the collection decision. Models are procedural blocks, and the cloud sprites are only a rough atmosphere cue. The story is a navigation endpoint for this experiment; its content and structure belong to [Prototype a building detail story](https://github.com/danielluis07/habitta/issues/5).

Three.js is installed only on this prototype branch. This demonstrates the interaction with real 3D; it does not settle the production choice between direct Three.js, React Three Fiber, or a different scene approach. The existing local Next.js client-component and search-parameter guides and the installed Three.js OrbitControls source were consulted.

The local video did not decode with the available ffmpeg tool. The prototype follows the reference description and accepted world-setting resolution recorded on the map.

## Review

Try selecting two different buildings, opening a residence, and returning to the district in each variant. Try dragging before selecting so the return behavior is visible.

Choose an entry/layout, or identify a combination. Then judge whether bounded orbit, a camera move on selection, an explicit residence-opening action, and restoring the district viewpoint feel right. The ticket remains open until that feedback is recorded as a decision.

## Captured views

- [Guided arrival](building-discovery/guided-arrival.png)
- [Open district](building-discovery/open-district.png)
- [Collection index](building-discovery/collection-index.png)
- [Collection index on a narrow screen](building-discovery/mobile-index.png)

## Verification

Lint and TypeScript checks passed. A headless Chromium smoke pass exercised selection, residence opening, focus on the residence heading, and return in all three variants. It also checked URL and keyboard variant switching, one canvas after switching, the collection index to residence flow at 390px width, no horizontal overflow at that width, and the system reduced-motion preference. No browser page errors were reported. This is a prototype check, not device-performance or production-accessibility certification.
