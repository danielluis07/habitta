import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { groundLayers, type GroundLayer } from "@/components/district-scene/ground";
import { download } from "@/scripts/cc0";
import { linear } from "@/scripts/placeholder-models/gltf";

type Source = {
  /** The Poly Haven asset. */
  asset: string;
  page: string;
  authors: string[];
  licence: "CC0 1.0";
  /** The 1k JPEG maps used, with the MD5 Poly Haven publishes for each. */
  maps: Record<"color" | "normal" | "roughness", { url: string; md5: string }>;
};

const polyHaven = (asset: string, authors: string[], md5: Record<"color" | "normal" | "roughness", string>): Source => {
  const file = (map: string) => `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${asset}/${asset}_${map}_1k.jpg`;
  return {
    asset, page: `https://polyhaven.com/a/${asset}`, authors, licence: "CC0 1.0",
    maps: { color: { url: file("diff"), md5: md5.color }, normal: { url: file("nor_gl"), md5: md5.normal }, roughness: { url: file("rough"), md5: md5.roughness } },
  };
};

/** Every ground texture's source, author and licence. All are CC0, from Poly Haven. */
export const groundSources: Record<GroundLayer["name"], Source> = {
  grass: polyHaven("withered_grass", ["Charlotte Baglioni"],
    { color: "a6e00946839a9ab1975457ae4a39823b", normal: "1d86c19a4dd4826eeb6db9653f8736bb", roughness: "bd4219a20ed41f88098166497cdbc05d" }),
  earth: polyHaven("dry_ground_rocks", ["Rob Tuytel"],
    { color: "7cc10e3eb12ce7bb8235d3e3c3041ded", normal: "7f2d336686d4b5e380ba76c5e3ddd4bb", roughness: "0f5d1be1483fc6ccd5971a724b178129" }),
  rock: polyHaven("rock_boulder_dry", ["Dimitrios Savva (photography)", "Rico Cilliers (processing)"],
    { color: "da794cd9be3db91e3160cf081109f322", normal: "6f1c575ceed560ae253f65518cf748e2", roughness: "0c8b15df3e31c15256da5f8e1b0d0759" }),
  gravel: polyHaven("gravel_floor_03", ["Charlotte Baglioni"],
    { color: "b2d31ac9dd803cf32c9ced98bccf44bb", normal: "3985a5985a97fa50712f34fd69e61a82", roughness: "086022b2ac741e6e0a1040ae522826bc" }),
};

/** The committed maps' size. The sources are 1,024 px; halving keeps them seamless. */
export const groundTextureSize = 512;

/**
 * How each colour map is tinted. Its luminance keeps `contrast` of its own
 * variation and its hue `chroma` of its own, around the layer's token;
 * `flatten` removes that share of the variation broader than about a tenth
 * of the map, which is what would otherwise show as a repeat.
 */
const tint: Record<GroundLayer["name"], { contrast: number; chroma: number; flatten: number }> = {
  grass: { contrast: 1.1, chroma: 0.4, flatten: 0.35 },
  earth: { contrast: 1, chroma: 0.35, flatten: 0.35 },
  rock: { contrast: 0.9, chroma: 0.3, flatten: 0.55 },
  gravel: { contrast: 1.4, chroma: 0.3, flatten: 0 },
};

const toLinear = (value: number) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSRGB = (value: number) => Math.round(255 * Math.min(Math.max(value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055, 0), 1));
const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A map decoded to `channels` floats per pixel, halved by averaging each 2 × 2 block, which stays seamless. */
async function halved(bytes: Buffer, channels: 1 | 3, decode: (value: number) => number = (value) => value / 255) {
  const { data, info } = await sharp(bytes).toColourspace(channels === 1 ? "b-w" : "srgb").raw().toBuffer({ resolveWithObject: true });
  const size = groundTextureSize;
  if (info.width !== size * 2 || info.height !== size * 2) throw new Error(`Expected a ${size * 2} px source; found ${info.width} × ${info.height}.`);
  const out = new Float64Array(size * size * channels);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < channels; c++) {
    let sum = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) sum += decode(data[((y * 2 + dy) * info.width + x * 2 + dx) * info.channels + c]);
    out[(y * size + x) * channels + c] = sum / 4;
  }
  return out;
}

/** A wrapping blur (three box passes each way), so the map stays seamless. */
function blurred(values: Float64Array, radius: number) {
  const size = groundTextureSize;
  let current = values;
  for (let pass = 0; pass < 6; pass++) {
    const next = new Float64Array(current.length);
    const horizontal = pass % 2 === 0;
    for (let a = 0; a < size; a++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += current[horizontal ? a * size + ((k + size) % size) : ((k + size) % size) * size + a];
      for (let b = 0; b < size; b++) {
        next[horizontal ? a * size + b : b * size + a] = sum / (2 * radius + 1);
        const [enter, leave] = [(b + radius + 1) % size, (b - radius + size) % size];
        sum += current[horizontal ? a * size + enter : enter * size + a] - current[horizontal ? a * size + leave : leave * size + a];
      }
    }
    current = next;
  }
  return current;
}

/** The colour map, tinted around the layer's token so its mean is exactly the token. */
async function colorMap(layer: GroundLayer, bytes: Buffer) {
  const { contrast, chroma, flatten } = tint[layer.name];
  const rgb = await halved(bytes, 3, (value) => toLinear(value / 255));
  const pixels = rgb.length / 3;
  const light = new Float64Array(pixels);
  const mean = [0, 0, 0];
  for (let i = 0; i < pixels; i++) {
    light[i] = luminance(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    for (let c = 0; c < 3; c++) mean[c] += rgb[i * 3 + c] / pixels;
  }
  const meanLight = luminance(mean[0], mean[1], mean[2]);
  const broad = blurred(light, groundTextureSize / 16);
  const token = linear(layer.hex);
  const out = new Float64Array(rgb.length);
  for (let i = 0; i < pixels; i++) {
    const relative = light[i] / meanLight / (broad[i] / meanLight) ** flatten;
    for (let c = 0; c < 3; c++) {
      const hue = rgb[i * 3 + c] / mean[c] / (light[i] / meanLight);
      out[i * 3 + c] = token[c] * relative ** contrast * hue ** chroma;
    }
  }
  // Settle the mean on the token, after clamping, in a few passes.
  for (let pass = 0; pass < 4; pass++) {
    const now = [0, 0, 0];
    for (let i = 0; i < pixels; i++) for (let c = 0; c < 3; c++) now[c] += out[i * 3 + c] / pixels;
    for (let i = 0; i < pixels; i++) for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.min(out[i * 3 + c] * token[c] / now[c], 1);
  }
  const encoded = Buffer.from(Array.from(out, toSRGB));
  return sharp(encoded, { raw: { width: groundTextureSize, height: groundTextureSize, channels: 3 } })
    .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

/** Normal X and Y in red and green, roughness in blue, all linear. */
async function surfaceMap(normalBytes: Buffer, roughnessBytes: Buffer) {
  const normal = await halved(normalBytes, 3);
  const roughness = await halved(roughnessBytes, 1);
  const packed = Buffer.alloc(roughness.length * 3);
  for (let i = 0; i < roughness.length; i++) {
    // Renormalize the averaged normal before keeping its X and Y.
    const [x, y, z] = [normal[i * 3] * 2 - 1, normal[i * 3 + 1] * 2 - 1, normal[i * 3 + 2] * 2 - 1];
    const length = Math.hypot(x, y, z) || 1;
    packed[i * 3] = Math.round((x / length * 0.5 + 0.5) * 255);
    packed[i * 3 + 1] = Math.round((y / length * 0.5 + 0.5) * 255);
    packed[i * 3 + 2] = Math.round(roughness[i] * 255);
  }
  return sharp(packed, { raw: { width: groundTextureSize, height: groundTextureSize, channels: 3 } })
    .jpeg({ quality: 70, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
}

export async function generateGroundTextures(publicDirectory = resolve(import.meta.dir, "../public")) {
  for (const layer of groundLayers) {
    const source = groundSources[layer.name];
    const [color, normal, roughness] = await Promise.all([source.maps.color, source.maps.normal, source.maps.roughness].map(download));
    await mkdir(resolve(publicDirectory, layer.color.slice(1), ".."), { recursive: true });
    await writeFile(resolve(publicDirectory, layer.color.slice(1)), await colorMap(layer, color));
    await writeFile(resolve(publicDirectory, layer.surface.slice(1)), await surfaceMap(normal, roughness));
  }
}

if (import.meta.main) {
  await generateGroundTextures();
  console.log(`Generated ${groundLayers.length * 2} ground maps in public/textures/ground/.`);
}
