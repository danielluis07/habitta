# Runtime asset contract

This is the export and release contract for [issue #20](https://github.com/danielluis07/habitta/issues/20), under the [portfolio spec](https://github.com/danielluis07/habitta/issues/12). Concept URLs and scene bindings come from [`lib/collection.ts`](../lib/collection.ts). The visual palette comes from [`DESIGN.md`](../DESIGN.md).

## Deliverables and loading

Commit these self-contained glTF 2.0 binary files in `public/models/`. Next.js serves them at `/models/…`.

| File | Contents | When loaded |
| --- | --- | --- |
| `district-low.glb` | Terrain, lanes and paths, separate plots, recognizable low-detail versions of all three buildings | Opening scene |
| `building-crest.glb` | Crest only | Crest selected |
| `building-contour.glb` | Contour only | Contour selected |
| `building-grove.glb` | Grove only | Grove selected |

Load no more than one detailed building at a time. Attach its scene at the district origin, with identity transform. After it loads, hide the matching low-detail selection subtree; keep the district landscape and other buildings. Restore that subtree and unload the detail on deselection or switching buildings. The selected model includes both bindings, so selection and DOM label positioning can transfer with it. Raycasting must include the selection target's mesh descendants. The anchor is an empty descendant of that target, and its world position supplies the DOM label position.

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

The committed files are **development placeholders**, exempt from DCC authorship. [`scripts/generate-placeholder-models.ts`](../scripts/generate-placeholder-models.ts) is their reproducible source. It uses the same massing for the district and individual exports: Crest has twelve levels and south recesses, Contour has four levels stepping north, and Grove is a two-storey ring around an open court. Each sits on its own bench connected to the lane by a path. This is simplified massing, not an accepted final architectural model or concept visualization.

Each file's generator string, root/scene extras and selection-target extras mark it as a placeholder. Every building also has a visible roof plaque reading **PLACEHOLDER** with a diagonal hatch in the design system's paper and muted ink. A future scene UI should retain a visible Placeholder eyebrow while using these assets; metadata alone is not disclosure. Keep the geometry signs until final accepted models replace them.

```bash
bun run models:generate
bun run models:validate
```

Generation intentionally replaces the four model files with placeholders. Run it only when working on development massing, never as a production export step. The build validates the committed files and does **not** regenerate them.

## Budgets and automated checks

| Budget | Mobile | Desktop |
| --- | --- | --- |
| Opening GLB, including embedded textures | ≤ 2,000,000 bytes (decimal 2 MB) | Same |
| Opening triangles | ≤ 75,000 | ≤ 150,000 |
| District plus one selected detail | ≤ 150,000 | ≤ 300,000 |
| Draw calls, opening and each selection | ≤ 60 | ≤ 120 |

Both tiers currently use the same exports, so assets must pass both. The byte gate uses the Meshopt-compressed file size on disk, without assuming additional HTTP gzip/Brotli savings. The opening asset set is the district GLB alone; any future mandatory model/texture download must be added to this accounting before adoption.

`bun run models:validate` recursively discovers **every GLB under `public/`**, including unreferenced exports. It runs the [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) on each original file, decodes Meshopt using [glTF Transform](https://gltf-transform.dev/modules/core/classes/NodeIO), then runs Khronos validation again on an in-memory uncompressed GLB. The decoded pass is necessary because the validator does not inspect Meshopt payloads itself. Unsupported-extension informational messages from Khronos do not replace decoding. Errors, decoding failures, missing required models, binding failures and budget violations make the command exit nonzero. Warning counts appear in the report.

Counts traverse the default scene, counting each mesh occurrence, each primitive and GPU instance multiplicity. Triangle lists use index count / 3 (or vertex count / 3 without indices); strips/fans use count − 2. Each primitive on an ordinary mesh node counts as one draw; GPU instances share that draw. Selection totals conservatively add the **entire district plus the selected detail**, even during the replacement overlap. They do not sum all three detailed files, and do not subtract the hidden low-detail building. Future scene loading must honour this one-detail-at-a-time assumption.

`bun run build` runs this validation before Next.js. `bun test` also validates committed models and exercises broken/corrupt exports, missing or renamed bindings, transforms, oversized files, combined selection budgets, reused meshes and GPU instances. No WebGL is needed for these checks.

These are asset costs, not complete frame measurements. Runtime clouds, other procedural meshes, shadow passes, material effects and UI rendering may add costs. Reserve headroom and check renderer triangle/draw-call statistics on representative iOS, Android, low-end laptop and desktop hardware. Opening size, triangle counts and draws do not prove the 30 FPS mobile / 60 FPS desktop targets; camera feel, visibility, architectural fidelity and performance remain manual review items.

## Replacing placeholders

1. Export the district and all detailed buildings from the reviewed DCC revision using the coordinates, hierarchy, names and URLs above. Keep the district's low-detail exterior facts consistent with each detail and the brief.
2. Embed resources, apply Meshopt, preserve semantic nodes, and record the DCC/GLB revisions in the production provenance workflow. Remove placeholder flags/signage only for accepted final assets.
3. Replace the committed GLBs. Run `bun run models:validate`, `bun test`, and `bun run build`.
4. Review both detail levels in the scene, including selection, labels, swap alignment, plots/paths, lighting and device budgets. No collection or scene code changes are needed for exports that preserve this contract.
