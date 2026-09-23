declare module "n8ao" {
  import type { Camera, Color, Scene } from "three";
  import { Pass } from "three/addons/postprocessing/Pass.js";

  export type N8AOConfiguration = {
    aoSamples: number;
    aoRadius: number;
    denoiseSamples: number;
    denoiseRadius: number;
    distanceFalloff: number;
    intensity: number;
    denoiseIterations: number;
    color: Color;
    gammaCorrection: boolean;
    screenSpaceRadius: boolean;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
    autoRenderBeauty: boolean;
    colorMultiply: boolean;
    transparencyAware: boolean;
    accumulate: boolean;
  };

  /** N8AO for three.js's own EffectComposer. It renders the scene itself. */
  export class N8AOPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: N8AOConfiguration;
    setQualityMode(mode: "Performance" | "Low" | "Medium" | "High" | "Ultra"): void;
  }
}
