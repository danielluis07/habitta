/**
 * The district's rendering quality tiers, how one is chosen, and when it steps
 * down. Quality comes mainly from the assets and their baked light; a tier
 * only adds runtime effects on top, and none of them is required.
 */
export type QualityTier = "base" | "high";

export const environmentMaps = {
  /** 512 × 256 px, part of the opening transfer on every tier. */
  base: "/environments/highland-512.hdr",
  /** 1,024 × 512 px, the high tier's upgrade, fetched after the scene opens. */
  high: "/environments/highland-1024.hdr",
} as const;

/** What the high tier alone fetches, after the scene has opened. */
export const desktopPack: readonly string[] = [environmentMaps.high];

export type TierSettings = {
  /** The drawing buffer's pixel ratio: the device's, clamped to at most this. */
  maxPixelRatio: number;
  /** One shadow map for the sun. */
  shadows: boolean;
  /** Subtle screen-space ambient occlusion (N8AO) and SMAA, in place of the canvas's MSAA. */
  postProcessing: boolean;
  /** The environment map glass and metal reflect. The base map stays until this one has loaded. */
  environmentMap: string;
};

export const qualityTiers: Record<QualityTier, TierSettings> = {
  base: { maxPixelRatio: 1, shadows: false, postProcessing: false, environmentMap: environmentMaps.base },
  high: { maxPixelRatio: 2, shadows: true, postProcessing: true, environmentMap: environmentMaps.high },
};

export const tierSelection = {
  /** The narrowest viewport a desktop has, in CSS pixels. */
  desktopWidth: 768,
  /** Fewer logical cores than this marks a low-end machine. */
  minCores: 4,
  /** GPU-less renderers draw every pixel on the CPU. */
  softwareRenderer: /swiftshader|llvmpipe|softpipe|software|basic render/i,
};

export const stepDown = {
  /** The high tier steps down when the median frame rate of its motion stays below this… */
  minFrameRate: 45,
  /** …for this many seconds of motion… */
  window: 2,
  /** …over at least this many frames, so one long hitch alone never counts. */
  minFrames: 10,
};

/** What the page can tell about the device before and after the renderer starts. */
export type Device = {
  /** A fine, hovering pointer and a desktop-width viewport. */
  desktop: boolean;
  cores?: number;
  /** The browser asks sites to save data. */
  saveData?: boolean;
  /** The renderer's GPU, once the WebGL context exists. */
  renderer?: string;
  /** `?quality=base` or `?quality=high` forces a tier, for manual testing. */
  requested?: QualityTier;
};

export function initialTier(device: Device): QualityTier {
  if (device.requested) return device.requested;
  const capable = device.desktop &&
    (device.cores ?? tierSelection.minCores) >= tierSelection.minCores &&
    !device.saveData &&
    !tierSelection.softwareRenderer.test(device.renderer ?? "");
  return capable ? "high" : "base";
}

/** The tier to step down to, or nothing below the base tier. */
export function lowerTier(tier: QualityTier): QualityTier | undefined {
  return tier === "high" ? "base" : undefined;
}

type Browser = Pick<Window, "matchMedia" | "location"> & {
  navigator: Pick<Navigator, "hardwareConcurrency"> & { connection?: { saveData?: boolean } };
};

export function readDevice(browser: Browser = window): Device {
  const matches = (query: string) => browser.matchMedia(query).matches;
  const requested = new URLSearchParams(browser.location.search).get("quality");
  return {
    desktop: matches("(hover: hover) and (pointer: fine)") && matches(`(min-width: ${tierSelection.desktopWidth}px)`),
    cores: browser.navigator.hardwareConcurrency || undefined,
    saveData: browser.navigator.connection?.saveData,
    requested: requested === "base" || requested === "high" ? requested : undefined,
  };
}

/** The GPU behind a WebGL context, unmasked where the browser only names itself. */
export function rendererName(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  const renderer = String(gl.getParameter(gl.RENDERER));
  if (!/^webkit webgl$/i.test(renderer)) return renderer;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : renderer;
}

/**
 * Watches the frame rate of continuous motion. The scene renders on demand,
 * so only frames that follow one another, as in a camera flight, are timed.
 */
export class FrameRateMonitor {
  private frames: number[] = [];
  private duration = 0;
  private gap = false;

  constructor(private readonly limits = stepDown) {}

  /** Times one frame, in seconds. True once the frame rate has stayed low for a whole window of motion. */
  sample(seconds: number) {
    if (this.gap || !(seconds > 0)) {
      this.gap = false;
      return false;
    }
    this.frames.push(seconds);
    this.duration += seconds;
    const { window: span, minFrames } = this.limits;
    while (this.frames.length > minFrames && this.duration - this.frames[0] >= span) this.duration -= this.frames.shift()!;
    if (this.duration < span || this.frames.length < minFrames) return false;
    // The median, so a single hitch, such as a shader compiling, isn't a slow device.
    const sorted = [...this.frames].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] > 1 / this.limits.minFrameRate;
  }

  /** The next frame follows a pause, such as a hidden tab, and isn't timed. */
  pause() {
    this.gap = true;
  }

  reset() {
    this.frames = [];
    this.duration = 0;
    this.gap = false;
  }
}
