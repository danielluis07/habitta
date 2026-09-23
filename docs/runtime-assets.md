# Runtime asset contract

This is the export and release contract for [issue #20](https://github.com/danielluis07/habitta/issues/20), under the [portfolio spec](https://github.com/danielluis07/habitta/issues/12). Concept URLs and scene bindings come from [`lib/collection.ts`](../lib/collection.ts). The visual palette comes from [`DESIGN.md`](../DESIGN.md).

## Deliverables and loading

Commit these self-contained glTF 2.0 binary files in `public/models/`. Next.js serves them at `/models/…`.

| File | Contents | When loaded |
| --- | --- | --- |
| `district-low.glb` | The surrounding landscape to the horizon (terrain, lake, vegetation), lanes and paths, separate plots, recognizable low-detail versions of all three buildings | Opening scene |
| `building-crest.glb` | Crest only | Crest selected |
| `building-contour.glb` | Contour only | Contour selected |
| `building-grove.glb` | Grove only | Grove selected |

Load no more than one detailed building at a time. Attach its scene at the district origin, with identity transform. After it loads, hide the matching low-detail selection subtree; keep the district landscape and other buildings. Restore that subtree and unload the detail on deselection or switching buildings. The selected model includes both bindings, so selection and DOM label positioning can transfer with it. Raycasting must include the selection target's mesh descendants. The anchor is an empty descendant of that target, and its world position supplies the DOM label position.

The scene also loads the environment maps glass and metal reflect, from `public/environments/` (see [Rendering tiers](#rendering-tiers)):

| File | Contents | When loaded |
| --- | --- | --- |
| `highland-512.hdr` | 512 × 256 px equirectangular Radiance HDR of the district's sky, ranges and highland | Opening scene, every tier |
| `highland-1024.hdr` | The same at 1,024 × 512 px, the desktop pack | High tier only, after the scene opens |

Every file has exactly one default scene. Embed all buffers and textures in the GLB; external files and data URIs are disallowed so opening transfer size includes all model resources. Geometry uses triangle lists, strips or fans. Meshopt compression (`EXT_meshopt_compression`) is required, including for placeholders; configure the runtime loader with a matching Meshopt decoder. `KHR_mesh_quantization` and `EXT_mesh_gpu_instancing` are also supported. Other extensions require a deliberate contract, validator and loader update. KTX2/BasisU is **not a default**; adopt it only after texture-memory profiling. Start with few PBR materials and small maps. The current placeholders are texture-free.

## Coordinates and stable bindings

Use metres, right-handed coordinates, **+Y up, +X east, −Z north**. The origin is the district centre. North is uphill; +Z opens south toward the valley. Keep every detail export in the same district world coordinates, including the root and anchor transforms. Do not recenter individual exports. Mesh transforms inside each target may differ between detail levels as long as the design and placement agree.

| Concept | Selection target in both files | Empty label anchor in both files | Placeholder plot origin (x, y, z), metres |
| --- | --- | --- | --- |
| Crest | `crest_selection_target` | `crest_label_anchor` | (−48, 21.2, −55), northwest ridge |
| Contour | `contour_selection_target` | `contour_label_anchor` | (48, 16.2, −8), eastern midslope |
| Grove | `grove_selection_target` | `grove_label_anchor` | (−48, 9.2, 52), southwest lower bench |

The exact placeholder coordinates are a starting layout, not final architectural dimensions. Final placement may change in coordinated exports; the axis convention and origin remain shared. Each binding must resolve to exactly one node reachable from the default scene. Optimizers must preserve those names, their hierarchy and world transforms. Selection targets contain actual building geometry, not a disconnected empty node. The checker rejects missing/duplicate/inactive bindings, empty selection targets, invalid anchors and district/detail transform differences above 0.001 per matrix element.

## Canonical design and placeholder status

Final district and detailed models must be exported from **one canonical DCC source scene**, with the source revision recorded alongside the export and in visualization provenance. Low and high detail preserve every recognizable exterior fact: silhouette, proportions, floor count, major materials, facade/opening/loggia patterns, indoor/outdoor relationships, plot and district position. Detail adds fidelity to the same design. Production review compares both exports with that source and the accepted briefs; automated geometry counts cannot establish architectural agreement.

The committed files are **development placeholders**, exempt from DCC authorship. [`scripts/generate-placeholder-models.ts`](../scripts/generate-placeholder-models.ts) is their reproducible source; its modules in [`scripts/placeholder-models/`](../scripts/placeholder-models/) draw the buildings, the landscape and its props. The district and each detailed export draw every building from the same definitions, so both detail levels are one design. Detail adds chamfered edges, frames with depth, sills, rail posts, tile courses, louvred shutters, terrace furniture, fuller planting and a finer bake, never a different building.

- **Crest:** twelve levels of limestone piers and floor bands on a rubble-stone plinth. East, west and north have framed two-pane windows in deep reveals. On the south, loggias sit recessed behind deep fins, each with a solid parapet, a bronze rail, an oak soffit and a three-panel bronze opening in a chalk-plaster back wall. A limestone crown closes the roof, which carries a plant room and planting.
- **Contour:** four levels stepping north on a stone retaining base, against a stone uphill wall. Each level opens south through a bronze-framed glass wall under the overhanging concrete slab of its own roof. That roof is the stone-paved terrace of the level above, with timber screens and a planted edge. The top roof is planted.
- **Grove:** a rectangular two-storey ring, buff brick below and lime render above, with deep reveals, timber frames and shutters, under a hipped clay-tile roof with ridge tiles and chimneys. It surrounds a planted court of gravel paths, brick-edged beds and olives, with the Garden residence's brick-walled patio and timber gate in its northeast corner.

Each finish is its own PBR material: limestone, rubble stone, chalk plaster, oak, bronze, glass, concrete, stone paving, timber, lime render, buff brick and clay tile. A building draws once per finish. The generator bakes ambient occlusion into vertex colours (`COLOR_0`, as normalized bytes). It casts rays from every vertex against the building and a ground plane under its plot, so walls darken where they meet the ground, reveals and loggias toward their corners, and props at their base. Faces are baked on a fine grid, then keep only the rows and columns their shading needs; faces hidden inside solids or inside the envelope are dropped. Glass takes no ambient shading. Instead each pane carries a sky sheen at its head, darkening toward its foot, so it reads as glass on its own; the environment map adds reflections on top. Each plot's bench is a dry-stone retaining platform, baked against its building, with gravel around the building and planting at its edges. Paths ramp down from the benches between stone edges to a kerbed lane, whose kerbs drop where each path joins it.

Repeated props are GPU instances (`EXT_mesh_gpu_instancing`), one draw per part however often they repeat. In the district, these are lane lights, near and far olives, cypresses, scrub, limestone rocks, dry-stone terrace walls and the soft contact shades under near trees. In both detail levels, they are each building's planting and Grove's court olives. This is simplified massing, not an accepted final architectural model or concept visualization.

**Third-party assets:** none. Every prop is generated by the script, so there is no external source or licence to record. A third-party asset added later must be CC0 or compatibly licensed, with its source, author and licence recorded here.

The district export also carries the **surrounding landscape**, so the district never reads as an isolated plot. Inside the occupied district (±110 m east–west, ±100 m north–south) the ground is the even slope the plots, lane and paths sit on. Beyond it, the ground blends into a Mediterranean highland after the concept visualizations: it climbs north to a ridge, the valley falls south to a lake between flanking hills, and mountain ranges close every horizon. The ground is one smooth-shaded grid, 10 m apart across the district and widening outward to 3.2 km from the centre, with vertex colours (`COLOR_0`) for dry grass, scrub and rock instead of textures. The lane continues past the district, olive groves and dry-stone terrace walls follow the slopes, limestone outcrops gather on rockier ground, and vegetation thins out into the distance. A final export must keep a landscape that reaches past the scene's haze from every allowed camera position; `tests/district-atmosphere.test.ts` checks this against the ground's bounds.

Each file's generator string, root/scene extras and selection-target extras mark it as a placeholder. Every building also has a visible roof plaque reading **PLACEHOLDER** with a diagonal hatch in the design system's paper and muted ink. A future scene UI should retain a visible Placeholder eyebrow while using these assets; metadata alone is not disclosure. Keep the geometry signs until final accepted models replace them.

```bash
bun run models:generate
bun run models:validate
```

Generation intentionally replaces the four model files with placeholders. Run it only when working on development massing, never as a production export step. The build validates the committed files and does **not** regenerate them.

## Budgets and automated checks

| Budget | Mobile | Desktop |
| --- | --- | --- |
| Opening transfer: district GLB, including embedded textures, plus the base environment map | ≤ 2,000,000 bytes (decimal 2 MB) | Same, on both rendering tiers |
| Deferred desktop pack, high rendering tier only | None | ≤ 3,000,000 bytes |
| Opening triangles | ≤ 75,000 | ≤ 150,000 |
| District plus one selected detail | ≤ 150,000 | ≤ 300,000 |
| Draw calls, opening and each selection | ≤ 60 | ≤ 120 |

Mobile and desktop are device classes; both currently use the same exports, so assets must pass both. The byte gates use file sizes on disk (Meshopt-compressed for GLBs, run-length-encoded for environment maps), without assuming additional HTTP gzip/Brotli savings. The opening asset set is the district GLB and the base environment map, whichever rendering tier the device gets. Any future mandatory model/texture download must be added to this accounting before adoption, and any high-tier upgrade to the desktop pack. With the committed files, the opening transfer is 728 KB (638 KB GLB, 90 KB map) and the desktop pack 249 KB.

`bun run models:validate` recursively discovers **every GLB under `public/`**, including unreferenced exports. It runs the [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) on each original file, decodes Meshopt using [glTF Transform](https://gltf-transform.dev/modules/core/classes/NodeIO), then runs Khronos validation again on an in-memory uncompressed GLB. The decoded pass is necessary because the validator does not inspect Meshopt payloads itself. Unsupported-extension informational messages from Khronos do not replace decoding. Errors, decoding failures, missing required models, binding failures and budget violations make the command exit nonzero. Warning counts appear in the report.

Counts traverse the default scene, counting each mesh occurrence, each primitive and GPU instance multiplicity. Triangle lists use index count / 3 (or vertex count / 3 without indices); strips/fans use count − 2. Each primitive on an ordinary mesh node counts as one draw; GPU instances share that draw. Selection totals conservatively add the **entire district plus the selected detail**, even during the replacement overlap. They do not sum all three detailed files, and do not subtract the hidden low-detail building. Future scene loading must honour this one-detail-at-a-time assumption.

The validator also reads each environment map named in `components/district-scene/quality.ts`: it must exist, be an RLE Radiance HDR twice as wide as it is high, and the base map must be 256 to 512 px wide. The base map's bytes join the district GLB's in the opening transfer; the maps in `desktopPack` count toward the desktop pack.

`bun run build` runs this validation before Next.js. `bun test` also validates committed models and exercises broken/corrupt exports, missing or renamed bindings, transforms, oversized files, combined selection budgets, reused meshes and GPU instances, and missing, malformed or oversized environment maps. No WebGL is needed for these checks.

## Rendering tiers

Quality comes mainly from these assets and their baked light. The scene renders them at one of two **rendering tiers**, defined with their selection and step-down thresholds in `components/district-scene/quality.ts`. A tier only adds runtime effects on top; none of them is required.

| | Base tier (every device) | High tier (capable desktops) |
| --- | --- | --- |
| Environment map on glass and metal | `highland-512.hdr` | `highland-1024.hdr` once loaded, `highland-512.hdr` until then |
| Pixel ratio | 1 | The device's, up to 2 |
| Sun shadow map | None | One, 2,048 px, over the occupied district |
| Post-processing | None (the canvas's MSAA) | Subtle SSAO (N8AO) and SMAA |
| Downloads | Opening transfer | Opening transfer, then the desktop pack |

Glass and metal are the glossy (roughness ≤ 0.2) or metallic (metalness ≥ 0.5) materials; three.js prefilters their equirectangular map into a PMREM on first use. The base tier stays within the #9 baseline, which excludes only high-resolution HDR environments. Every mesh receives the sun's shadow and every opaque one casts it, so an export needs no shadow flags; only the high tier draws them.

The environment maps are generated, not captured: [`scripts/generate-environment-maps.ts`](../scripts/generate-environment-maps.ts) (`bun run environments:generate`) draws the sky from the scene haze to its zenith, a soft glow around the sun, two layers of ranges, higher to the north, and the mottled highland fading into the haze, all from the DESIGN.md scene tokens. The sun itself is left out, because the scene's directional light already draws its highlight. A captured or rendered HDR may replace them if it keeps the file names, format and budgets.


These are asset costs, not complete frame measurements. The runtime sky, other procedural meshes, shadow passes, material effects and UI rendering may add costs. Reserve headroom and check renderer triangle/draw-call statistics on representative iOS, Android, low-end laptop and desktop hardware. Opening size, triangle counts and draws do not prove the 30 FPS mobile / 60 FPS desktop targets; camera feel, visibility, architectural fidelity and performance remain manual review items.

## Replacing placeholders

1. Export the district and all detailed buildings from the reviewed DCC revision using the coordinates, hierarchy, names and URLs above. Export repeated street, vegetation, roof and facade props as `EXT_mesh_gpu_instancing` nodes rather than copies. Keep the district's low-detail exterior facts consistent with each detail and the brief.
2. Embed resources, apply Meshopt, preserve semantic nodes, and record the DCC/GLB revisions in the production provenance workflow. Remove placeholder flags/signage only for accepted final assets.
3. Replace the committed GLBs. Run `bun run models:validate`, `bun test`, and `bun run build`.
4. Review both detail levels in the scene, including selection, labels, swap alignment, plots/paths, lighting and device budgets. No collection or scene code changes are needed for exports that preserve this contract.
