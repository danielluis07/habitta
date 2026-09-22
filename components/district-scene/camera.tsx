"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useImperativeHandle, useLayoutEffect, useRef } from "react";
import { Box3, MathUtils, Sphere, Vector3, type Object3D, type PerspectiveCamera } from "three";
import type { SceneProps } from "@/components/district-scene";
import { collection } from "@/lib/collection";
import { selectedSlug, type Viewpoint } from "@/lib/journey";

// Fit the exported geometry, including the space above its DOM label. This
// keeps framing valid when a canonical export replaces placeholder massing.
function frame(bounds: Box3, camera: PerspectiveCamera): Viewpoint {
  const sphere = bounds.getBoundingSphere(new Sphere());
  const verticalFov = MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const distance = sphere.radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.2;
  const position = new Vector3(0.65, 0.65, 1).normalize().multiplyScalar(distance).add(sphere.center);
  return { position: position.toArray(), target: sphere.center.toArray() };
}

type Flight = {
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
  elapsed: number;
};

export function DistrictCamera({
  model, stage, savedViewpoint, motion, viewpointRef,
}: Pick<SceneProps, "stage" | "savedViewpoint" | "motion" | "viewpointRef"> & { model: Object3D }) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const target = useRef(new Vector3());
  const flight = useRef<Flight | null>(null);
  const initialized = useRef(false);
  const slug = selectedSlug(stage);
  const active = stage.name !== "residence";

  useImperativeHandle(viewpointRef, () => ({
    getViewpoint: () => ({
      position: camera.position.toArray(),
      target: target.current.toArray(),
    }),
  }), [camera]);

  useLayoutEffect(() => {
    flight.current = null;
    if (!active || size.width <= 0 || size.height <= 0) return;

    model.updateWorldMatrix(true, true);
    const bounds = new Box3();
    for (const concept of collection) {
      if (slug && concept.slug !== slug) continue;
      const building = model.getObjectByName(concept.scene.selectionTarget)!;
      const anchor = model.getObjectByName(concept.scene.labelAnchor)!;
      bounds.union(new Box3().setFromObject(building));
      bounds.expandByPoint(anchor.getWorldPosition(new Vector3()).add(new Vector3(0, 8, 0)));
    }

    const destination = !slug && savedViewpoint ? savedViewpoint : frame(bounds, camera);
    const toPosition = new Vector3(...destination.position);
    const toTarget = new Vector3(...destination.target);
    // A flight to where the camera already is would render frames of a still view.
    const arrived = camera.position.equals(toPosition) && target.current.equals(toTarget);
    if (!initialized.current || !motion || arrived) {
      camera.position.copy(toPosition);
      target.current.copy(toTarget);
      camera.lookAt(target.current);
      camera.updateMatrixWorld();
    } else {
      flight.current = {
        fromPosition: camera.position.clone(),
        fromTarget: target.current.clone(),
        toPosition,
        toTarget,
        elapsed: 0,
      };
    }
    initialized.current = true;
    invalidate();
  }, [active, camera, invalidate, model, motion, savedViewpoint, size.width, size.height, slug]);

  // Camera first, projected labels second, then R3F renders. Nothing requests
  // another frame once the 1.4-second ease-in-out has finished.
  useFrame((_, delta) => {
    const current = flight.current;
    if (!current) return;
    current.elapsed += Math.min(delta, 0.05);
    const progress = Math.min(current.elapsed / 1.4, 1);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased);
    target.current.lerpVectors(current.fromTarget, current.toTarget, eased);
    camera.lookAt(target.current);
    camera.updateMatrixWorld();
    if (progress === 1) flight.current = null;
    else invalidate();
  }, -2);

  return null;
}
