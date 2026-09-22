# District scene

The first scene path implements [#21](https://github.com/danielluis07/habitta/issues/21). The DOM journey still owns selection, focus, overview/story content, and URLs. `components/district-scene/index.tsx` is the lazy, client-only boundary; it imports no Three.js code. Journey tests replace `scene.tsx` at that boundary.

The scene opens with only `/models/district-low.glb`, with the bundled Three.js Meshopt decoder. Selection targets and label anchors come from the collection's [runtime bindings](runtime-assets.md). Camera framing follows the model bounds, so replacement exports do not require per-building camera coordinates. Labels are ordinary DOM buttons projected from the anchors on each rendered frame; mesh descendants also accept pointer selection. Offscreen labels leave the tab order, and the canvas itself has no tab stop.

The journey reads the current camera position and look-at target before a selection from the district, including index selection and browser history. The saved viewpoint survives building switches and residence stories. Returning to the district restores it; a direct building link returns to the default framing. Motion uses a 1.4-second ease-in-out, or an immediate snap with motion off. Rendering is on demand and stops behind a residence story. A direct residence URL does not request the scene or its GLB.

Loading feedback covers both the JavaScript chunk and the model. Missing WebGL 2, model/chunk errors, and context loss use the existing simple-view intent without losing the selected concept. Placeholder exports retain a visible hatched disclosure. The selected scene reserves space beside the desktop overview and above the mobile bottom sheet.

## Detailed building model

[#23](https://github.com/danielluis07/habitta/issues/23) adds the selected building's detail. `components/district-scene/models.ts` fetches only that building's `building-{slug}.glb` while it is selected, including behind its residence story. The low-detail building stays visible until the detail has loaded. The detail is then attached at the district origin, and its low-detail selection subtree is hidden in the same frame. Camera framing still reads the district model, so the swap never moves the camera. The detail's own bindings take over label positioning and pointer selection; hidden low-detail meshes let clicks pass through.

Deselecting or switching buildings aborts a pending download, restores the low-detail building, and disposes the previous detail's geometry, materials and textures. At most one detail exists at a time, which keeps the district-plus-one-detail budget in [runtime-assets.md](runtime-assets.md). A failed fetch, parse or missing binding reports `assetFailed` through the simple-view intent, and the selection is kept. `tests/detailed-building.test.ts` covers the loading lifecycle against the committed GLBs without WebGL.

Orbit/zoom controls and the explicit Reset view control belong to #22.

## Atmosphere and render efficiency

[#24](https://github.com/danielluis07/habitta/issues/24) gives the district its air. `components/district-scene/atmosphere.tsx` holds everything that isn't the model:

- **Sky:** a vertex-coloured dome from paper at the horizon to the zenith token. It follows the camera, so the horizon stays correct from any orbit. The canvas background is paper while it loads.
- **Fog:** linear, in the fog token (equal to paper), from 500 m to 1,800 m. The camera's far plane is 2,000 m, so far-plane culling removes only geometry the fog has already hidden.
- **Clouds:** three flat, non-volumetric layers below the occupied terraces, in the cloud token. An opaque deck at −14 m hides everything below the district. It is slightly shaded so that the translucent banks at −5 m read against it. Wisps at +3 m veil the low southern edge of the landscape. Each layer is one draw with a tileable 128 × 128 noise texture generated on the client (`components/district-scene/clouds.ts`). There are no image downloads.
- **Light:** one warm late-morning sun from the southeast (`--color-scene-sun`, about 40° high) and a hemisphere fill. There are no shadows.
- **Grade:** Khronos PBR Neutral tone mapping. It keeps the buildings' material hues, so warmth comes from the sun and not from a tint. Cloud and sky materials skip tone mapping so they keep their token colours.

Excluded by design: volumetric clouds, particles, shadow maps, SSR, SSAO, HDR environments and post-processing.

**Drift.** Clouds drift slowly (0.5–1.1 m/s, west to east) only while motion is on and the canvas intersects the viewport. Each drifting frame requests the next. With motion off, scrolled away, or behind a residence story, nothing requests frames. Turning motion off stops the drift on the next frame. After a pause, the first frame's step is capped, so the clouds never jump.

**Demand rendering.** The canvas uses `frameloop="demand"`. Frames render only for camera flights, cloud drift, selection/detail swaps and resizes. When the destination already matches the current view, as when toggling motion, the camera snaps instead of flying, so a still view renders nothing.

**Pixel ratio.** `components/district-scene/pixel-ratio.ts` caps the drawing buffer at 1.5 on a capable desktop (fine hovering pointer and viewport ≥ 768 px) and at 1.0 on everything else. R3F clamps the device ratio into `[1, cap]`.

**Instancing and culling.** Repeated props arrive as `EXT_mesh_gpu_instancing` nodes (see [runtime-assets.md](runtime-assets.md)). `GLTFLoader` turns them into `InstancedMesh` objects, whose bounds cover every instance, so three.js frustum culling stays enabled for all meshes. With the placeholders, the district opens at 24 asset draws (30 with a detailed building). Sky and clouds add four runtime draws.

## Verification

Automated checks:

```sh
bun test
bun run lint
bunx tsc --noEmit
bun run build
```

Seam 1 covers scene-label selection, keyboard focus return, leaving the scene by Tab, viewpoint capture through the index and browser history, preservation through stories/building switches, direct links, and reduced-motion input. The full suite contains 113 tests. `tests/district-atmosphere.test.ts` covers the pixel-ratio cap, motion-gated drift and seamless cloud noise without WebGL; `tests/runtime-assets.test.ts` checks that the committed props are instanced. The production build also runs Khronos validation, binding checks, and asset budgets.

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

The atmosphere review (#24) ran headless Chromium with SwiftShader against the dev server. It wrapped WebGL draw calls and counted animation frames that drew anything:

- Desktop, 1440 × 1000 at device ratio 2: the canvas buffer was 1.5× its CSS size. Mobile emulation, 390 × 844 at ratio 3 with touch: 1.0×. The opening view drew 28 calls per frame; a selected, framed building drew 22, the rest culled by the frustum.
- With the camera still and motion off (by toggle or by reduced-motion preference), 0 frames rendered over 2 s, including after selecting a building.
- With motion on, canvas captures 3 s apart differed. With motion off they were identical, and turning motion off stopped rendering at once. Scrolled out of view with motion on, 0 draws rendered over 2 s.
- No console errors or warnings.

Software WebGL can't measure frame rate. At 2160 × 1500, SwiftShader needs longer than a second per frame.

**Still required:** manual FPS and draw-call profiling of the drift and camera flights on one physical desktop GPU and one physical phone, against the 60/30 FPS targets. Also required: manual review on physical mobile browsers (iOS Safari and Android Chrome), representative GPU hardware, and a screen reader. Desktop/mobile emulation with software WebGL does not establish mobile-browser compatibility or device performance. The issue's physical mobile verification remains open.
