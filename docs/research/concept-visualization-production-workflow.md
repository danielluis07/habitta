# Concept Visualization Production Workflow

## Recommendation

Treat the canonical DCC source scene as the design authority. Export a validated
low-detail district GLB and one detailed GLB per building for the interactive
scene, then render approved camera and room references from those same source
scenes. Use image generation only as a controlled interpretation step for the
five editorial roles, never as the source of architectural truth.

The workflow is:

1. Lock the building brief, featured-residence arrangement, material schedule,
   district position, and stable object names in the DCC scene.
2. Export the runtime GLBs and validate them with the Khronos glTF Validator.
   Keep the source scene, export settings, validator result, and reference
   renders together as the review record.
3. Produce a model-grounded reference pack: building context, living space,
   outdoor space, quiet room, and material study. Each reference includes a
   stable camera, scale cues, room or facade identifiers, and the approved
   material schedule. The context view and room views must come from the same
   canonical model revision.
4. Generate roles in dependency order: building context first; living and
   outdoor views next; quiet room and material study after the residence and
   materials are approved. Pass the approved model renders, room diagrams, and
   material references into each subsequent image request.
5. Review every output against the reference pack. Correct by revising the
   prompt/reference set or camera, and regenerate; do not paint over a broken
   floor plan, facade, window pattern, material identity, or site relationship.
6. Freeze accepted files with a stable concept slug, role, revision, source
   model revision, generation provider/model, input-reference manifest, prompt
   version, reviewer, date, and acceptance status.

## Canonical inputs

Each concept requires:

- the DCC source scene and a model revision identifier;
- the validated `district-low.glb` and `building-{slug}.glb` exports;
- an exterior fact sheet covering form, proportions, floor count, facade
  composition, major materials, balcony/window pattern, plot, and district
  position;
- one featured-residence arrangement diagram with room names, openings,
  circulation, and indoor/outdoor relationships;
- room-scale model renders or orthographic references for the living, outdoor,
  and quiet-room roles;
- a material schedule with names, locations, color/value, roughness, texture,
  and permitted variation;
- approved camera framing, lighting direction, season/daylight, clear-valley
  atmosphere, and aspect ratio for each role.

The same design facts must be represented in both the runtime GLBs and the
image references. glTF is the runtime interchange format, not a replacement
for the editable DCC source. The Khronos glTF 2.0 specification defines the
format, and the official validator is the export gate:

- [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator)
- [Three.js GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)

## Image order and acceptance gates

The building-context image establishes silhouette, plot, district position,
terrain, clear-valley atmosphere, and daylight. The living image establishes the
featured residence's primary spatial and material reading. The outdoor image
must preserve the residence's indoor/outdoor connection and the building's
exterior facts. The quiet-room image checks the residence arrangement at a
smaller, more intimate scale. The material study is last because it should
sample materials already accepted in the building and room views.

For every image, reject or regenerate when any of these fail:

- **Identity:** it depicts the selected building and its one featured
  residence, not a generic substitute.
- **Geometry:** massing, floor count, openings, balcony/window rhythm,
  circulation, room adjacency, and indoor/outdoor relationships agree with the
  source references.
- **Material:** named materials occur in the approved locations with plausible
  color, texture, roughness, and construction logic.
- **Place:** the plot, slope, district position, terrain, clear lake valley,
  distant haze, and daylight agree with the world rules.
- **Role:** the frame communicates its assigned living, outdoor, quiet-room,
  material-study, or context purpose without borrowing another concept's image.
- **Continuity:** recurring details, camera language, scale cues, and visual
  treatment agree across the five-image set.
- **Technical quality:** no malformed geometry, duplicated openings, impossible
  stairs, unreadable material detail, unwanted text/logos, artifacts, or asset
  provenance gaps.

Use deterministic source renders for geometry-sensitive checks. Reference-based
image generation may add atmosphere, styling, and controlled furnishing, but a
human review remains the acceptance gate. Official provider documentation
describes image inputs as references/conditioning rather than architectural
verification; provider APIs should therefore sit behind an internal adapter so
the workflow is not coupled to one vendor:

- [Google Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [OpenAI image generation and image inputs](https://platform.openai.com/docs/guides/images)

## Provenance and output constraints

Store a manifest beside each accepted image. It should identify the concept
slug, role, source DCC revision, GLB revisions, reference-render hashes,
provider and model, prompt/template revision, generation parameters, reviewer,
timestamp, and any post-processing. Keep rejected outputs and their rejection
reason long enough to prevent accidental reuse; do not present them as final
concept visualizations.

Use stable filenames such as
`{concept}-{role}-r{revision}.{format}`. Keep the source image at the chosen
editorial aspect ratio and provide responsive derivatives at build time. Avoid
upscaling details that the source model cannot support. Optimize delivery with
responsive images and lazy loading; the interactive scene remains governed by
the separate GLB, triangle, draw-call, and transfer budgets in the 3D scene
decision.

## Trade-offs

This approach costs more reference preparation and review time than generating
independent images from text, but it makes architectural errors observable and
repeatable. Passing several references improves continuity but can constrain
creative variation and increase provider cost. A provider adapter adds small
implementation overhead while preserving the ability to change models and
keeping provenance explicit. Geometry-sensitive views can be more expensive to
render from the DCC scene, but they are the required source of truth; generated
images are best reserved for presentation qualities that do not change the
design.
