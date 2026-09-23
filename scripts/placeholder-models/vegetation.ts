import sharp from "sharp";
import { download, unzip, type SourceFile } from "@/scripts/cc0";
import { bake, Geometry, normalize, type MeshData, type vec3 } from "@/scripts/placeholder-models/geometry";
import { linear } from "@/scripts/placeholder-models/gltf";
import { seeded, smoothstep } from "@/scripts/placeholder-models/noise";
import { groundPlane, limb, merge, propShading } from "@/scripts/placeholder-models/props";

// The highland's olives, cypresses and scrub. Their branches are geometry,
// so trunks and limbs keep real silhouettes; their foliage is leaf cards,
// alpha-tested quads over one atlas of leafy sprays composited from CC0
// leaf photographs. Near versions stand in the district and the overview's
// foreground; lighter ones, a few crossed cards each, stand beyond.

type LeafSource = {
  asset: string;
  page: string;
  authors: string[];
  licence: "CC0 1.0";
  /** The 1K PNG archive, with the MD5 it had when reviewed. */
  archive: SourceFile;
  /** Which way the photographed leaves point, from stalk to tip. */
  axis: "up" | "right";
};

const ambientCG = (asset: string, md5: string, axis: LeafSource["axis"]): LeafSource => ({
  asset, page: `https://ambientcg.com/a/${asset}`, authors: ["ambientCG"], licence: "CC0 1.0",
  archive: { url: `https://ambientcg.com/get?file=${asset}_1K-PNG.zip`, md5 }, axis,
});

/** Every leaf photograph's source, author and licence. All are CC0, from ambientCG. */
export const leafSources = {
  /** Narrow, lance-shaped leaves: the olive's. */
  olive: ambientCG("LeafSet013", "a781c521d6c2cbfc3b0eb2413c10f727", "up"),
  /** Flat sprays of scale leaves: the cypress family's. */
  cypress: ambientCG("LeafSet019", "4ada66d9293c4932606e1432e9d54030", "right"),
  /** Small oval leaves, like the lentisk and myrtle of the maquis. */
  scrub: ambientCG("LeafSet022", "b4554c9ca3a8d20a06424565e23c95ee", "up"),
} satisfies Record<string, LeafSource>;

/** The foliage atlas, in pixels; each region holds one kind of card. */
export const atlasSize = 512;
type Region = readonly [x: number, y: number, width: number, height: number];
export const atlasRegions = {
  /** A round spray of olive twigs, for the near olive's canopy. */
  olive: [0, 0, 256, 256],
  /** A dome of scrub, standing on its lower edge. */
  scrub: [256, 0, 256, 256],
  /** Upright cypress sprays, a section of the column. */
  cypress: [0, 256, 128, 256],
  /** A whole cypress, for the far one. */
  cypressFar: [128, 256, 64, 256],
  /** A whole olive, trunk and crown, for the far one. */
  oliveFar: [192, 256, 256, 192],
  /** Opaque and white: trunks and limbs take their colour from their vertices. */
  bark: [448, 256, 64, 64],
} as const satisfies Record<string, Region>;

/** Each kind's foliage tone (sRGB), about which its leaves vary. */
const tones = {
  olive: { upper: "#86916F", under: "#BCC2AB", undersides: 0.4 },
  cypress: { upper: "#63724F" },
  scrub: { upper: "#84905F" },
};
const bark = linear("#6F6252");

// ---------------------------------------------------------------------------
// The atlas

/** A leaf photograph cut out of its set: premultiplied linear RGBA, with its stalk and tip. */
type Sprite = { width: number; height: number; data: Float32Array; base: [number, number]; tip: [number, number]; mean: vec3; light: number };

const toLinear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSRGB = (value: number) => Math.round(255 * Math.min(Math.max(value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055, 0), 1));
const luminance = (c: ArrayLike<number>) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The whole leaves of a set, each one connected shape of its opacity map that doesn't touch the edge. */
async function leaves(source: LeafSource): Promise<Sprite[]> {
  const archive = await download(source.archive);
  const color = unzip(archive, `${source.asset}_1K-PNG_Color.png`);
  const opacity = unzip(archive, `${source.asset}_1K-PNG_Opacity.png`);
  const { width: fullWidth = 0, height: fullHeight = 0 } = await sharp(color).metadata();
  // Halved: the atlas draws leaves far smaller than the photographs.
  const [width, height] = [fullWidth / 2, fullHeight / 2];
  const rgb = await sharp(color).removeAlpha().resize(width, height).raw().toBuffer();
  const alpha = await sharp(opacity).removeAlpha().extractChannel(0).resize(width, height).raw().toBuffer();
  const label = new Int32Array(width * height).fill(-1);
  const shapes: { pixels: number[]; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let start = 0; start < width * height; start++) {
    if (alpha[start] < 128 || label[start] >= 0) continue;
    const shape = { pixels: [start], x0: width, y0: height, x1: 0, y1: 0 };
    label[start] = shapes.length;
    for (let k = 0; k < shape.pixels.length; k++) {
      const p = shape.pixels[k];
      const [x, y] = [p % width, Math.floor(p / width)];
      [shape.x0, shape.y0, shape.x1, shape.y1] = [Math.min(shape.x0, x), Math.min(shape.y0, y), Math.max(shape.x1, x), Math.max(shape.y1, y)];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [nx, ny] = [x + dx, y + dy];
        const q = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || alpha[q] < 128 || label[q] >= 0) continue;
        label[q] = shapes.length;
        shape.pixels.push(q);
      }
    }
    shapes.push(shape);
  }
  const largest = Math.max(...shapes.map(({ pixels }) => pixels.length));
  return shapes.flatMap((shape, id) => {
    if (shape.pixels.length < largest * 0.2 || shape.x0 === 0 || shape.y0 === 0 || shape.x1 === width - 1 || shape.y1 === height - 1) return [];
    const pad = 2;
    const [x0, y0] = [shape.x0 - pad, shape.y0 - pad];
    const [w, h] = [shape.x1 - shape.x0 + 1 + pad * 2, shape.y1 - shape.y0 + 1 + pad * 2];
    const data = new Float32Array(w * h * 4);
    const mean: vec3 = [0, 0, 0];
    let total = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [sx, sy] = [x0 + x, y0 + y];
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const s = sy * width + sx;
      // Soft edges belong to whichever leaf they border; other leaves' pixels are cut away.
      if (label[s] >= 0 && label[s] !== id) continue;
      const a = alpha[s] / 255;
      for (let c = 0; c < 3; c++) {
        const value = toLinear(rgb[s * 3 + c] / 255);
        data[(y * w + x) * 4 + c] = value * a;
        mean[c] += value * a;
      }
      data[(y * w + x) * 4 + 3] = a;
      total += a;
    }
    const average = mean.map((value) => value / total) as vec3;
    const [cx, cy] = [(shape.x0 + shape.x1) / 2 - x0, (shape.y0 + shape.y1) / 2 - y0];
    const ends: [[number, number], [number, number]] = source.axis === "up"
      ? [[cx, shape.y1 - y0], [cx, shape.y0 - y0]]
      : [[shape.x0 - x0, cy], [shape.x1 - x0, cy]];
    return [{ width: w, height: h, data, base: ends[0], tip: ends[1], mean: average, light: luminance(average) }];
  });
}

/** A premultiplied linear RGBA canvas, drawn at four times the atlas's resolution. */
class Canvas {
  data: Float32Array;
  constructor(readonly width: number, readonly height: number) {
    this.data = new Float32Array(width * height * 4);
  }

  private over(index: number, r: number, g: number, b: number, a: number) {
    const keep = 1 - a;
    const d = this.data;
    d[index] = r + d[index] * keep;
    d[index + 1] = g + d[index + 1] * keep;
    d[index + 2] = b + d[index + 2] * keep;
    d[index + 3] = a + d[index + 3] * keep;
  }

  /**
   * Draws a leaf with its stalk at `at`, pointing `angle` radians clockwise
   * from up, `length` pixels from stalk to tip. Its colour is tinted to
   * `tone`: the photograph keeps its light and shade and a little of its hue.
   */
  leaf(sprite: Sprite, at: [number, number], angle: number, length: number, tone: vec3, { width = 1, mirror = false, contrast = 1, chroma = 0.35 } = {}) {
    const [ax, ay] = [sprite.tip[0] - sprite.base[0], sprite.tip[1] - sprite.base[1]];
    const spriteLength = Math.hypot(ax, ay);
    const [sx, sy] = [ax / spriteLength, ay / spriteLength];
    const [px, py] = [-sy, sx];
    const k = length / spriteLength;
    const [cx, cy] = [Math.sin(angle), -Math.cos(angle)];
    const [qx, qy] = [-cy, cx];
    // The sprite's corners on the canvas bound the pixels to visit.
    const corners = [[0, 0], [sprite.width, 0], [0, sprite.height], [sprite.width, sprite.height]].map(([x, y]) => {
      const [dx, dy] = [x - sprite.base[0], y - sprite.base[1]];
      const [along, across] = [dx * sx + dy * sy, (dx * px + dy * py) * (mirror ? -1 : 1) * width];
      return [at[0] + (cx * along + qx * across) * k, at[1] + (cy * along + qy * across) * k];
    });
    const [x0, x1] = [Math.max(Math.floor(Math.min(...corners.map(([x]) => x))), 0), Math.min(Math.ceil(Math.max(...corners.map(([x]) => x))), this.width - 1)];
    const [y0, y1] = [Math.max(Math.floor(Math.min(...corners.map(([, y]) => y))), 0), Math.min(Math.ceil(Math.max(...corners.map(([, y]) => y))), this.height - 1)];
    const texel = [0, 0, 0, 0];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const [dx, dy] = [(x + 0.5 - at[0]) / k, (y + 0.5 - at[1]) / k];
      const along = dx * cx + dy * cy;
      const across = (dx * qx + dy * qy) / width * (mirror ? -1 : 1);
      if (!sampleSprite(sprite, sprite.base[0] + sx * along + px * across, sprite.base[1] + sy * along + py * across, texel) || texel[3] < 0.004) continue;
      const a = texel[3];
      const color = [texel[0] / a, texel[1] / a, texel[2] / a];
      const relative = luminance(color) / sprite.light;
      const tinted = [0, 1, 2].map((c) => tone[c] * relative ** contrast * Math.max(color[c] / sprite.mean[c] / relative, 0) ** chroma);
      this.over((y * this.width + x) * 4, tinted[0] * a, tinted[1] * a, tinted[2] * a, a);
    }
  }

  /** A tapering twig from `from` to `to`, antialiased. */
  twig(from: [number, number], to: [number, number], [r0, r1]: [number, number], color: vec3) {
    const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
    const length2 = dx * dx + dy * dy || 1;
    const r = Math.max(r0, r1) + 1;
    for (let y = Math.max(Math.floor(Math.min(from[1], to[1]) - r), 0); y <= Math.min(Math.ceil(Math.max(from[1], to[1]) + r), this.height - 1); y++) {
      for (let x = Math.max(Math.floor(Math.min(from[0], to[0]) - r), 0); x <= Math.min(Math.ceil(Math.max(from[0], to[0]) + r), this.width - 1); x++) {
        const t = Math.min(Math.max(((x + 0.5 - from[0]) * dx + (y + 0.5 - from[1]) * dy) / length2, 0), 1);
        const distance = Math.hypot(x + 0.5 - from[0] - dx * t, y + 0.5 - from[1] - dy * t);
        const a = Math.min(Math.max(r0 + (r1 - r0) * t - distance + 0.5, 0), 1);
        if (a > 0) this.over((y * this.width + x) * 4, color[0] * a, color[1] * a, color[2] * a, a);
      }
    }
  }

  /** This canvas as a sprite, standing on its lower edge, to draw into another. */
  sprite(): Sprite {
    return { width: this.width, height: this.height, data: this.data, base: [this.width / 2, this.height], tip: [this.width / 2, 0], mean: [1, 1, 1], light: 1 };
  }
}

function sampleSprite(sprite: Sprite, x: number, y: number, out: number[]) {
  const [fx0, fy0] = [x - 0.5, y - 0.5];
  const [x0, y0] = [Math.floor(fx0), Math.floor(fy0)];
  if (x0 < -1 || y0 < -1 || x0 >= sprite.width || y0 >= sprite.height) return false;
  const [fx, fy] = [fx0 - x0, fy0 - y0];
  out.fill(0);
  for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const [sx, sy] = [x0 + dx, y0 + dy];
    if (sx < 0 || sy < 0 || sx >= sprite.width || sy >= sprite.height) continue;
    const i = (sy * sprite.width + sx) * 4;
    for (let c = 0; c < 4; c++) out[c] += sprite.data[i + c] * w;
  }
  return true;
}

/** A step along a gently curving twig. */
function* along(from: [number, number], angle: number, length: number, steps: number, bend: number, next: () => number) {
  let [x, y] = from;
  for (let i = 0; i < steps; i++) {
    angle += (next() - 0.5) * bend;
    const [nx, ny] = [x + Math.sin(angle) * length / steps, y - Math.cos(angle) * length / steps];
    yield { from: [x, y] as [number, number], to: [nx, ny] as [number, number], angle, t: (i + 1) / steps };
    [x, y] = [nx, ny];
  }
}

/** A tone made a little lighter or darker, never another hue. */
const jitter = (tone: vec3, next: () => number, range = 0.28) => {
  const light = 1 - range / 2 + next() * range;
  return tone.map((value) => value * light) as vec3;
};

/** A round spray of olive twigs, radiating from the card's centre, leaves in pairs. */
function oliveSpray(sprites: Sprite[], size: number, seed: number) {
  const canvas = new Canvas(size, size);
  const next = seeded(seed);
  const [upper, under] = [linear(tones.olive.upper), linear(tones.olive.under)];
  const center: [number, number] = [size / 2, size / 2];
  const leafTone = () => jitter(next() < tones.olive.undersides ? under : upper, next);
  const pending: (() => void)[] = [];
  const branch = (start: [number, number], angle: number, length: number, width: number, depth: number) => {
    for (const { from, to, angle: heading, t } of along(start, angle, length, 7, 0.35, next)) {
      canvas.twig(from, to, [width * (1 - t * 0.6), width * (1 - (t + 1 / 7) * 0.6)], bark);
      for (const side of [-1, 1]) {
        const spread = side * (0.45 + next() * 0.45);
        pending.push(() => canvas.leaf(sprites[Math.floor(next() * sprites.length)], to, heading + spread, size * (0.085 + next() * 0.03), leafTone(),
          { width: 1.15 + next() * 0.3, mirror: next() < 0.5, chroma: 0.06 }));
      }
      if (depth === 0 && t > 0.3 && t < 0.7 && next() < 0.5) branch(to, heading + (next() < 0.5 ? -1 : 1) * (0.5 + next() * 0.4), length * 0.45, width * 0.6, 1);
    }
  };
  const twigs = 8;
  for (let i = 0; i < twigs; i++) branch(center, (i + next() * 0.6) / twigs * Math.PI * 2, size * (0.27 + next() * 0.08), size * 0.006, 0);
  // Leaves fill the heart of the spray, so it thins only at its edge.
  for (let i = 0; i < 70; i++) {
    const [r, a] = [Math.sqrt(next()) * size * 0.24, next() * Math.PI * 2];
    pending.push(() => canvas.leaf(sprites[Math.floor(next() * sprites.length)], [center[0] + Math.sin(a) * r, center[1] - Math.cos(a) * r], next() * Math.PI * 2,
      size * (0.08 + next() * 0.03), leafTone(), { width: 1.15 + next() * 0.3, mirror: next() < 0.5, chroma: 0.06 }));
  }
  for (const draw of pending.sort(() => next() - 0.5)) draw();
  return canvas;
}

/** A dome of scrub: twigs fanning up from its foot, dense with small leaves. */
function scrubDome(sprites: Sprite[], size: number, seed: number) {
  const canvas = new Canvas(size, size);
  const next = seeded(seed);
  const tone = linear(tones.scrub.upper);
  const foot: [number, number] = [size / 2, size * 0.98];
  const pending: (() => void)[] = [];
  const twigs = 11;
  for (let i = 0; i < twigs; i++) {
    const lean = (i / (twigs - 1) - 0.5) * 2.1 + (next() - 0.5) * 0.2;
    // Shorter toward the sides, so the ends of the twigs trace a dome.
    const length = size * (0.5 + next() * 0.08) * (0.55 + 0.45 * Math.cos(lean * 0.6));
    for (const { from, to, angle, t } of along([foot[0] + (next() - 0.5) * size * 0.08, foot[1]], lean, length, 8, 0.3, next)) {
      canvas.twig(from, to, [size * 0.007 * (1.2 - t), size * 0.007 * (1.1 - t)], bark);
      if (t < 0.25) continue;
      for (let k = 0; k < 4; k++) {
        pending.push(() => canvas.leaf(sprites[Math.floor(next() * sprites.length)], to, angle + (next() - 0.5) * 2.4, size * (0.07 + next() * 0.025),
          jitter(tone, next, 0.35), { mirror: next() < 0.5 }));
      }
    }
  }
  for (let i = 0; i < 340; i++) {
    const [x, h] = [next() * 2 - 1, next()];
    const top = Math.sqrt(Math.max(1 - x * x, 0));
    pending.push(() => canvas.leaf(sprites[Math.floor(next() * sprites.length)], [size / 2 + x * size * 0.38, foot[1] - h * top * size * 0.52], next() * Math.PI * 2,
      size * (0.07 + next() * 0.025), jitter(tone, next, 0.35), { mirror: next() < 0.5 }));
  }
  for (const draw of pending.sort(() => next() - 0.5)) draw();
  return canvas;
}

/**
 * Cypress sprays standing close, fanning slightly outward. Their centres fill
 * `profile` (a half-width, as a fraction, at each height from 0, foot, to 1,
 * tip), kept far enough in that no spray reaches the canvas's edge.
 */
function cypressSprays(sprites: Sprite[], width: number, height: number, profile: (h: number) => number, count: number, length: number, seed: number) {
  const canvas = new Canvas(width, height);
  const next = seeded(seed);
  const tone = linear(tones.cypress.upper);
  const stamps = Array.from({ length: count }, () => {
    const h = next();
    return { h, x: (next() * 2 - 1) * profile(h) };
  }).sort((a, b) => b.h - a.h);
  for (const { h, x } of stamps) {
    const size = length * (0.8 + next() * 0.3);
    const lean = x * 0.3 + (next() - 0.5) * 0.25;
    const center = [width / 2 + x * (width / 2 - length * 0.5), length * 0.6 + (1 - h) * (height - length * 1.2)];
    // A spray is drawn from its stalk, half its length below its centre.
    const at: [number, number] = [center[0] - Math.sin(lean) * size / 2, center[1] + Math.cos(lean) * size / 2];
    canvas.leaf(sprites[Math.floor(next() * sprites.length)], at, lean, size, jitter(tone, next, 0.4), { width: 1.1, mirror: next() < 0.5, contrast: 1.15 });
  }
  return canvas;
}

/** The profile of the cypress's flame, as a fraction of its greatest half-width, from foot (0) to tip (1). */
function flame(h: number) {
  const y = h * 10.8 - 0.2;
  const points: [number, number][] = [[-0.2, 0.45], [0.8, 0.8], [3, 1], [7.4, 0.62], [10.6, 0.06]];
  for (let i = 1; i < points.length; i++) {
    if (y <= points[i][0]) {
      const t = (y - points[i - 1][0]) / (points[i][0] - points[i - 1][0]);
      return Math.max(points[i - 1][1] + (points[i][1] - points[i - 1][1]) * Math.min(Math.max(t, 0), 1), 0);
    }
  }
  return 0;
}

/** A whole olive, small: a split trunk and limbs under a crown of sprays. */
function wholeOlive(spray: Sprite, width: number, height: number, seed: number) {
  const canvas = new Canvas(width, height);
  const next = seeded(seed);
  const trunkColor = bark.map((value) => value * 0.8) as vec3;
  const [w, h] = [width, height];
  // Two leaning stems from one foot, each forking into limbs.
  const stems: [[number, number], [number, number], number][] = [[[0.5 * w, h], [0.47 * w, 0.7 * h], 0.024 * w], [[0.47 * w, 0.7 * h], [0.43 * w, 0.64 * h], 0.018 * w], [[0.5 * w, 0.76 * h], [0.58 * w, 0.62 * h], 0.016 * w]];
  for (const [foot, fork, radius] of stems) canvas.twig(foot, fork, [radius, radius * 0.75], trunkColor);
  for (const [from, to] of [[[0.43, 0.64], [0.28, 0.46]], [[0.43, 0.64], [0.45, 0.4]], [[0.58, 0.62], [0.72, 0.45]], [[0.58, 0.62], [0.56, 0.42]]]) {
    canvas.twig([from[0] * w, from[1] * h], [to[0] * w, to[1] * h], [0.018 * w, 0.009 * w], trunkColor);
  }
  // The crown: sprays over a broad, low dome, the lower ones first.
  const sprays = Array.from({ length: 30 }, () => {
    const [x, rise] = [next() * 2 - 1, next()];
    return { x, y: h * 0.62 - rise * Math.sqrt(Math.max(1 - x * x, 0)) * h * 0.36 };
  }).sort((a, b) => b.y - a.y);
  for (const { x, y } of sprays) {
    const size = w * (0.26 + next() * 0.06);
    canvas.leaf(spray, [w / 2 + x * w * 0.31, y + size / 2], (next() - 0.5) * 0.8, size, [1, 1, 1], { chroma: 1, contrast: 1 });
  }
  return canvas;
}

/**
 * Gaps inside a spray keep this alpha, just under the cut-off: up close they
 * stay open, but mipmaps average them with the leaves around them, so a
 * distant card stays a solid mass instead of thinning out.
 */
const gapAlpha = 0.42;

/**
 * Downsamples by four, fills the gaps inside the foliage (see `gapAlpha`)
 * with shaded leaf colour, gives the texels outside it nearby colour so
 * filtering never darkens edges, and encodes sRGB RGBA. Foliage fades out
 * toward the region's edges, but for the foot a plant `stands` on, so no
 * card shows a straight edge.
 */
function resolve(canvas: Canvas, into: Uint8Array, [rx, ry, rw, rh]: Region, { opaque = false, stands = false } = {}) {
  const data = new Float32Array(rw * rh * 4);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
      const s = ((y * 4 + dy) * canvas.width + x * 4 + dx) * 4;
      for (let c = 0; c < 4; c++) data[(y * rw + x) * 4 + c] += canvas.data[s + c] / 16;
    }
  }
  // Colour under transparent texels: premultiplied colour and alpha, blurred, then divided.
  const blurred = data.slice();
  for (let pass = 0; pass < 6; pass++) {
    const source = blurred.slice();
    const [dx, dy] = pass % 2 ? [0, 1] : [1, 0];
    const radius = 4 << (pass >> 1);
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
      const sum = [0, 0, 0, 0];
      for (let k = -radius; k <= radius; k += Math.max(radius >> 2, 1)) {
        const [sx, sy] = [Math.min(Math.max(x + dx * k, 0), rw - 1), Math.min(Math.max(y + dy * k, 0), rh - 1)];
        for (let c = 0; c < 4; c++) sum[c] += source[(sy * rw + sx) * 4 + c];
      }
      for (let c = 0; c < 4; c++) blurred[(y * rw + x) * 4 + c] = sum[c];
    }
  }
  // How much foliage surrounds each texel, within about the span a mipmap two levels down averages.
  const around = new Float32Array(rw * rh);
  const radius = 3;
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    let sum = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const [sx, sy] = [x + dx, y + dy];
      if (sx >= 0 && sy >= 0 && sx < rw && sy < rh) sum += data[(sy * rw + sx) * 4 + 3];
    }
    around[y * rw + x] = sum / (2 * radius + 1) ** 2;
  }
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const i = (y * rw + x) * 4;
    const a = data[i + 3];
    const edge = opaque ? 1 : smoothstep(0, 3, Math.min(x, y, rw - 1 - x, stands ? Infinity : rh - 1 - y));
    const inside = opaque ? 0 : smoothstep(0.3, 0.55, around[y * rw + x]) * edge;
    const fill = blurred[i + 3] > 0 ? [0, 1, 2].map((c) => blurred[i + c] / blurred[i + 3] * (1 - 0.3 * inside)) : [0.2, 0.22, 0.15];
    const o = ((ry + y) * atlasSize + rx + x) * 4;
    for (let c = 0; c < 3; c++) {
      const own = a > 0.004 ? data[i + c] / a : fill[c];
      into[o + c] = toSRGB(own * Math.min(a * 4, 1) + fill[c] * (1 - Math.min(a * 4, 1)));
    }
    into[o + 3] = opaque ? 255 : Math.round(Math.max(Math.min(a, 1) * edge, gapAlpha * inside) * 255);
  }
}

/** The foliage atlas as a PNG: sRGB colour, alpha for the cards' cut-outs. */
export async function foliageAtlas(): Promise<Uint8Array> {
  const [olive, cypress, scrub] = await Promise.all([leafSources.olive, leafSources.cypress, leafSources.scrub].map(leaves));
  const pixels = new Uint8Array(atlasSize * atlasSize * 4);
  const scaled = (region: Region) => [region[2] * 4, region[3] * 4] as const;
  const spray = oliveSpray(olive, scaled(atlasRegions.olive)[0], 11);
  resolve(spray, pixels, atlasRegions.olive);
  resolve(scrubDome(scrub, scaled(atlasRegions.scrub)[0], 12), pixels, atlasRegions.scrub, { stands: true });
  const [cw, ch] = scaled(atlasRegions.cypress);
  resolve(cypressSprays(cypress, cw, ch, (h) => Math.sin(Math.PI * h) ** 0.5, 130, ch * 0.24, 13), pixels, atlasRegions.cypress);
  const [fw, fh] = scaled(atlasRegions.cypressFar);
  resolve(cypressSprays(cypress, fw, fh, flame, 240, fh * 0.1, 14), pixels, atlasRegions.cypressFar, { stands: true });
  const [ow, oh] = scaled(atlasRegions.oliveFar);
  resolve(wholeOlive(spray.sprite(), ow, oh, 15), pixels, atlasRegions.oliveFar, { stands: true });
  const [bw, bh] = scaled(atlasRegions.bark);
  const white = new Canvas(bw, bh);
  white.data.fill(1);
  resolve(white, pixels, atlasRegions.bark, { opaque: true });
  return new Uint8Array(await sharp(Buffer.from(pixels), { raw: { width: atlasSize, height: atlasSize, channels: 4 } })
    .png({ palette: true, quality: 95, colours: 256, dither: 0.5, effort: 10, compressionLevel: 9 }).toBuffer());
}

// ---------------------------------------------------------------------------
// The plants

/** A region's corners in UV, inset half a texel so neighbours never bleed in. */
function uvRect([x, y, w, h]: Region) {
  const inset = 0.5;
  return { u0: (x + inset) / atlasSize, u1: (x + w - inset) / atlasSize, v0: (y + inset) / atlasSize, v1: (y + h - inset) / atlasSize };
}

/** Trunks and limbs, baked against the ground like the other props, all mapped to the atlas's white bark. */
function branches(geometry: Geometry): MeshData {
  const [mesh] = bake([geometry], propShading, groundPlane);
  const { u0, u1, v0, v1 } = uvRect(atlasRegions.bark);
  return { ...mesh, uvs: Array.from({ length: mesh.positions.length / 3 }, () => [(u0 + u1) / 2, (v0 + v1) / 2]).flat() };
}

const add = (a: vec3, b: vec3): vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: vec3, s: number): vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: vec3, b: vec3): vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: vec3, b: vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

type Foliage = {
  /** Which way foliage faces at a point: outward from the crown, so cards light as one volume rather than as flat planes. */
  normal: (point: vec3, face: vec3) => vec3;
  /** Light reaching a point: less inside and under the crown. */
  shade: (point: vec3, normal: vec3) => number;
};

/**
 * A leaf card: one quad over an atlas region, centred at `center`, `right`
 * and `up` its half-extents. It faces the way its normals lean, so a back
 * face is only ever seen through the crown.
 */
function card(mesh: MeshData, region: Region, center: vec3, right: vec3, up: vec3, foliage: Foliage) {
  const face = normalize(cross(right, up));
  const outward = foliage.normal(center, face);
  if (dot(face, outward) < 0) right = scale(right, -1);
  const { u0, u1, v0, v1 } = uvRect(region);
  const offset = mesh.positions.length / 3;
  const corners: [vec3, number, number][] = [
    [add(center, add(scale(right, -1), scale(up, -1))), u0, v1],
    [add(center, add(right, scale(up, -1))), u1, v1],
    [add(center, add(right, up)), u1, v0],
    [add(center, add(scale(right, -1), up)), u0, v0],
  ];
  const facing = normalize(cross(right, up));
  for (const [point, u, v] of corners) {
    const normal = foliage.normal(point, facing);
    const light = foliage.shade(point, normal);
    mesh.positions.push(...point);
    mesh.normals.push(...normal);
    mesh.colors.push(light, light, light);
    mesh.uvs!.push(u, v);
  }
  mesh.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}

const cards = (): MeshData => ({ positions: [], normals: [], colors: [], indices: [], uvs: [] });

/** Foliage leaning outward from `center`, over an ellipsoid of `radii`, darker toward its heart and underside. */
function crown(center: vec3, radii: vec3, bend = 0.75, depth = 0.25): Foliage {
  return {
    normal: (point, face) => {
      const radial = normalize([(point[0] - center[0]) / radii[0], (point[1] - center[1]) / radii[1] + 0.25, (point[2] - center[2]) / radii[2]]);
      const along = dot(face, radial) < 0 ? scale(face, -1) : face;
      return normalize(add(scale(along, 1 - bend), scale(radial, bend)));
    },
    shade: (point, normal) => {
      const reach = Math.hypot((point[0] - center[0]) / radii[0], (point[1] - center[1]) / radii[1], (point[2] - center[2]) / radii[2]);
      return (1 - depth + depth * smoothstep(0.1, 0.95, reach)) * (0.8 + 0.2 * smoothstep(-0.7, 0.8, normal[1]));
    },
  };
}

/**
 * Foliage of a far plant, a few cards crossing at its axis: they all face up
 * and a little outward, so the crossing cards light as one mass, darkening
 * toward its foot below `top`.
 */
function distant(top: number): Foliage {
  return {
    normal: (point) => normalize([point[0] * 0.15, 1, point[2] * 0.15]),
    shade: (point) => 0.72 + 0.23 * smoothstep(0, top, point[1]),
  };
}

/** A card turned to face `facing`, rolled by `roll` about it, `width` by `height` metres. */
function facingCard(mesh: MeshData, region: Region, center: vec3, facing: vec3, roll: number, width: number, height: number, foliage: Foliage) {
  const f = normalize(facing);
  const side = normalize(Math.abs(f[1]) > 0.95 ? cross([1, 0, 0], f) : cross([0, 1, 0], f));
  const top = cross(f, side);
  const [c, s] = [Math.cos(roll), Math.sin(roll)];
  const right = add(scale(side, c * width / 2), scale(top, s * width / 2));
  const up = add(scale(side, -s * height / 2), scale(top, c * height / 2));
  card(mesh, region, center, right, up, foliage);
}

/**
 * Cards that each rise from a bush's middle toward one side at `turns`,
 * their dome's flat foot along the middle and its round edge outward, so a
 * bush seen from above is round rather than a star.
 */
function petals(mesh: MeshData, region: Region, turns: number[], width: number, reach: number, rise: number, lift: number, foliage: Foliage) {
  for (const turn of turns) {
    const out: vec3 = [Math.cos(turn), 0, -Math.sin(turn)];
    const up: vec3 = [out[0] * reach / 2, rise / 2, out[2] * reach / 2];
    card(mesh, region, [up[0], lift + up[1], up[2]], [out[2] * width / 2, 0, -out[0] * width / 2], up, foliage);
  }
}

/** Upright cards through a vertical axis at `turns`, each `width` wide, from `bottom` to `top`. */
function crossed(mesh: MeshData, region: Region, base: vec3, turns: number[], width: number, bottom: number, top: number, foliage: Foliage) {
  for (const turn of turns) {
    const right: vec3 = [Math.cos(turn) * width / 2, 0, -Math.sin(turn) * width / 2];
    card(mesh, region, [base[0], base[1] + (bottom + top) / 2, base[2]], right, [0, (top - bottom) / 2, 0], foliage);
  }
}

/**
 * An olive: a short, split trunk and three leaning limbs under a broad,
 * low, silvery crown of sprays. The far olive is three crossed cards of a
 * whole tree.
 */
export function olive(detail: "near" | "far"): MeshData {
  if (detail === "far") {
    const [, , w, h] = atlasRegions.oliveFar;
    const mesh = cards();
    const width = 5.4;
    crossed(mesh, atlasRegions.oliveFar, [0, 0, 0], [0, Math.PI / 3, Math.PI * 2 / 3], width, -0.3, -0.3 + width * h / w, distant(3.5));
    // A spray over the crown, so the building views, looking down, see it round.
    card(mesh, atlasRegions.olive, [0, 2.9, 0], [2.1, 0, 0], [0, 0, -2.1], distant(3.5));
    return mesh;
  }
  const next = seeded(7);
  const wood = new Geometry();
  wood.paint = bark;
  const fork: vec3 = [0.1, 0.95, 0.05];
  limb(wood, [0, -0.3, 0], fork, [0.27, 0.2], 5);
  const ends: vec3[] = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + 0.5;
    const end: vec3 = [Math.cos(a) * 1.35, 2.15 + next() * 0.35, -Math.sin(a) * 1.35];
    const middle: vec3 = [fork[0] + (end[0] - fork[0]) * 0.45 + (next() - 0.5) * 0.25, 1.55 + next() * 0.15, fork[2] + (end[2] - fork[2]) * 0.45 + (next() - 0.5) * 0.25];
    limb(wood, fork, middle, [0.15, 0.11], 4);
    limb(wood, middle, end, [0.11, 0.06], 4);
    ends.push(end);
  }
  const mesh = cards();
  const foliage = crown([0, 2.6, 0], [2.3, 1.2, 2.3]);
  // Sprays gather at the ends of the limbs, between them a little higher, and over the top.
  const clumps: vec3[] = [
    ...ends.map(([x, y, z]): vec3 => [x * 1.05, y + 0.25, z * 1.05]),
    ...ends.map((_, i): vec3 => {
      const a = (i + 0.5) / 3 * Math.PI * 2 + 0.5;
      return [Math.cos(a) * 1.15, 2.85 + next() * 0.2, -Math.sin(a) * 1.15];
    }),
    [0, 3.25, 0],
  ];
  for (const clump of clumps) {
    for (let k = 0; k < 4; k++) {
      const out = normalize([clump[0] + (next() - 0.5) * 2.4, clump[1] - 2.2 + (next() - 0.2) * 1.6, clump[2] + (next() - 0.5) * 2.4]);
      const size = 2.2 + next() * 0.4;
      facingCard(mesh, atlasRegions.olive, add(clump, scale(out, 0.25)), out, next() * Math.PI * 2, size, size, foliage);
    }
  }
  return merge([branches(wood), mesh]);
}

/**
 * A cypress: a tall, dark flame of sprays in crossed cards, tier over tier,
 * on a short trunk. The far cypress is two crossed cards of a whole one.
 */
export function cypress(detail: "near" | "far"): MeshData {
  const height = 10.8;
  const foliage: Foliage = {
    normal: (point, face) => {
      const radial = normalize([point[0], 0.35, point[2]]);
      const along = dot(face, radial) < 0 ? scale(face, -1) : face;
      return normalize(add(scale(along, 0.15), scale(radial, 0.85)));
    },
    shade: (point, normal) => (0.8 + 0.2 * smoothstep(0, height, point[1])) * (0.85 + 0.15 * smoothstep(-0.5, 0.8, normal[1])),
  };
  const mesh = cards();
  if (detail === "far") {
    crossed(mesh, atlasRegions.cypressFar, [0, 0, 0], [0.4, 0.4 + Math.PI / 2], 2.3, -0.3, height - 0.2, distant(height));
    return mesh;
  }
  const wood = new Geometry();
  wood.paint = bark;
  limb(wood, [0, -0.3, 0], [0, 1.4, 0], [0.2, 0.14], 4);
  const tiers = [[0.1, 3], [1.3, 3], [2.5, 3], [3.7, 3], [4.9, 3], [6.1, 3], [7.3, 2], [8.4, 2], [9.4, 1]] as const;
  tiers.forEach(([bottom, count], k) => {
    const top = Math.min(bottom + 2.3, height - 0.2);
    const radius = 2.3 * Math.max(flame((bottom + top) / 2 / height), 0.18);
    crossed(mesh, atlasRegions.cypress, [0, 0, 0], Array.from({ length: count }, (_, i) => k * 0.7 + i * Math.PI / count), radius * 1.15, bottom, top, foliage);
  });
  return merge([branches(wood), mesh]);
}

/**
 * Scrub: a low dome of evergreen maquis, as three crossed cards and three
 * rising outward from its middle. The far scrub is two of each.
 */
export function scrub(detail: "near" | "far"): MeshData {
  const foliage = crown([0, 0.1, 0], [1.25, 0.9, 1.25], 0.8);
  const mesh = cards();
  if (detail === "far") {
    crossed(mesh, atlasRegions.scrub, [0, 0, 0], [0.3, 0.3 + Math.PI / 2], 2.4, -0.2, 2.2, distant(1));
    petals(mesh, atlasRegions.scrub, [0.3 + Math.PI / 4, 0.3 + Math.PI * 5 / 4], 2.3, 1.15, 0.35, 0.3, distant(1));
    return mesh;
  }
  crossed(mesh, atlasRegions.scrub, [0, 0, 0], [0, Math.PI / 3, Math.PI * 2 / 3], 2.4, -0.2, 2.2, foliage);
  petals(mesh, atlasRegions.scrub, [Math.PI / 6, Math.PI * 5 / 6, Math.PI * 3 / 2], 2.2, 1.15, 0.4, 0.3, foliage);
  return mesh;
}
