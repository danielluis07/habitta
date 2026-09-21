# Building detail story prototype

Throwaway artifact for [Prototype a building detail story](https://github.com/danielluis07/habitta/issues/5), within [Shape a fictional 3D architecture studio portfolio](https://github.com/danielluis07/habitta/issues/1).

Status: **Awaiting human review. No residence presentation decision has been made.** Keep this experiment on `prototype/building-detail-story`; the map ends at an implementation-ready spec, so none of these variants is promoted to production.

## Run

On branch `prototype/building-detail-story`, run `bun install`, then `bun run dev`.

- [Editorial story](http://localhost:3000/?variant=A&residence=vale)
- [Image gallery](http://localhost:3000/?variant=B&residence=vale)
- [Spatial notebook](http://localhost:3000/?variant=C&residence=vale)

The bottom switcher or left/right arrow keys change variants without resetting the selected building or recreating the district. The URL preserves the variant and open residence for sharing or reload. `residence=serra` and `residence=patio` exercise the other provisional homes. A direct residence link starts from the default district viewpoint; a home opened during exploration returns to that visit's saved viewpoint.

Visit `/` to start with the accepted Open district journey. Select a building and choose **Discover this home**. **Back to [building]** returns to its overview; **Return to the district** clears the selection and restores the district viewpoint. Escape closes the story. The full story replaces the visible district, whose controls are inert while it is open.

## Question

After choosing a building and explicitly opening its featured residence, what should visitors see first, what should they learn next, and how much detail should they be offered?

## Design plan

Retain the discovery prototype's subject-specific palette: sky `#d7e4e8`, chalk `#f4f5f0`, foliage `#75826f`, stone `#c7c8bc`, graphite `#283a3c`. Inter carries the studio identity and readable body text. Large, left-aligned residence names establish the home; architectural diagrams occupy the main visual space. Each option proposes a different reading behavior, rather than recoloring the same layout.

```text
A: identity -> idea + facts -> living -> outdoor -> quiet rooms
   -> arrangement + optional materials -> building -> optional contact

B: identity -> large image + changing caption | expandable details
   -> previous/next through five images      | optional contact

C: identity -> idea + selectable plan + facts | selected space image + story
   -> materials -> building context -> optional contact
```

The prototype remains in the existing home/story flow. Its shared title and navigation preserve the building-to-residence relationship. The final materials, exact dimensions, building collection, and media production workflow remain undecided.

## Variants

| Variant | Primary affordance | Information depth | Tradeoff to judge |
| --- | --- | --- | --- |
| A: Editorial story | Scroll through an authored sequence | Idea and key facts are visible first; images and short room stories follow; material details expand | Clear narrative and building relationship, but longer page |
| B: Image gallery | Previous/next through five images | Captions change with the image; design idea, dimensions/arrangement, and building context expand in the side column | Most image-led; important context can be missed if visitors skip details |
| C: Spatial notebook | Select a labeled space in a schematic plan | Idea and facts stay beside the diagram; each selection changes the room image and description | Explains spatial relationships directly, but asks visitors to understand a diagram |

On narrow screens, columns become a reading sequence. The gallery image precedes its detail controls. The spatial notebook places the room buttons above the selected room image. Every plan region is an ordinary keyboard-operable button; the diagrams are expressly not measured floor plans.

## Proposed content and image roles

These are **proposals for review**, not approved requirements.

- Identity: building name, featured residence name, and explicit imagined-concept status.
- Design idea: one short introduction tied to how the home is arranged.
- Facts: arrangement, interior area, outdoor area, and bedroom count. All numerical examples are fictional placeholders, visibly identified as illustrative.
- Room stories: shared living space, outdoor space, and quiet rooms, each with an image role and a short explanation.
- Arrangement: a schematic relationship diagram. Vale's upper level is marked; the diagram does not claim to be an architectural floor plan.
- Materials: a small named palette with an optional closer view.
- Building context: exterior study, the home's approximate position, and a short explanation of how it belongs within the structure.
- Contact: an optional **Contact Habitta** disclosure. A shows it after the full story, B alongside the gallery, C after the plan-led content and building context. This demonstrates placement only; no form or message is sent and no real contact address is invented.

Proposed image inventory per home: living view (also the editorial opening image), outdoor view, quiet-room view, exterior/building context, material study, plus the schematic plan. The development review notes on the page carry image briefs for each home.

The SVG diagrams are intentionally rough, locally authored code assets. They stand in for image roles and proportions; they are not AI-generated photos or final building geometry. Room diagrams share a simple composition across homes, with palette/context cues, and do not validate geometric correspondence. Final visual consistency rules belong to the remaining media and scene decisions.

## Review

1. Choose A, B, C, or a specific combination. Does the visitor need an authored story, a gallery, or an explanation of the spatial arrangement?
2. Decide whether concept areas, bedroom counts, and a diagram should be visible, expandable, or omitted. The draft numbers themselves are not collection decisions.
3. Judge the optional contact placement, and whether the proposed room/image coverage is enough to understand the home.

Suggested starting point: A, because it gives the residence a short narrative and explicitly reconnects it to the building. The user may prefer the gallery's pace or the notebook's spatial focus.

## Captured views

- [Editorial story](building-detail-story/editorial-story.png)
- [Image gallery](building-detail-story/image-gallery.png)
- [Spatial notebook](building-detail-story/spatial-notebook.png)
- [Editorial on mobile](building-detail-story/mobile-a.png)
- [Gallery on mobile](building-detail-story/mobile-b.png)
- [Spatial notebook on mobile](building-detail-story/mobile-c.png)

## Verification

Lint, TypeScript, and diff whitespace checks passed. A temporary Chromium smoke check exercised all variants, URL and keyboard switching, one retained scene canvas, gallery controls, room selection, contact expansion, focus on opening and return, Escape, both return paths, and direct links to all three provisional residences. Each variant fit a 390px viewport without horizontal overflow. No browser page errors were reported. The existing scene emits a Three.js soft-shadow deprecation warning; this content prototype does not settle the production renderer.

Screenshots were visually inspected on desktop and mobile. An initial return-focus timing issue and an unintended filled line in a schematic were corrected before the passing check. These are prototype checks, not production accessibility, device-performance, or geometric-consistency certification.

## References consulted

The installed Next.js client-component, search-parameter, and router guides were consulted before implementation, alongside the existing discovery prototype and resolved map decisions. Existing button composition follows the [shadcn Base UI Button documentation](https://ui.shadcn.com/docs/components/base/button).
