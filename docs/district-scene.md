# District scene

The first scene path implements [#21](https://github.com/danielluis07/habitta/issues/21). The DOM journey still owns selection, focus, overview/story content, and URLs. `components/district-scene/index.tsx` is the lazy, client-only boundary; it imports no Three.js code. Journey tests replace `scene.tsx` at that boundary.

The scene opens with only `/models/district-low.glb`, with the bundled Three.js Meshopt decoder. Selection targets and label anchors come from the collection's [runtime bindings](runtime-assets.md). Camera framing follows the model bounds, so replacement exports do not require per-building camera coordinates. `components/district-scene/framing.ts` fits the corners of each framed building, plus the space above its label, to the view from the southeast: the default overview lets the three buildings fill 85% of the limiting axis, centred; a selected building fills 60%, keeping some district around it.

[#38](https://github.com/danielluis07/habitta/issues/38) made the district a full-viewport backdrop with the header and arrival copy laid over its sky. The page tells the scene its **clearance**: how far its own layers cover each canvas edge. Over the overview, that's the header and arrival copy. Beside a building, it's the header plus the 420px overview panel on wide screens, or the header plus the 60% bottom sheet on narrow ones. Framing also keeps 52px clear below the page's layers for the labels. The world-space room above each anchor shrinks with distance, so on wide, short windows (1536 × 730, for example) it alone let the middle label land exactly on the copy's edge. The buildings fill their share of the clear region, and a lens shift (`setViewOffset`) moves the camera's axis to the region's centre. That shift slides the image without tilting the camera, so verticals stay upright, and it flies with the camera. The overview looks down about 12° instead of the building views' 18°, so the sky and hazy ranges, not treed ground, sit behind the copy. Labels under the page's layers are hidden and leave the tab order, like offscreen ones. Labels are ordinary DOM buttons projected from the anchors on each rendered frame; mesh descendants also accept pointer selection. Offscreen labels leave the tab order, and the canvas itself has no tab stop.

The journey reads the current camera position and look-at target before a selection from the district, including index selection and browser history. The saved viewpoint survives building switches and residence stories. Returning to the district restores it; a direct building link returns to the default framing. Camera flights use a 1.4-second ease-in-out, or an immediate snap with motion off. They are the only motion in the scene; the Motion switch governs nothing else. Rendering is on demand and stops behind a residence story. A direct residence URL does not request the scene or its GLB.

Loading feedback covers both the JavaScript chunk and the model. Missing WebGL 2, model/chunk errors, and context loss use the existing simple-view intent without losing the selected concept. Placeholder exports retain a visible hatched disclosure. The selected building is framed clear of the desktop overview and above the mobile bottom sheet.

## Detailed building model

[#23](https://github.com/danielluis07/habitta/issues/23) adds the selected building's detail. `components/district-scene/models.ts` fetches only that building's `building-{slug}.glb` while it is selected, including behind its residence story. The low-detail building stays visible until the detail has loaded. The detail is then attached at the district origin, and its low-detail selection subtree is hidden in the same frame. Camera framing still reads the district model, so the swap never moves the camera. The detail's own bindings take over label positioning and pointer selection; hidden low-detail meshes let clicks pass through.

Deselecting or switching buildings aborts a pending download, restores the low-detail building, and disposes the previous detail's geometry, materials and textures. At most one detail exists at a time, which keeps the district-plus-one-detail budget in [runtime-assets.md](runtime-assets.md). A failed fetch, parse or missing binding reports `assetFailed` through the simple-view intent, and the selection is kept. `tests/detailed-building.test.ts` covers the loading lifecycle against the committed GLBs without WebGL.

Orbit/zoom controls and the explicit Reset view control belong to #22.

## Atmosphere and render efficiency

[#24](https://github.com/danielluis07/habitta/issues/24) gave the district its air; [#37](https://github.com/danielluis07/habitta/issues/37) grounded it in a highland landscape and removed the clouds. `components/district-scene/atmosphere.tsx` holds everything that isn't the model:

- **Sky:** a vertex-coloured dome from the haze token at the horizon to the zenith token, a cool pale blue-grey. It follows the camera, so the horizon stays correct from any view. The canvas background is the haze while it loads.
- **Haze:** linear fog in the haze token, from 150 m to 1,900 m. It softens the district slightly, layers the distant ranges, and is complete before the camera's 2,100 m far plane, so far-plane culling removes only geometry the haze has already hidden. The fog and the sky share one colour at the horizon, so the ground dissolves into the sky with no seam.
- **Landscape:** part of `district-low.glb` (see [runtime-assets.md](runtime-assets.md)). The ground continues 3.2 km from the district centre in every direction, beyond where the haze is complete from any framed view, so no terrain edge or void shows.
- **Light:** one warm late-morning sun from the southeast (`--color-scene-sun`, about 40° high) and a hemisphere fill from the haze above and the grass below. There are no shadows.
- **Grade:** Khronos PBR Neutral tone mapping. It keeps the buildings' material hues, so warmth comes from the sun and not from a tint. The sky material skips tone mapping so it keeps its token colours.

The scene reads its colours from the `--color-scene-*` custom properties. They sit in a `@theme static` block in `app/globals.css`, because no utility class uses them and Tailwind would otherwise drop them from the stylesheet.

Excluded by design: clouds, particles, shadow maps, SSR, SSAO, HDR environments and post-processing.

**Demand rendering.** The canvas uses `frameloop="demand"`. Nothing moves on its own, so frames render only for camera flights, selection/detail swaps and resizes. When the destination already matches the current view, as when toggling motion, the camera snaps instead of flying, so a still view renders nothing.

**Pixel ratio.** `components/district-scene/pixel-ratio.ts` caps the drawing buffer at 1.5 on a capable desktop (fine hovering pointer and viewport ≥ 768 px) and at 1.0 on everything else. R3F clamps the device ratio into `[1, cap]`.

**Instancing and culling.** Repeated props arrive as `EXT_mesh_gpu_instancing` nodes (see [runtime-assets.md](runtime-assets.md)). `GLTFLoader` turns them into `InstancedMesh` objects, whose bounds cover every instance, so three.js frustum culling stays enabled for all meshes. With the placeholders, the district opens at 27 asset draws (33 with a detailed building). The sky adds one runtime draw.

## Verification

Automated checks:

```sh
bun test
bun run lint
bunx tsc --noEmit
bun run build
```

Seam 1 covers scene-label selection, keyboard focus return, leaving the scene by Tab, viewpoint capture through the index and browser history, preservation through stories/building switches, direct links, and reduced-motion input. The full suite contains 133 tests. `tests/district-atmosphere.test.ts` covers the pixel-ratio cap, the default overview framing on desktop and mobile, framing into the region the page leaves clear with every label clear of the arrival copy on wide, short desktops, and that the ground outruns the haze from every framed, lens-shifted view, without WebGL; `tests/runtime-assets.test.ts` checks that the committed props are instanced. The production build also runs Khronos validation, binding checks, and asset budgets.

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
- The cloud-drift checks from that review no longer apply: #37 removed the clouds.
- No console errors or warnings.

The highland review (#37) used the same setup against the production build (`bun run build`, `bun run start`), at 1440 × 1000 and at 390 × 844 with touch:

- The default overview framed the three buildings large on both, with the ridge, layered hazy ranges and a strip of sky behind them. The Crest building view kept the ranges on its horizon.
- With motion on and the camera still, 0 draws rendered over 2.5 s on the overview, on both viewports, and on a direct Crest link.
- A separate render of `district-low.glb` looking south showed the valley falling to the lake, with the ranges beyond it dissolving into the haze.
- No console errors or warnings.

Software WebGL can't measure frame rate. At 2160 × 1500, SwiftShader needs longer than a second per frame.

**Still required:** manual FPS and draw-call profiling of camera flights over the landscape on one physical desktop GPU and one physical phone, against the 60/30 FPS targets. Also required: manual review on physical mobile browsers (iOS Safari and Android Chrome), representative GPU hardware, and a screen reader. Desktop/mobile emulation with software WebGL does not establish mobile-browser compatibility or device performance. The issue's physical mobile verification remains open.

The full-viewport review (#38) used headless Chromium with SwiftShader against the dev server:

- Contrast was measured by hiding the overlaid text, then comparing every background pixel under each line box with the text colour. At the default framing, from 320 × 800 to 1440 × 900, the heading and intro held at least 9.3:1, the wordmark 11.6:1 and the 12px ink-muted eyebrow 4.96:1. In building views the wordmark held at least 6.1:1.
- Short viewports (390 × 664, 320 × 568) and 200% and 400% zoom (720 × 450, 360 × 225, 320 × 180 CSS px) stacked the copy above the district on paper, with no horizontal scrolling.
- The overview panel, bottom sheet, building index, simple view, and a direct residence URL behaved as before. Returning to the district restored the arrival framing.
