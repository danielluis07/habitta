# Concept image generation

The published collection has 13 revision 2 WebP visualizations and two retained Grove revision 1 images in `public/concepts/<slug>/`. They were generated with OpenAI's built-in `image_gen` tool, which does not expose its exact model version; **GPT Image 2.5 use cannot be verified**. Each source image was 1536 × 1024 pixels and was converted to WebP with Sharp at quality 86. The three floor diagrams were drawn as SVGs by `scripts/generate-residence-diagrams.ts`.

These are editorial images for a fictional project, not photographs of real buildings. They were reviewed against the text briefs in `lib/collection.ts`, the grounded district rules in `DESIGN.md`, and issue [#39](https://github.com/danielluis07/habitta/issues/39). The current GLBs are development placeholders and there is no canonical DCC source scene or room render pack; a final geometry and continuity review under the [production workflow](research/concept-visualization-production-workflow.md) remains necessary. `lib/provenance.ts` records the acceptance scope, source references and discarded variants.

## Revision 2

Generated on 2026-09-23. Crest and Contour each received new building-context, living, outdoor, quiet-room and material-study images. Grove received new building-context, living and outdoor images. Grove's revision 1 quiet room and material study were retained after visual review: both show straight walls, matching lime render, buff brick and timber, and no cloud sea. The 13 replaced revision 1 WebP files were removed from the published asset folders; their manifest entries remain as superseded history.

The revision 1 architecture, material schedule, cameras and role details below were retained. Every new prompt replaced “above clouds” and “cloud valley” with a **grounded Mediterranean highland**: olive and cypress trees, dry grass and scrub, rock outcrops, dry-stone terrace walls, a clear south valley with a lake, and layered blue mountain ranges fading into distant haze. No clouds may sit below or level with the viewer. Warm late-morning light still comes from the southeast. No people, text, signage or logos were requested.

The building-context images were generated first and used as identity, light, landscape and material references for their residence images. Crest's living image also used the accepted revision 2 loggia image to preserve its solid parapet, thin bronze rail and recessed construction. The final Crest context was revised to strengthen its twelve-storey rhythm. Source reference hashes are recorded in `lib/provenance.ts`.

| Concept | Revision 2 prompt change |
| --- | --- |
| Crest | Place the twelve-storey limestone and bronze tower on the northwest ridge above a **clear** lake valley. Preserve recessed south loggias with solid parapets and thin rails; no projecting or glass balconies. Living, outdoor, quiet room and material study use the same clear valley and loggia construction. |
| Contour | Set four long concrete terrace steps into the eastern hillside, with stone retaining base and timber screens, above a clear lake valley. Residence views preserve the deep level-2 south terrace, terrazzo, textured stone, oak and board-textured concrete. |
| Grove | Specify a **rectangular** two-storey ring with four straight wings and square corners, lime render above a buff brick plinth, clay roof and open planted court. The Garden residence remains in the northeast ground-floor corner; living and patio face west to the court. No curved wing, wall, roof or facade is allowed. |

Visual review found no cloud sea in the published revision 2 set. Grove's context, living and patio views show straight wings and corners. The original generated PNG sources remain in the local Codex image output directory; the published assets are the 1536 × 1024 WebP files. The built-in tool's model version is unknown and should not be recorded as GPT Image 2.5.

## Revision 1 prompt set

All photo prompts requested a new photorealistic, quietly editorial architectural view at a 3:2 landscape ratio, warm late-morning southeast light, believable construction and material texture, with no people, text, signage, or logos. Each residence view used its building-context output as an image reference for identity, light, and materials. The following scene and role details were supplied to the generator; they are the prompt set for revision 1.

| Concept | Building context | Shared residence details |
| --- | --- | --- |
| Crest | Slender twelve-storey ridge tower above clouds, pale limestone piers, recessed south loggias, stone plinth, bronze frames, southwest camera. The selected revision emphasized twelve visible residential floor bands. | Horizon, level 10 south half; pale oak, chalk plaster, warm-grey limestone, dark bronze; sheltered recessed loggia with a solid pale parapet and thin bronze rail. |
| Contour | Four long concrete residential terraces stepping north uphill into the eastern slope, stone retaining base, timber privacy screens, downhill southwest camera. | Terrace, western end of level 2; sand-toned terrazzo, light oak, textured stone, board-textured concrete; deep south terrace on the roof of the lower step. |
| Grove | Two-storey lime-render and buff-brick ring around an open planted courtyard, elevated southwest camera. | Garden, northeast ground-floor corner; light clay tile, pale oak, timber windows and shutters; living opens west to a private court-facing patio, bedrooms face the outer east garden. |

| Role | Role-specific prompt details |
| --- | --- |
| Living | Crest: southwest living room through a three-panel bronze opening to the recessed loggia and cloud valley, with oak kitchen edge. The selected revision also used the outdoor image as a construction reference and required the solid parapet. Contour: living and dining on terrazzo, four-panel glass wall to the deep terrace. Grove: clay-tile living room through a deep two-panel timber opening to private patio and shared court. |
| Outdoor | Crest: east end of the sheltered loggia, stone paving, solid parapet, bronze rail, overhead slab and living-room opening. Contour: southwest terrace corner looking back to living and bedroom openings, planted edge, timber screen and concrete slab. Grove: private patio from its west edge, low brick wall, timber gate and shared path. |
| Quiet room | Crest: main bedroom facing south through one broad flush bronze-framed window, without a balcony. Contour: main bedroom with oak floor and its own opening to the screened terrace corner. Grove: main bedroom with a single deep east window and timber shutter overlooking outer planting. |
| Material study | Crest: oak-to-limestone living/loggia threshold and bronze track. Contour: terrazzo-to-stone terrace threshold, timber screen and board-textured concrete. Grove: clay tile, deep timber frame in lime render and adjacent buff brick. |

The first Crest exterior and living outputs were rejected because their visible construction conflicted with the briefs. Their replacement prompts explicitly required a twelve-storey rhythm and a solid recessed-loggia parapet, respectively. The accepted outputs are mapped by ID in `lib/provenance.ts`.
