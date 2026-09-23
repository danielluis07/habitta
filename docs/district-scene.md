# District scene

The first scene path implements [#21](https://github.com/danielluis07/habitta/issues/21). The DOM journey still owns selection, focus, overview/story content, and URLs. `components/district-scene/index.tsx` is the lazy, client-only boundary; it imports no Three.js code. Journey tests replace `scene.tsx` at that boundary.

The scene opens with only `/models/district-low.glb`, with the bundled Three.js Meshopt decoder, and the base environment map (see [Rendering quality tiers](#rendering-quality-tiers)). Selection targets and label anchors come from the collection's [runtime bindings](runtime-assets.md). Camera framing follows the model bounds, so replacement exports do not require per-building camera coordinates. `components/district-scene/framing.ts` fits the corners of each framed building, plus the space above its label, to the view from the southeast: the default overview lets the three buildings fill 85% of the limiting axis, centred; a selected building fills 60%, keeping some district around it.

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
- **Light:** one warm late-morning sun from the southeast (`--color-scene-sun`, about 40° high) and a hemisphere fill from the haze above and the grass below. The high tier adds the sun's shadow (see [Rendering quality tiers](#rendering-quality-tiers)).
- **Reflections:** glass and metal reflect an environment map of the same sky, ranges and highland, generated from these tokens. Nothing else takes image-based light, so the rest of the district keeps its look.
- **Grade:** Khronos PBR Neutral tone mapping. It keeps the buildings' material hues, so warmth comes from the sun and not from a tint. The sky material skips tone mapping so it keeps its token colours. On the high tier, the output pass tone-maps the whole image, sky included; Neutral leaves colours as pale as the sky tokens practically unchanged.

The scene reads its colours from the `--color-scene-*` custom properties. They sit in a `@theme static` block in `app/globals.css`, because no utility class uses them and Tailwind would otherwise drop them from the stylesheet.

Excluded by design: clouds, particles, SSR and high-resolution HDR environments. Shadow maps, SSAO and post-processing belong to the high tier only.

**Demand rendering.** The canvas uses `frameloop="demand"`. Nothing moves on its own, so frames render only for camera flights, selection/detail swaps and resizes. When the destination already matches the current view, as when toggling motion, the camera snaps instead of flying, so a still view renders nothing.

**Pixel ratio.** Set by the rendering tier: 1 on the base tier, the device's up to 2 on the high tier. R3F clamps the device ratio into `[1, cap]`.

**Instancing and culling.** Repeated props arrive as `EXT_mesh_gpu_instancing` nodes (see [runtime-assets.md](runtime-assets.md)). `GLTFLoader` turns them into `InstancedMesh` objects, whose bounds cover every instance, so three.js frustum culling stays enabled for all meshes. With the placeholders, the district opens at 38 asset draws (46 to 48 with a detailed building). The sky adds one runtime draw.

## Rendering quality tiers

[#41](https://github.com/danielluis07/habitta/issues/41) renders the district as well as each device can handle. The tiers, what each draws, and their budgets are in [runtime-assets.md](runtime-assets.md#rendering-tiers). Everything that decides between them lives in `components/district-scene/quality.ts`:

- **Selection.** The high tier needs a desktop: a fine, hovering pointer and a viewport at least 768 px wide. It also needs four or more logical cores where the browser reports them, no Save-Data request, and a GPU. Software renderers such as SwiftShader, llvmpipe and Microsoft Basic Render Driver get the base tier. The renderer is named only once the WebGL context exists, so the canvas holds its contents back until then. Nothing is drawn or allocated for a tier the device won't use. `?quality=base` or `?quality=high` forces a tier for manual testing.
- **Step-down.** A `FrameRateMonitor` times frames of continuous motion. Rendering is on demand, so those are camera flights; a flight's first frame follows a still view and isn't timed, and neither is the first frame after the tab was hidden. When the median frame rate over the last 2 s of motion (and at least 10 frames) stays below 45 FPS, the high tier steps down to base for the rest of the visit. The median ignores a single hitch, such as a shader compiling as a detailed building arrives. Below the base tier there is nothing yet; #25 builds its `slow` fallback to simple view on the same monitor.
- **Changing tier.** A step-down changes the pixel ratio, stops the sun casting and unmounts the post-processing, then redraws the same view. The camera, its flight, the selection and the loaded models stay as they are. Shaders recompile once for the new light setup. The desktop pack's environment map, once loaded, stays: its cost was the download, not the frames.
- **Environment maps.** `components/district-scene/environment.ts` loads the base map with the district, suspending with it, so a failure opens simple view like any other scene asset. On the high tier, the desktop pack's map is fetched after the scene's first frame and replaces the base map without recompiling. If it fails, the base map stays and a warning is logged.
- **Post-processing.** `components/district-scene/effects.tsx` renders through three.js's `EffectComposer`: `N8AOPass` draws the scene with half-resolution ambient occlusion (2.5 m radius, intensity 2), `SMAAPass` smooths edges, and `OutputPass` applies the tone mapping and colour space a direct render would.

## Verification

Automated checks:

```sh
bun test
bun run lint
bunx tsc --noEmit
bun run build
```

Seam 1 covers scene-label selection, keyboard focus return, leaving the scene by Tab, viewpoint capture through the index and browser history, preservation through stories/building switches, direct links, and reduced-motion input. The full suite contains 166 tests. `tests/rendering-quality.test.ts` covers tier settings, selection from device capability and the renderer, step-down on a sustained low frame rate (not a hitch or a hidden tab), and which materials reflect, cast and receive, without WebGL. `tests/district-atmosphere.test.ts` covers the default overview framing on desktop and mobile, framing into the region the page leaves clear with every label clear of the arrival copy on wide, short desktops, and that the ground outruns the haze from every framed, lens-shifted view, without WebGL; `tests/runtime-assets.test.ts` checks that the committed props are instanced. The production build also runs Khronos validation, binding checks, and asset budgets.

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

The richer-placeholder review ([#40](https://github.com/danielluis07/habitta/issues/40)) used headless Chromium with SwiftShader against the dev server, at 1440 × 1000 and 390 × 844. It counted WebGL draws per rendered frame after a resize, before the change (the #37 models) and after:

| | Asset draws (validator) | Draws per frame, before | Draws per frame, after |
| --- | --- | --- | --- |
| Opening | 27 → 38 | 28 | 39 |
| Crest selected | 33 → 46 | 18 | 26 |
| Contour selected | 33 → 46 | 22 | 29 |
| Grove selected | 33 → 48 | 26 | 38 |

- Opening triangles went from 38,062 to 71,571 (mobile limit 75,000), and selections to at most 133,639 (limit 150,000). The opening GLB is 638 KB of its 2 MB.
- Each building was captured with its detailed GLB held back and then loaded. Both detail levels showed the same massing, openings, finishes and planting; the detail added frames, sills, rail posts, tile courses, louvres and furniture.
- Glass read as glass in every view, with a pale sky sheen at the head of each pane. Contact shading showed at building bases, in reveals and loggias, and under trees.
- With the camera still, the overview rendered 0 frames. No console errors or warnings.

The rendering-tier review ([#41](https://github.com/danielluis07/habitta/issues/41)) used headless Chromium with SwiftShader against the dev server. It wrapped WebGL draw calls and texture allocations, and logged the drawing-buffer ratio and label positions on every animation frame:

- **Base tier** (SwiftShader's own choice), 1440 × 1000 at device ratio 2: the buffer stayed at 1.0×, with no 2,048 px shadow map and no composer targets allocated. Only `highland-512.hdr` was fetched, beside the district GLB. The overview drew 39 calls per frame. A still view rendered 0 frames over 2.5 s. Flights to each building and back behaved as before.
- **High tier** (`?quality=high`), same viewport: the buffer was 2.0×, with the 2,048 px shadow map, the composer's targets and SMAA's lookup textures allocated. It drew 108 calls per frame, adding the shadow and AO passes. `highland-1024.hdr` was requested only after the scene opened. Buildings cast shadows northwest onto their benches, the olives and the cypresses. Loggias and the undersides of Contour's terrace slabs darkened. No shadow acne.
- **Step-down**, forced high tier at 800 × 560, ratio 1.5, where SwiftShader takes about 1 s per frame: selecting Crest started a flight, and about 20 s in, the buffer dropped to 1.0×. Across the switch, the labels kept moving in the same ~10 px steps, the flight finished at Crest's framing, Crest stayed selected, and no model was requested again. The one long frame at the switch is the shaders recompiling for the new light setup, slow under software rendering.
- No console errors or warnings on any run.
- On a physical GPU (AMD Radeon Vega 10 through ANGLE's Direct3D 11 backend), the HLSL compiler reported notes for three.js's PMREM prefilter (X4122, a constant-folding rounding note) and N8AO's denoise blur (X3595, texture sampling in a loop). Neither changes the image. The scene's three.js console filter drops program logs made only of those two notes, so both tiers open with a clean console there too.

Software WebGL can't show real-device timing, so the thresholds (45 FPS, over 2 s of motion) still need tuning on physical hardware, with the other items still required above.
