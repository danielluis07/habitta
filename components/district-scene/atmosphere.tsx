"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackSide, Color, Float32BufferAttribute, SphereGeometry, type Mesh } from "three";
import { createCloudLayers, driftClouds } from "@/components/district-scene/clouds";

/** Scene atmosphere tokens from DESIGN.md, as CSS colors. */
export type AtmosphereColors = {
  fog: string;
  zenith: string;
  cloud: string;
  sun: string;
};

// Late-morning sun from the southeast (+X east, +Z south), about 40° high.
const sunPosition = [110, 130, 110] as const;
// Fog starts past the district and has swallowed the cloud deck by the far
// plane, so everything the far plane culls was already invisible.
const fogNear = 500;
const fogFar = 1800;
export const cameraFar = 2000;
const skyRadius = 1900;

// A dome of vertex colors: paper at and below the horizon, rising to the
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
    colors.push(...color.lerpColors(low, high, height ** 0.7).toArray());
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return geometry;
}

/**
 * The district's air: sky, fog, one sun and the cloud deck. The clouds drift
 * only while `motion` is on and the canvas is in view; otherwise nothing here
 * asks for frames, so a still camera means a still, unrendered scene.
 */
export function Atmosphere({ colors, motion }: { colors: AtmosphereColors; motion: boolean }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const sky = useRef<Mesh>(null);
  const [inView, setInView] = useState(true);
  const layers = useMemo(() => createCloudLayers(Math.min(4, gl.capabilities.getMaxAnisotropy())), [gl]);
  const skyGeometry = useMemo(() => createSky(colors.fog, colors.zenith), [colors.fog, colors.zenith]);
  const moving = motion && inView;

  useEffect(() => () => {
    for (const { texture } of layers) texture.dispose();
  }, [layers]);
  useEffect(() => () => skyGeometry.dispose(), [skyGeometry]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(gl.domElement);
    return () => observer.disconnect();
  }, [gl]);

  // Starting the drift needs one frame; after that each frame asks for the next.
  useEffect(() => {
    if (moving) invalidate();
  }, [invalidate, moving]);

  useFrame(({ camera }, delta) => {
    sky.current?.position.copy(camera.position);
    if (driftClouds(layers, delta, moving)) invalidate();
  });

  return (
    <>
      <fog attach="fog" args={[colors.fog, fogNear, fogFar]} />
      <hemisphereLight args={[colors.cloud, colors.fog, 1.2]} />
      <directionalLight color={colors.sun} position={sunPosition} intensity={2.6} />
      <mesh ref={sky} geometry={skyGeometry} renderOrder={-1} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={BackSide} fog={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {layers.map((layer, index) => (
        <mesh key={index} position-y={layer.height} rotation-x={-Math.PI / 2} renderOrder={index}>
          <circleGeometry args={[layer.radius, 64]} />
          <meshBasicMaterial
            color={colors.cloud}
            map={layer.texture}
            transparent={layer.opacity < 1}
            opacity={layer.opacity}
            depthWrite={layer.opacity === 1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}
