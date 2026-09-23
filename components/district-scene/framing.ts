import { Box3, MathUtils, Vector3, type Object3D, type PerspectiveCamera } from "three";
import { collection, type ConceptSlug } from "@/lib/collection";
import type { Viewpoint } from "@/lib/journey";

// The camera looks northwest from above the valley side, low enough that the
// ridge and the hazy horizon close the view behind the buildings. The
// overview looks a little lower, about 12° down, so sky and hazy ranges rise
// behind the arrival copy rather than treed ground.
export const buildingDirection = new Vector3(0.65, 0.38, 1).normalize();
export const overviewDirection = new Vector3(0.65, 0.25, 1).normalize();
// Share of the view the framed points may fill: the overview lets the three
// buildings dominate; a selected building keeps some district around it.
export const overviewFill = 0.85;
export const buildingFill = 0.6;

/** How far the page's own layers cover each edge of the canvas, in CSS pixels. */
export type Clearance = { top: number; right: number; bottom: number; left: number };

/**
 * The part of the view the page leaves clear: its centre in normalized device
 * coordinates, and its size as a share of the whole view on each axis.
 */
export type ViewRegion = { x: number; y: number; width: number; height: number };

export const wholeView: ViewRegion = { x: 0, y: 0, width: 1, height: 1 };

// However much the page covers, the buildings keep at least this share of each axis.
const minShare = 0.25;

export function clearRegion(size: { width: number; height: number }, clearance: Clearance): ViewRegion {
  if (size.width <= 0 || size.height <= 0) return wholeView;
  // `start` is the edge at -1: left on x, bottom on y.
  const axis = (start: number, end: number, length: number) => {
    const share = Math.max(1 - (start + end) / length, minShare);
    const centre = MathUtils.clamp((start - end) / length, share - 1, 1 - share);
    return [centre, share] as const;
  };
  const [x, width] = axis(clearance.left, clearance.right, size.width);
  const [y, height] = axis(clearance.bottom, clearance.top, size.height);
  return { x, y, width, height };
}

/**
 * Frames the points so their projection fills `fill` of the view, centred.
 * The points come from the exported geometry, including the space above its
 * DOM label, so framing stays valid when a canonical export replaces
 * placeholder massing.
 *
 * With a `region`, the points fill `fill` of that region instead. The camera
 * keeps the same heading and pitch, and a lens shift (`lensShift`) moves the
 * framed points into the region, the way a shift lens keeps an architectural
 * view's verticals upright.
 */
export function frame(
  points: Vector3[],
  fov: number,
  aspect: number,
  fill: number,
  region: ViewRegion = wholeView,
  direction: Vector3 = buildingDirection,
): Viewpoint {
  const forward = direction.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  const tan = Math.tan(MathUtils.degToRad(fov) / 2) * fill;
  const tanV = tan * region.height;
  const tanH = tan * aspect * region.width;
  const target = new Box3().setFromPoints(points).getCenter(new Vector3());
  const offset = new Vector3();
  let distance = 0;
  // Fit around the target, then recentre on what that fit shows, and refit.
  for (let pass = 0; pass < 3; pass++) {
    distance = 0;
    for (const point of points) {
      offset.subVectors(point, target);
      const fit = Math.max(Math.abs(offset.dot(right)) / tanH, Math.abs(offset.dot(up)) / tanV) - offset.dot(forward);
      distance = Math.max(distance, fit);
    }
    if (pass === 2) break;
    const extent = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
    for (const point of points) {
      offset.subVectors(point, target);
      const depth = distance + offset.dot(forward);
      const [x, y] = [offset.dot(right) / depth, offset.dot(up) / depth];
      Object.assign(extent, {
        left: Math.min(extent.left, x), right: Math.max(extent.right, x),
        bottom: Math.min(extent.bottom, y), top: Math.max(extent.top, y),
      });
    }
    target.addScaledVector(right, (extent.left + extent.right) / 2 * distance)
      .addScaledVector(up, (extent.bottom + extent.top) / 2 * distance);
  }
  const position = direction.clone().multiplyScalar(distance).add(target);
  return { position: position.toArray(), target: target.toArray() };
}

// Scene labels hang above their anchors: a 44px button and a little air. The
// world-space room framingPoints leaves above each label shrinks with
// distance, so framing also keeps this much of the view's top clear.
export const labelRoom = 52;

/** The region the buildings are framed into: clear of the page, with room for their labels. */
export function framingRegion(size: { width: number; height: number }, clearance: Clearance) {
  return clearRegion(size, { ...clearance, top: clearance.top + labelRoom });
}

/** Shifts the camera's lens so its axis lands on the region's centre. */
export function lensShift(camera: PerspectiveCamera, x: number, y: number) {
  // The offset is a share of the view, in a full view sized to the camera's
  // aspect, which setViewOffset writes back to the camera.
  const { aspect } = camera;
  camera.setViewOffset(aspect, 1, -x / 2 * aspect, y / 2, aspect, 1);
}

/** The corners of each framed building's bounds, and the space above its label. */
export function framingPoints(model: Object3D, slug: ConceptSlug | undefined) {
  model.updateWorldMatrix(true, true);
  return collection.filter((concept) => !slug || concept.slug === slug).flatMap(({ scene }) => {
    const box = new Box3().setFromObject(model.getObjectByName(scene.selectionTarget)!);
    const anchor = model.getObjectByName(scene.labelAnchor)!;
    return [
      anchor.getWorldPosition(new Vector3()).add(new Vector3(0, 8, 0)),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => new Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      )),
    ];
  });
}
