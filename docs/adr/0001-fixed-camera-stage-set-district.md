# Fixed camera, stage-set district

The district camera has no free orbit, zoom or rotation: the visitor sees only the district overview and each building's view, and moves between them by the camera flight that follows selection. This replaces the bounded orbit, zoom and Reset view planned in #22. We chose it so the landscape can be built like a stage set, with detail concentrated where the fixed views look and the rest left cheap, which is how the scene reaches architectural-render realism inside the mobile triangle budget.

## Considered Options

- **Bounded orbit and zoom (#22 as written):** the camera could reach ground only detailed enough for the fixed views, and drag and pinch gestures needed button alternatives for WCAG 2.5.7.
- **A small turn (about ±20°) without zoom:** kept most of the accessibility work for little exploratory value.

## Consequences

- Reset view is gone; closing a building overview already returns to the district overview and clears the selection.
- Any future free-camera feature must first raise the detail of everything the new views can reach.
