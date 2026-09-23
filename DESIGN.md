---
version: alpha
name: Habitta
description: Airy, quietly editorial portfolio for an imagined architecture studio. Warm daylight, limestone paper, warm ink, restrained typography.
colors:
  paper: "#F4F1EA"
  paper-raised: "#FBF9F5"
  ink: "#1F1D1A"
  ink-hover: "#36332E"
  ink-muted: "#5E5850"
  border-control: "#8A8378"
  hairline: "#D9D3C7"
  error: "#9A3B2E"
  scene-haze: "#DAE2E1"
  scene-sky-zenith: "#BCD0DA"
  scene-sun: "#FFF1DC"
  scene-terrain-grass: "#A5AE95"
  scene-terrain-dry: "#B4B094"
  scene-terrain-scrub: "#949D80"
  scene-terrain-rock: "#B8B1A3"
  scene-terrain-lane: "#CFC7B6"
  scene-lake: "#9EB3B7"
  diagram-outdoor: "#DCE0D3"
typography:
  wordmark:
    fontFamily: Newsreader
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -0.01em
  display-xl:
    fontFamily: Newsreader
    fontSize: 56px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: -0.015em
  display-lg:
    fontFamily: Newsreader
    fontSize: 36px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -0.01em
  heading:
    fontFamily: Newsreader
    fontSize: 28px
    fontWeight: 400
    lineHeight: 1.2
  pull:
    fontFamily: Newsreader
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1.4
  body:
    fontFamily: Instrument Sans
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Instrument Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Instrument Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2
  caption:
    fontFamily: Instrument Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  eyebrow:
    fontFamily: Instrument Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.08em
  fact-value:
    fontFamily: Instrument Sans
    fontSize: 15px
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: '"tnum" 1'
rounded:
  none: 0px
  sm: 2px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  3xl: 96px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 20px
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 20px
    height: 44px
  control-bar:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.sm}"
    padding: 4px
  scene-label:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 6px 10px
  scene-label-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 6px 10px
  building-overview:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 24px
    width: 380px
  building-index-entry:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: 16px 0px
  eyebrow:
    textColor: "{colors.ink-muted}"
    typography: "{typography.eyebrow}"
  figure-caption:
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
  concept-visualization:
    rounded: "{rounded.none}"
  details-disclosure:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: 16px 0px
  text-input:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 10px 12px
    height: 44px
  simple-view-notice:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
---

# Habitta Design System

This is the visual source of truth for the Habitta portfolio. Domain terms follow [`CONTEXT.md`](CONTEXT.md). Behavior is specified elsewhere and is linked rather than restated here: the journey, motion policy, accessibility, and fallback rules live in the spec [#12](https://github.com/danielluis07/habitta/issues/12) and in [#7](https://github.com/danielluis07/habitta/issues/7).

## Overview

Habitta is a fictional architecture studio showing imagined residential concepts in a single highland district, a grounded landscape of dry grass and scrub that runs out to a hazy horizon. The mood is **airy and quietly editorial**: warm daylight, generous space, restrained typography ([#3](https://github.com/danielluis07/habitta/issues/3)).

Three principles govern every visual decision:

1. **One atmosphere.** The UI, the 3D district, and the concept visualizations share one light and one palette. The scene's cool haze and the warm paper of the page are two tones of the same daylight, so panels read as part of the place rather than as chrome laid over it.
2. **The work carries the color.** The chrome is paper and ink only. Color comes from the buildings' materials, the landscape, and the concept visualizations. No building gets its own theme; Crest, Contour, and Grove read as one collection ([#8](https://github.com/danielluis07/habitta/issues/8)).
3. **Honest presentation.** Everything is an imagined concept. The design never borrows the visual language of property listings or documentary photography, and it gives the "Imagined concept" and "Concept visualization" disclosures a fixed, recognizable place ([#6](https://github.com/danielluis07/habitta/issues/6)).

The site has a light theme only. The district is fixed in warm daylight and every concept visualization shares that light; a dark theme would contradict both.

## Colors

The palette is limestone paper and warm ink, with no chromatic accent.

- **Paper (`#F4F1EA`)** is the page background. It is warm, while the scene's haze is cool; the two meet at the canvas edge and are not required to match.
- **Paper raised (`#FBF9F5`)** is the surface for anything sitting over the canvas or lifted off the page: scene labels, control bar, building overview, inputs, notices.
- **Ink (`#1F1D1A`)** is the text color and the primary action color. It is a warm near-black, never `#000`. **Ink hover (`#36332E`)** is its hover state.
- **Ink muted (`#5E5850`)** is for secondary text: eyebrows, captions, metadata. It passes 6.2:1 on paper.
- **Border control (`#8A8378`)** outlines interactive components (secondary buttons, scene labels, inputs, the control bar). It passes the 3:1 non-text contrast required for component boundaries.
- **Hairline (`#D9D3C7`)** is for decorative dividers only (index rows, section rules). At 1.3:1 it must never be the only visible boundary of a control.
- **Error (`#9A3B2E`)** is reserved for form validation in the optional contact block.

Emphasis comes from type size, weight, and underlines, not from hue. Links are ink with an underline. The focus indicator is a 2px ink outline with a 2px offset. Over the canvas it sits on a paper-raised surface, so it keeps its contrast whatever the scene is showing.

Measured contrast on paper: ink 14.9:1, ink muted 6.2:1, border control 3.3:1. Paper on ink (primary buttons, selected label): 14.9:1.

## Typography

Two families, both variable and served through `next/font/google`:

- **Newsreader** is the display and editorial voice: the wordmark, building and residence names, story headings, and pull text. Use its regular weight with optical sizing on. Use italic only for pull text and room-story lead-ins.
- **Instrument Sans** is used for everything else: body, UI, scene labels, controls, facts, captions, eyebrows. Only weights **400 and 500** are allowed. Nothing is bold.

The scale:

| Token | Use |
| --- | --- |
| `display-xl` | Residence name at the head of its story. It steps down to 40px on narrow viewports. |
| `display-lg` | Building name in the building overview and building index; section openers. It steps down to 30px on narrow viewports. |
| `heading` | Story section headings (the idea, arrangement, materials, the building). |
| `pull` | Newsreader italic pull text and room-story lead-ins. |
| `wordmark` | "Habitta" in the shell. |
| `body` | Story prose and descriptions. |
| `body-sm` | Panel copy, index descriptions, form text, notices. |
| `label` | Buttons, scene labels, disclosure summaries, control text. |
| `caption` | Figure captions and room-story lines under images. |
| `eyebrow` | Uppercase kicker above headings, fact labels, and disclosure prefixes. |
| `fact-value` | Numerical facts (areas, levels, bedrooms), with tabular figures. |

The **eyebrow** is the project's one metadata voice. It is set in uppercase with +0.08em tracking in ink muted. Use it for "Imagined concept · Ridge tower", fact labels such as "Interior area", the "Concept visualization" caption prefix, and "Schematic, not to scale". Do not invent ad-hoc badges for these disclosures.

Figures in the story are approximate targets and are labeled as such, for example "Approx. 140 m²".

## Layout

- **Base unit** 4px; use the `spacing` scale. Generous space is part of the mood, so a gap between story sections should be at least `2xl`.
- **Page gutters** are 16px on phones and 40px from tablet up. There is never horizontal page scroll, at any width or zoom.
- **Text measure** is capped at about 64ch in the residence story.
- **Figure width**: story images step out wider than the text column (up to about 1040px) but are not full-bleed. The opening image is the only full-bleed image.

### District overview

The canvas fills the viewport. The wordmark sits top-left over the sky, and the arrival heading and intro sit directly on the sky and haze below it, with no panel, blur, or tint behind them. The camera is fixed ([ADR 0001](docs/adr/0001-fixed-camera-stage-set-district.md)): there is no orbit, zoom or rotation, and the only camera motion is the fly-to that follows selection. The overview camera looks down about 6° and uses a lens shift to frame the buildings below the copy, so sky and a thin band of hazy ranges, never treed ground, rise behind the text. Below the buildings it keeps a band of nearer landscape (olives, cypresses, terrace walls, rocks) that frames them like the foreground of an architectural render. Overlaid text keeps its ink and ink-muted colors, which hold AA against sky and haze (about 12:1 and 5:1). When a building opens, the arrival copy steps aside. On viewports too short to keep the copy over the sky (narrower than 768px and shorter than 800px, or shorter than 640px at any width), the heading and intro sit above the district on paper, and the district fills the viewport below them. The control bar (motion, simple view, building index) is a single paper-raised strip anchored bottom-center on desktop. On narrow viewports it sits at the bottom edge with all controls reachable in one row or a wrapped second row, never hidden behind a menu. The building overview opens as a side panel (380px) on desktop and as a bottom sheet on narrow viewports. It never covers the selected building's label.

### Building index

The building index is a vertical list of entries separated by hairlines. Each entry has a 3:2 exterior still on the left (on top on narrow viewports), an eyebrow with the building type, the building name in `display-lg`, a `body-sm` description of form, materials, and place in the district, and the featured residence name. In simple view the index is the page, using the same entries.

### Residence story

The reading order follows [#5](https://github.com/danielluis07/habitta/issues/5) and [#12](https://github.com/danielluis07/habitta/issues/12). Image treatment:

| Image | Treatment |
| --- | --- |
| Living (opening image) | Full-bleed. 16:9 on desktop; 4:5 on narrow viewports with its own art-directed crop, never an automatic center crop. |
| Outdoor, quiet room | Figure width, 3:2. |
| Material study | Square. Beside the visible materials list on desktop, stacked below it on narrow viewports. |
| Building context | Figure width, 3:2. |

Every concept visualization has a caption below it. The caption opens with the eyebrow "Concept visualization", followed by the room-story line in `caption`. The story head also states once, in its eyebrow, that the residence is an imagined Habitta concept.

## Elevation & Depth

The design is flat. Depth belongs to the 3D scene, not to the UI.

- No drop shadows, no backdrop blur, no translucent glass. Blur costs render budget ([#24](https://github.com/danielluis07/habitta/issues/24)), and text on glass over a busy landscape cannot reliably hold AA contrast.
- Surfaces over the canvas are solid **paper raised** with a 1px border-control outline. Their outline, not a tint of the scene, separates them from the landscape behind.
- Layering is expressed by surface color (paper → paper raised) and borders, never by shadow.

## Shapes

- **2px** (`rounded.sm`) on buttons, inputs, scene labels, panels, notices, and the control bar. Crisp edges suit architecture; soft app-like rounding does not.
- **0** (`rounded.none`) on every image and on the diagram.
- Icons come from Lucide with a 1.5px stroke, at 20px in a 44px hit target.

## Components

- **Buttons.** The primary button ("Open residence", "Send") is ink with paper text. The secondary button is paper raised with a 1px border control and ink text. The minimum height for all buttons is 44px. Only one primary button is visible per view.
- **Control bar.** A paper-raised strip with a border-control outline holds the text controls. The motion and simple-view controls show their state in text ("Motion on" / "Motion off"), not by color alone.
- **Scene labels.** A DOM tag positioned from the building's label anchor. It holds the building name in `label` on paper raised with a 1px border control, and has no leader line. The **selected** label inverts to ink with paper text. Labels never use the serif.
- **Building overview.** A paper-raised panel with a border-control outline. The content, top to bottom: an eyebrow with "Imagined concept" and the building type, the building name in `display-lg`, a `body-sm` description, the featured residence name, then the primary "Open residence" action. The close action is a secondary text button.
- **Building index entry.** Laid out as described under Layout. The whole entry is one link target with a visible focus outline around the entire entry.
- **Details disclosure.** Holds dimensions, numerical facts, and the schematic diagram. It starts collapsed, as #5 requires. Its summary is set in `label` with a chevron, between hairline rules. Facts inside it are eyebrow labels over `fact-value` numbers.
- **Schematic diagram.** Ink hairline strokes on paper, room names in Instrument Sans, and outdoor space filled with **diagram outdoor** (`#DCE0D3`). It always carries the eyebrow "Schematic, not to scale". It has no dimension strings, no wall-thickness hatching, no per-concept colors, and no shadows, because it must never read as a measured plan.
- **Optional contact block.** Placed after the story. It is set in `heading` with `body-sm` copy, uses text inputs, and has a primary send button. Validation messages use **error** text plus an icon, never color alone. The block makes clear that Habitta is a fictional studio.
- **Simple view notice.** A brief paper-raised notice with a border-control outline, shown when the site switches to simple view. It is set in `body-sm` and dismissible. It is announced politely to assistive technology, as specified in #12.
- **Wordmark and favicon.** "Habitta" is set in Newsreader (`wordmark`) with no symbol. The favicon is a Newsreader "H" in ink on paper.
- **Placeholders.** Development placeholders for images and GLBs carry a visible "Placeholder" eyebrow and a diagonal hairline hatch, so they cannot be mistaken for concept visualizations.

## Scene atmosphere

These tokens are shared by the React Three Fiber scene and by the reference renders used in concept-visualization production ([research](docs/research/concept-visualization-production-workflow.md)). They cover color and atmosphere only. Geometry, the asset contract, and budgets live in [#20](https://github.com/danielluis07/habitta/issues/20), [#24](https://github.com/danielluis07/habitta/issues/24), and the [3D approach research](docs/research/3d-scene-and-asset-approach.md).

- **Sky:** a vertical gradient from **scene haze** (`#DAE2E1`) at the horizon to **scene sky zenith** (`#BCD0DA`), a cool, pale blue-grey. There is no saturated blue anywhere.
- **Haze:** distance fog in **scene haze**, the same colour as the sky at the horizon, so distant ground dissolves into the sky and layered ranges fade toward it. There are no clouds.
- **Landscape:** a Mediterranean highland that continues to the horizon: the district's slope climbs north to a ridge, and the valley opens south to a lake, with mountain ranges beyond. Open ground is muted sage (**scene terrain grass**, `#A5AE95`) in patches of dry grass (**scene terrain dry**, `#B4B094`) and scrub (**scene terrain scrub**, `#949D80`), with **scene terrain rock** (`#B8B1A3`) on steep and high ground. The lake is **scene lake** (`#9EB3B7`). Lanes and paths are **scene terrain lane** (`#CFC7B6`). Near ground is textured, dry grass, bare earth, rock and gravel, each map tinted to its terrain token so texture adds structure and never colour; lane kerbs are pale limestone over a darker gutter. The terrain may be gently stylized and is low-poly in the distance.
- **Buildings:** true material colors from the accepted briefs ([#11](https://github.com/danielluis07/habitta/issues/11)). Crest: oak, limestone, plaster, bronze. Contour: textured concrete, terrazzo, stone, timber. Grove: lime render, buff brick, clay, oak. The buildings stay architecturally plausible and are never stylized or re-tinted to match the UI.
- **Light:** warm daylight from the southeast reference sun (**scene sun**, `#FFF1DC`), late morning and about 40° high, consistent with every concept visualization. The scene grades with a neutral tone map, so warmth comes from the light and never from a tint over the buildings.
- **Reflections:** glass and metal reflect an environment map drawn from these same tokens: the sky, the ranges and the highland, without a sun disk. Devices that can afford it add the sun's shadow and soft ambient occlusion; the scene must read correctly without them ([#41](https://github.com/danielluis07/habitta/issues/41)).

The scene hex values may be tuned against reference renders. The fog and the sky at the horizon must stay one colour, **scene haze**.

## Motion

This section describes the visual character of motion only. When motion runs, and what happens when it is reduced, is defined in #7 and #12. With motion off, every change below is instant.

- **Camera fly-to** (selecting a building, returning to the district overview): 1.2–1.6s, ease-in-out, with no overshoot.
- **Panels and notices:** fade plus an 8px translate over about 200ms, ease-out. Exits are slightly faster.
- **Nothing moves on its own.** The camera fly-to is the district's only motion; a still view is a still image.
- **Never:** parallax, scroll-jacking, spring or bounce easing, or animated reveals of story text.

## Do's and Don'ts

**Do**

- Keep the scene's fog and sky horizon one colour, scene haze.
- Let the buildings, landscape, and concept visualizations supply all the color.
- Use the eyebrow for every "Imagined concept", "Concept visualization", and "Schematic, not to scale" disclosure.
- Use border control (3:1) for any interactive boundary; keep hairlines decorative.
- Give the narrow-viewport opening image its own art-directed crop that keeps the same design.
- Use the terms in `CONTEXT.md`: building overview, building index, simple view, district overview, featured residence, concept visualization.

**Don't**

- Add a dark theme, a chromatic accent, or per-building UI colors.
- Use shadows, backdrop blur, or translucent panels over the canvas.
- Use bold weights, a third typeface, or the serif at label sizes.
- Round images or use app-like large radii.
- Present imagery as photos, or borrow listing conventions (prices, "for sale", unit choosers).
- Draw the diagram like a measured plan.
- Call simple view "fallback mode" or "2D mode" in UI copy or code.
