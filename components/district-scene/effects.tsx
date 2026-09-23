"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { N8AOPass } from "n8ao";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Pass } from "three/addons/postprocessing/Pass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import type { TierSettings } from "@/components/district-scene/quality";

// N8AOPass has no dispose of its own; its render targets, materials and
// quads each have one.
function disposePass(pass: Pass) {
  if (!(pass instanceof N8AOPass)) return pass.dispose();
  for (const value of Object.values(pass)) {
    if (typeof value?.dispose === "function") value.dispose();
  }
}

/**
 * The high tier's post-processing: N8AO draws the scene with subtle ambient
 * occlusion, SMAA smooths its edges, and the output pass applies the
 * renderer's tone mapping and colour space, as a direct render would.
 */
function PostProcessing() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const { width, height } = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const composer = useMemo(() => {
    const composer = new EffectComposer(gl);
    const occlusion = new N8AOPass(scene, camera);
    occlusion.setQualityMode("Medium");
    // Metres, at building scale: darkens reveals, loggias, eaves and where
    // walls meet the ground, softly, on top of the baked occlusion.
    Object.assign(occlusion.configuration, {
      aoRadius: 2.5,
      distanceFalloff: 1,
      intensity: 2,
      halfRes: true,
      gammaCorrection: false,
    });
    composer.addPass(occlusion);
    composer.addPass(new SMAAPass());
    composer.addPass(new OutputPass());
    return composer;
  }, [gl, scene, camera]);

  useEffect(() => () => {
    for (const pass of composer.passes) disposePass(pass);
    composer.dispose();
  }, [composer]);

  useLayoutEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(width, height);
  }, [composer, dpr, width, height]);

  // A positive priority takes over rendering from R3F.
  useFrame(() => composer.render(), 1);

  return null;
}

/** The tier's runtime effects. A tier change redraws the unchanged view, as its first frame. */
export function QualityEffects({ settings }: { settings: TierSettings }) {
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => invalidate(), [invalidate, settings]);
  return settings.postProcessing ? <PostProcessing /> : null;
}
