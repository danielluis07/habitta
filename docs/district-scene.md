# District scene

The first scene path implements [#21](https://github.com/danielluis07/habitta/issues/21). The DOM journey still owns selection, focus, overview/story content, and URLs. `components/district-scene/index.tsx` is the lazy, client-only boundary; it imports no Three.js code. Journey tests replace `scene.tsx` at that boundary.

The scene opens with only `/models/district-low.glb`, with the bundled Three.js Meshopt decoder. Selection targets and label anchors come from the collection's [runtime bindings](runtime-assets.md). Camera framing follows the model bounds, so replacement exports do not require per-building camera coordinates. Labels are ordinary DOM buttons projected from the anchors on each rendered frame; mesh descendants also accept pointer selection. Offscreen labels leave the tab order, and the canvas itself has no tab stop.

The journey reads the current camera position and look-at target before a selection from the district, including index selection and browser history. The saved viewpoint survives building switches and residence stories. Returning to the district restores it; a direct building link returns to the default framing. Motion uses a 1.4-second ease-in-out, or an immediate snap with motion off. Rendering is on demand and stops behind a residence story. A direct residence URL does not request the scene or its GLB.

Loading feedback covers both the JavaScript chunk and the model. Missing WebGL 2, model/chunk errors, and context loss use the existing simple-view intent without losing the selected concept. Placeholder exports retain a visible hatched disclosure. The selected scene reserves space beside the desktop overview and above the mobile bottom sheet.

## Detailed building model

[#23](https://github.com/danielluis07/habitta/issues/23) adds the selected building's detail. `components/district-scene/models.ts` fetches only that building's `building-{slug}.glb` while it is selected, including behind its residence story. The low-detail building stays visible until the detail has loaded. The detail is then attached at the district origin, and its low-detail selection subtree is hidden in the same frame. Camera framing still reads the district model, so the swap never moves the camera. The detail's own bindings take over label positioning and pointer selection; hidden low-detail meshes let clicks pass through.

Deselecting or switching buildings aborts a pending download, restores the low-detail building, and disposes the previous detail's geometry, materials and textures. At most one detail exists at a time, which keeps the district-plus-one-detail budget in [runtime-assets.md](runtime-assets.md). A failed fetch, parse or missing binding reports `assetFailed` through the simple-view intent, and the selection is kept. `tests/detailed-building.test.ts` covers the loading lifecycle against the committed GLBs without WebGL.

Orbit/zoom controls and the explicit Reset view control belong to #22. The cloud deck and broader device/performance work remain separate tasks.

## Verification

Automated checks:

```sh
bun test
bun run lint
bunx tsc --noEmit
bun run build
```

Seam 1 covers scene-label selection, keyboard focus return, leaving the scene by Tab, viewpoint capture through the index and browser history, preservation through stories/building switches, direct links, and reduced-motion input. The full suite contains 106 tests. The production build also runs Khronos validation, binding checks, and asset budgets.

Local browser review on 2026-09-22 used desktop Chromium at 1440 × 1000 and mobile-emulated Chromium at 390 × 844, with touch and reduced motion. Screenshots were inspected locally; browser scripts are temporary review tooling, not a new WebGL E2E suite. Checks covered:

- All three visible labels; keyboard selection, Tab exit, and focus return.
- Canvas mesh click selection and touch label selection.
- Selection framing, overview/story return, direct building links, and no horizontal overflow.
- Selected mobile labels staying above the bottom sheet.
- Loading feedback with the GLB deliberately delayed, while the index remained usable.
- Camera restoration after both overview and story, and immediate reduced-motion changes.
- Asset failure and context loss preserving the DOM journey; unsupported WebGL 2 opening simple view.
- Direct residence arrival without a canvas or GLB request.

The detailed-model review (#23), in desktop Chromium with software WebGL and each detail held back three seconds, selected Crest, Contour, Grove and Crest again in sequence. It wrapped WebGL draw and buffer calls to count what each frame rendered:

- Each selection requested only that building's detailed GLB.
- Canvas captures before and after each swap differed in 0% of pixels, with equal per-frame triangle and draw counts. Only then were the detail's buffers uploaded and drawn. The labels stayed put. The placeholder detail uses the district's massing, so an unchanged frame is the expected result.
- Each switch deleted the previous detail's buffers, and returning to the district deleted the last one.
- A 404 for `building-grove.glb` opened simple view with the asset-failure notice, keeping the Grove overview.

**Still required:** manual review on physical mobile browsers (iOS Safari and Android Chrome), representative GPU hardware, and a screen reader. Desktop/mobile emulation with software WebGL does not establish mobile-browser compatibility or device performance. The issue's physical mobile verification remains open.
