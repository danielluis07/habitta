import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  type Texture,
} from "three";

type CloudLayerStyle = {
  height: number;
  radius: number;
  /** Metres covered by one repeat of the texture. */
  tile: number;
  opacity: number;
  /** Drift in metres per second, east and south. */
  wind: [number, number];
  texture: (noise: Float32Array) => Uint8Array;
};

// Three non-volumetric layers below the occupied terraces. The opaque deck
// hides everything beneath the district; the higher two are translucent, and
// the wisps veil the low southern edge of the landscape.
const cloudLayers: CloudLayerStyle[] = [
  { height: -14, radius: 1800, tile: 520, opacity: 1, wind: [0.5, 0.15], texture: (noise) => shade(noise, 0.84, 0.95) },
  { height: -5, radius: 1600, tile: 380, opacity: 0.85, wind: [0.8, 0.25], texture: (noise) => cover(noise, 0.5, 0.18) },
  { height: 3, radius: 1100, tile: 260, opacity: 0.5, wind: [1.1, 0.35], texture: (noise) => cover(noise, 0.6, 0.14) },
];

const textureSize = 128;

function hash(x: number, y: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Fractal value noise in [0, 1] on a `size` × `size` grid. Every octave's
 * lattice wraps at the grid edge, so the result tiles without a seam.
 */
export function cloudNoise(size: number, seed: number, period = 4, octaves = 4) {
  const values = new Float32Array(size * size);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  let total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const cells = period << octave;
    const amplitude = 0.5 ** octave;
    total += amplitude;
    for (let py = 0; py < size; py++) {
      const v = py / size * cells;
      const y0 = Math.floor(v);
      const fy = smooth(v - y0);
      for (let px = 0; px < size; px++) {
        const u = px / size * cells;
        const x0 = Math.floor(u);
        const fx = smooth(u - x0);
        const corner = (dx: number, dy: number) => hash((x0 + dx) % cells, (y0 + dy) % cells, seed + octave);
        const top = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * fx;
        const bottom = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * fx;
        values[py * size + px] += (top + (bottom - top) * fy) * amplitude;
      }
    }
  }
  return values.map((value) => value / total);
}

/**
 * Opaque texels whose brightness varies gently between `low` and `high`. The
 * deck sits a shade darker than the lit layers above, so those read on it.
 */
function shade(noise: Float32Array, low: number, high: number) {
  const texels = new Uint8Array(noise.length * 4);
  noise.forEach((value, i) => {
    texels.fill(Math.round(255 * (low + (high - low) * value)), i * 4, i * 4 + 3);
    texels[i * 4 + 3] = 255;
  });
  return texels;
}

/** White texels, opaque where the noise rises above `threshold`. */
function cover(noise: Float32Array, threshold: number, softness: number) {
  const texels = new Uint8Array(noise.length * 4).fill(255);
  noise.forEach((value, i) => {
    const t = Math.min(Math.max((value - threshold + softness) / (2 * softness), 0), 1);
    texels[i * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t));
  });
  return texels;
}

export type CloudLayer = { texture: Texture; velocity: Vector2 };

/**
 * Advances the cloud drift by one frame. It moves nothing unless `moving`,
 * and returns whether it moved, which is when another frame is needed.
 */
export function driftClouds(layers: readonly CloudLayer[], delta: number, moving: boolean) {
  if (!moving) return false;
  // The first frame after a still spell reports the whole spell; don't jump.
  const step = Math.min(delta, 0.1);
  for (const { texture, velocity } of layers) {
    texture.offset.addScaledVector(velocity, step);
    // Whole repeats look identical, so the offset stays small in long sessions.
    texture.offset.set(texture.offset.x % 1, texture.offset.y % 1);
  }
  return true;
}

export function createCloudLayers(anisotropy: number) {
  return cloudLayers.map((style, index) => {
    const texture = new DataTexture(style.texture(cloudNoise(textureSize, 24 + index)), textureSize, textureSize);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = anisotropy;
    const repeats = 2 * style.radius / style.tile;
    texture.repeat.set(repeats, repeats);
    texture.needsUpdate = true;
    // The layers lie flat, so texture +u runs east and +v runs north.
    const velocity = new Vector2(-style.wind[0] / style.tile, style.wind[1] / style.tile);
    return { ...style, texture, velocity };
  });
}
