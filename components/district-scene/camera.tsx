"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useImperativeHandle, useLayoutEffect, useRef } from "react";
import { Vector2, Vector3, type Object3D, type PerspectiveCamera } from "three";
import type { SceneProps } from "@/components/district-scene";
import {
  buildingDirection, buildingFill, frame, framingPoints, framingRegion, lensShift, overviewDirection, overviewFill,
  overviewForeground,
} from "@/components/district-scene/framing";
import { selectedSlug } from "@/lib/journey";

type Flight = {
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
  fromShift: Vector2;
  toShift: Vector2;
  elapsed: number;
};

export function DistrictCamera({
  model, stage, savedViewpoint, motion, viewpointRef, clearance, onMotionFrame,
}: Pick<SceneProps, "stage" | "savedViewpoint" | "motion" | "viewpointRef" | "clearance"> & {
  model: Object3D;
  /** Times each frame of a flight that follows another, in seconds. */
  onMotionFrame: (seconds: number) => void;
}) {
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const { width, height } = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const target = useRef(new Vector3());
  const shift = useRef(new Vector2());
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

  const { top, right, bottom, left } = clearance;
  useLayoutEffect(() => {
    flight.current = null;
    if (!active || width <= 0 || height <= 0) return;

    // The buildings and their labels are framed into what the page's header,
    // arrival copy and building overview leave clear, above the overview's
    // foreground.
    const region = framingRegion({ width, height }, { top, right, bottom, left }, slug ? 0 : overviewForeground);
    const destination = !slug && savedViewpoint
      ? savedViewpoint
      : frame(framingPoints(model, slug), camera.fov, camera.aspect, slug ? buildingFill : overviewFill, region,
        slug ? buildingDirection : overviewDirection);
    const toPosition = new Vector3(...destination.position);
    const toTarget = new Vector3(...destination.target);
    const toShift = new Vector2(region.x, region.y);
    // A flight to where the camera already is would render frames of a still view.
    const arrived = camera.position.equals(toPosition) && target.current.equals(toTarget) &&
      shift.current.equals(toShift);
    if (!initialized.current || !motion || arrived) {
      camera.position.copy(toPosition);
      target.current.copy(toTarget);
      shift.current.copy(toShift);
      lensShift(camera, toShift.x, toShift.y);
      camera.lookAt(target.current);
      camera.updateMatrixWorld();
    } else {
      flight.current = {
        fromPosition: camera.position.clone(),
        fromTarget: target.current.clone(),
        toPosition,
        toTarget,
        fromShift: shift.current.clone(),
        toShift,
        elapsed: 0,
      };
    }
    initialized.current = true;
    invalidate();
  }, [active, camera, invalidate, model, motion, savedViewpoint, width, height, slug, top, right, bottom, left]);

  // Camera first, projected labels second, then R3F renders. Nothing requests
  // another frame once the 1.4-second ease-in-out has finished.
  useFrame((_, delta) => {
    const current = flight.current;
    if (!current) return;
    // A flight's first frame follows a still view, so its delta is idle time.
    if (current.elapsed > 0) onMotionFrame(delta);
    current.elapsed += Math.min(delta, 0.05);
    const progress = Math.min(current.elapsed / 1.4, 1);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased);
    target.current.lerpVectors(current.fromTarget, current.toTarget, eased);
    shift.current.lerpVectors(current.fromShift, current.toShift, eased);
    lensShift(camera, shift.current.x, shift.current.y);
    camera.lookAt(target.current);
    camera.updateMatrixWorld();
    if (progress === 1) flight.current = null;
    else invalidate();
  }, -2);

  return null;
}
