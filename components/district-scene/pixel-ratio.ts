/**
 * The highest drawing-buffer pixel ratio for this device class: 1.5 on a
 * capable desktop (a fine hovering pointer and a desktop-width viewport),
 * 1.0 on phones, tablets and everything else. High-DPI screens otherwise
 * multiply the pixels the GPU fills for every frame.
 */
export function pixelRatioCap(matches: (query: string) => boolean = (query) => window.matchMedia(query).matches) {
  return matches("(hover: hover) and (pointer: fine)") && matches("(min-width: 768px)") ? 1.5 : 1;
}
