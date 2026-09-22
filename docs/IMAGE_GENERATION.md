# Concept image generation, revision 1

The 15 WebP concept visualizations in `public/concepts/<slug>/` were generated with OpenAI's built-in `image_gen` tool on 2026-09-22. The tool does not expose its exact model version, so these files are **not verified as “GPT 2.5” output**. Each source image was 1536 × 1024 pixels and was converted to WebP with Sharp at quality 86. The three floor diagrams were drawn as SVGs by `scripts/generate-residence-diagrams.ts`.

These are editorial images for a fictional project, not photographs of real buildings. They were reviewed against the text briefs in `lib/collection.ts` and `DESIGN.md`. The current GLBs are development placeholders and there is no canonical DCC source scene or room render pack; a final geometry and continuity review under the [production workflow](research/concept-visualization-production-workflow.md) remains necessary. `lib/provenance.ts` records the acceptance scope and the two discarded Crest variants.

## Prompt set

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
