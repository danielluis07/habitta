# Project structure

Habitta is a Next.js App Router site for a fictional architecture studio. The visitor journey has three stages: the district, a building overview, and that building's featured residence story. The same content supports the 3D district and the simple building index.

| Path | Responsibility |
| --- | --- |
| `app/` | Routes, page metadata, global styles, and the site icon. `/` opens the district; `app/buildings/[slug]/` and its `residence/` child provide direct links to the later journey stages. |
| `components/` | Journey UI: `exploration.tsx` coordinates the visible stage, while the building index, overview, residence story, figure, and controls render its parts. |
| `components/district-scene/` | Client-side Three.js scene, camera framing, model loading, atmosphere, and display controls. `quality.ts` defines the rendering tiers, their selection and step-down; `ground.ts` the textured ground's layers and shader. |
| `components/ui/` | Shared UI primitives. |
| `lib/collection.ts` | Typed source of truth for the three concepts, their copy, image references, and scene bindings. |
| `lib/provenance.ts` | Manifest of visualization assets and their review status. The collection resolves published visualizations through accepted entries here. |
| `lib/journey.ts` | Journey stages, intents, and URL mapping; `components/use-journey.ts` connects that logic to the browser. |
| `public/concepts/<slug>/` | Concept images and schematic diagrams served from public URLs. Each concept owns its own assets. |
| `public/models/` | District and building GLBs loaded by the scene. See `docs/runtime-assets.md` before changing them. |
| `public/environments/` | The environment maps glass and metal reflect: the base map for every tier and the high tier's upgrade. |
| `public/textures/ground/` | The textured ground's tiling maps, made from CC0 sources by `bun run textures:generate`. |
| `fonts/` | Font setup used by the app. |
| `scripts/` | Model, environment-map and ground-texture generation, and their validation, run with Bun. `scripts/placeholder-models/` draws the development placeholders' buildings, landscape and props. |
| `tests/` | Bun tests for the simple-view journey, collection integrity, models, and scene behavior. |
| `docs/` | Implementation and research notes, including `IMAGE_GENERATION.md` for the current assets and the production workflow under `docs/research/`. |

The main content path is `lib/collection.ts` → presentation components. Visualization entries in the collection resolve their files through `lib/provenance.ts`; the scene uses the same concept slugs to select matching GLBs. Keep these references aligned when replacing assets.

Run the project with `bun run dev`, tests with `bun test`, and the production check with `bun run build`. `DESIGN.md` defines the visual system, and `CONTEXT.md` defines domain terms.
