# 3D scene and asset approach

**Research ticket:** [Choose the 3D scene and asset approach](https://github.com/danielluis07/habitta/issues/9)
**Date:** 2026-09-21

## Recommendation

Build the district as a client-only React Three Fiber (R3F) island using Three.js's `WebGLRenderer`. Keep the editorial shell, building index, building overview, and featured-residence story in ordinary accessible React/HTML. The canvas enhances that complete route; it never owns the only way to discover or select a building.

R3F is a React renderer for Three.js, and its v9 line pairs with React 19, which matches this project. It keeps the underlying Three.js APIs available while making scene state, selection state, and React UI work together. Its `Canvas` provides a DOM fallback when GL is unsupported, supports a capped DPR range, and supports demand-based rendering. [R3F README](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/readme.md) · [Canvas API](https://github.com/pmndrs/react-three-fiber/blob/master/docs/API/canvas.mdx) · [R3F performance guide](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/scaling-performance.mdx)

Use WebGL, not a WebGPU-first renderer. Three.js's current `WebGLRenderer` uses WebGL 2 and dropped WebGL 1 support in r163, so an unavailable WebGL 2 context must activate the already-approved illustrated building index/simple-view route. [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

The production dependency baseline is `three`, `@react-three/fiber`, and the Meshopt decoder needed by the selected asset encoding. Add a Drei helper only when it removes a specific, reviewed piece of scene code; it is not a baseline dependency.

## Runtime shape

Use one canvas and one finite district. The first view contains a low-detail, selectable representation of all three buildings, their connected highland terrain, streets, and a cloud deck. Keep the three building concepts separate at the asset level so a selected building can gain detail without downloading detailed assets for the entire collection.

```text
server-rendered editorial UI + complete building index
                    |
                    +-- client-only R3F scene island
                          |
                          +-- district-low.glb: terrain, streets, low-detail building silhouettes
                          +-- building-{slug}.glb: selected building detail, loaded on selection
                          +-- shared-instanced.glb: repeated vegetation, facade, roof, and street props
```

The district's low-detail buildings must preserve the recognizable exterior facts required by the visual-truth decision: form, proportions, floor count, facade composition, major materials, balcony/window pattern, plot, and district position. Higher-detail selected models may add detail but must be derived from that same canonical design.

Use a finite camera boundary and bounded orbit/zoom from the approved open-district interaction. On selection, the React route remains responsible for the building overview and the explicit action that opens its featured residence. Put accessible labels and controls in DOM, not as canvas text; raycast selection is an enhancement, not the primary contract.

## Asset workflow

1. **Author a canonical source scene.** Use Blender or another DCC tool to author the terrain, streets, three buildings, and featured-residence context at a shared scale and coordinate origin. Keep source files, reference renders, material schedule, and the building/residence brief together outside the runtime bundle.
2. **Export semantic runtime units.** Export the low-detail district and each building detail as GLB. Preserve stable building/node names and an authored manifest with the asset URL, selection target, camera target, and LOD relationship. Optimizers must retain these names/metadata.
3. **Validate and optimize.** Validate every export with the [Khronos glTF Validator](https://github.khronos.org/glTF-Validator/). Remove unused data, weld/deduplicate where it does not change design identity, quantize attributes, and encode geometry with `EXT_meshopt_compression`. `GLTFLoader` supports Meshopt, Draco, KTX2/BasisU, and instancing; it requires the matching decoder/loader when an encoding is used. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html) · [KHR_meshopt_compression](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_meshopt_compression/README.md)
4. **Treat textures as a measured tier.** Start with few, authored PBR materials and 1K maximum maps for the opening scene. Use KTX2/BasisU for large opaque maps after the first asset profile confirms texture memory is the limiting cost; `KTX2Loader` detects a device's supported GPU texture format before transcoding. Use WebP/PNG only for small alpha or UI-like assets where its visual result is needed. [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html) · [MDN: compressed textures](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#consider_compressed_texture_formats)
5. **Serve immutable static files.** Put versioned GLBs, KTX2 textures, and required decoder/transcoder files behind the deployment CDN. Lazy-load a building's detailed GLB after selection and prefetch it only during idle time.

Choose Meshopt as the default geometry encoding. It is standardized for glTF delivery and covers geometry, animation, and instance transforms. Do not also use Draco by default: it is a viable alternative, but Three.js documents its smaller-download versus additional-client-decoding trade-off. [Meshopt extension](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_meshopt_compression/README.md) · [DRACOLoader](https://threejs.org/docs/pages/DRACOLoader.html)

GLB is the runtime container because it bundles the glTF document and binary resources. The glTF specification targets runtime delivery with limited memory and supports a binary form designed to avoid base64 overhead. [glTF 2.0 motivation](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc#23-motivation-and-design-goals-informative) · [GLB format](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc#41-general-informative)

## Terrain, clouds, and lighting

Use exported, low-poly terrain with vertex colour or a restrained material palette. Its silhouette should make every building visibly grounded on its plot. Use shared repeated props as `InstancedMesh`; Three.js identifies it as the mechanism for rendering objects with the same geometry/material but different transforms while reducing draw calls. [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)

Render clouds as an art-directed, non-volumetric cloud deck: two to four broad layered meshes with low-frequency movement in normal-motion mode, plus distance fog to hide the finite district boundary. Pause their movement under reduced motion. Three.js's `Fog` supplies linear distance fog, which is sufficient for the gentle above-cloud fade. [Fog](https://threejs.org/docs/pages/Fog.html)

Use a small fixed lighting setup: one directional key light and ambient/hemisphere fill, with contact shading baked into assets where it helps. Do not put real-time volumetric clouds, particle simulations, screen-space reflections, screen-space ambient occlusion, live shadows on every object, high-resolution HDR environments, or a postprocessing stack in the baseline scene. Each competes with the continuously explorable district on lower-end mobile GPUs without adding information needed for building discovery.

## Performance and graceful-degradation contract

These are proposed acceptance budgets, not universal hardware guarantees. Verify them against representative iOS and Android devices, a lower-end laptop, and a current desktop browser before committing final asset limits.

| Area | Mobile/default low tier | Desktop capable tier |
| --- | --- | --- |
| Internal resolution | DPR cap 1.0 | DPR cap 1.5 |
| Interaction target | 30 FPS while orbiting/selecting | 60 FPS while orbiting/selecting |
| Opening scene transfer | district low-detail scene and required textures at or below 2 MB compressed | same asset set at or below 2 MB compressed |
| Loaded geometry | at most 75k triangles before selection; at most 150k after selected detail | at most 150k before selection; at most 300k after selected detail |
| Draw calls after loading | at most 60 | at most 120 |
| Motion | still scene when reduced motion is requested; cloud drift only while enabled | same, with an optional subtle cloud drift |

The exact limits may change after device testing, but the mechanisms must stay: capped drawing-buffer size, instancing, distance/detail culling, deferred selected-building assets, and no continuous frames when the scene is still. High-DPI phones can require nine times as many pixels at DPR 3, and Three.js recommends capping internal resolution to prevent excess GPU load, frame-rate loss, and power use. [Three.js responsive design](https://threejs.org/manual/pages/responsive.html) MDN likewise recommends a pixel-based VRAM budget, a smaller back buffer where necessary, and batching draw calls. [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

Set R3F to `frameloop="demand"` whenever the camera and clouds are still, explicitly invalidating for selection, resize, or a deliberate transition. Run a continuous loop only while normal-motion camera/cloud animation is active. R3F documents demand rendering as the way to avoid rendering frames when nothing changes. [R3F on-demand rendering](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/scaling-performance.mdx#on-demand-rendering)

If WebGL 2 cannot initialize, an asset fails, the browser signals context loss, a user chooses the simple view, or reduced motion is preferred, show the complete illustrated building index and the same building/residence route. Do not retry expensive assets indefinitely. The non-3D route is a first-class experience and must retain every building, overview, explicit featured-residence action, story, and return path.

## Trade-offs the implementation spec must preserve

- The stack accepts an extra client-side rendering dependency in exchange for a scene that is composed and controlled through the existing React application. Do not use a WebGPU-first path while the approved experience needs broad mobile and desktop coverage.
- The 3D district is intentionally stylized in terrain, clouds, and atmosphere. The buildings themselves must remain plausible and visually consistent with each selected concept's editorial imagery.
- A selected building earns extra geometry and texture detail; distant buildings do not. LOD must never erase the identifiers that make a building recognizable or selectable.
- Atmosphere supports discovery but does not block it: labels, index navigation, keyboard operation, and reduced-motion/simple-view routes remain usable without canvas motion or canvas availability.
- Quality is protected by authoring and validation rather than runtime effects. Source-model names, selection targets, LOD correspondence, and visual-reference renders are required review artifacts for each building.

## Sources

- [React Three Fiber README](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/readme.md)
- [React Three Fiber Canvas API](https://github.com/pmndrs/react-three-fiber/blob/master/docs/API/canvas.mdx)
- [React Three Fiber performance guide](https://github.com/pmndrs/react-three-fiber/blob/master/docs/advanced/scaling-performance.mdx)
- [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html)
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)
- [Three.js Fog](https://threejs.org/docs/pages/Fog.html)
- [Three.js responsive design](https://threejs.org/manual/pages/responsive.html)
- [Khronos glTF specification](https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/Specification.adoc)
- [Khronos Meshopt extension](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_meshopt_compression/README.md)
- [Khronos glTF Validator](https://github.khronos.org/glTF-Validator/)
- [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
