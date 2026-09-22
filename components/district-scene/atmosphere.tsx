"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, Color, Float32BufferAttribute, SphereGeometry, type Mesh } from "three";

/** Scene atmosphere tokens from DESIGN.md, as CSS colors. */
export type AtmosphereColors = {
  haze: string;
  zenith: string;
  sun: string;
  ground: string;
};

// Late-morning sun from the southeast (+X east, +Z south), about 40° high.
const sunPosition = [110, 130, 110] as const;
// The haze thickens from just past the buildings and is complete by the far
// plane, so everything the far plane culls was already invisible. The
// landscape runs on well past that from any camera position.
const fogNear = 150;
export const fogFar = 1900;
export const cameraFar = 2100;
const skyRadius = 1900;

// A dome of vertex colors: haze at and below the horizon, rising to the
// zenith blue. It follows the camera, so the horizon is right from any view.
function createSky(horizon: string, zenith: string) {
  const geometry = new SphereGeometry(skyRadius, 32, 16);
  const low = new Color(horizon);
  const high = new Color(zenith);
  const color = new Color();
  const position = geometry.getAttribute("position");
  const colors: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const height = Math.max(position.getY(i) / skyRadius, 0);
    colors.push(...color.lerpColors(low, high, height ** 0.6).toArray());
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The district's air: sky, haze and one sun. Nothing here moves or asks for
 * frames; the sky only keeps up with frames rendered for other reasons.
 */
export function Atmosphere({ colors }: { colors: AtmosphereColors }) {
  const sky = useRef<Mesh>(null);
  const skyGeometry = useMemo(() => createSky(colors.haze, colors.zenith), [colors.haze, colors.zenith]);

  useEffect(() => () => skyGeometry.dispose(), [skyGeometry]);

  useFrame(({ camera }) => {
    sky.current?.position.copy(camera.position);
  });

  return (
    <>
      <fog attach="fog" args={[colors.haze, fogNear, fogFar]} />
      <hemisphereLight args={[colors.haze, colors.ground, 1.3]} />
      <directionalLight color={colors.sun} position={sunPosition} intensity={2.6} />
      <mesh ref={sky} geometry={skyGeometry} renderOrder={-1} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={BackSide} fog={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}
