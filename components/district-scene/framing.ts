import { Box3, MathUtils, Vector3, type Object3D } from "three";
import { collection, type ConceptSlug } from "@/lib/collection";
import type { Viewpoint } from "@/lib/journey";

// The camera looks northwest from above the valley side, low enough that the
// ridge and the hazy horizon close the view behind the buildings.
const viewDirection = new Vector3(0.65, 0.38, 1).normalize();
// Share of the view the framed points may fill: the overview lets the three
// buildings dominate; a selected building keeps some district around it.
export const overviewFill = 0.85;
export const buildingFill = 0.6;

/**
 * Frames the points so their projection fills `fill` of the view, centred.
 * The points come from the exported geometry, including the space above its
 * DOM label, so framing stays valid when a canonical export replaces
 * placeholder massing.
 */
export function frame(points: Vector3[], fov: number, aspect: number, fill: number): Viewpoint {
  const forward = viewDirection.clone().negate();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
  const up = new Vector3().crossVectors(right, forward);
  const tanV = Math.tan(MathUtils.degToRad(fov) / 2) * fill;
  const tanH = tanV * aspect;
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
  const position = viewDirection.clone().multiplyScalar(distance).add(target);
  return { position: position.toArray(), target: target.toArray() };
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
