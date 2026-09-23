import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { environmentMaps } from "@/components/district-scene/quality";
import type { vec3 } from "@/scripts/placeholder-models/geometry";
import { linear } from "@/scripts/placeholder-models/gltf";
import { noise, smoothstep } from "@/scripts/placeholder-models/noise";

// The scene tokens from DESIGN.md, in linear light.
const haze = linear("#DAE2E1");
const zenith = linear("#BCD0DA");
const sun = linear("#FFF1DC");
const [grass, dry, scrub, rock] = ["#A5AE95", "#B4B094", "#949D80", "#B8B1A3"].map(linear);

// The scene's sun (atmosphere.tsx), and its haze from 150 m to 1,900 m.
const sunDirection = normalized([110, 130, 110]);
const [fogNear, fogFar] = [150, 1900];
// Reflections are seen from about this high above the ground.
const eyeHeight = 30;
const degree = Math.PI / 180;

function normalized([x, y, z]: vec3): vec3 {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

const mix = (a: vec3, b: vec3, t: number): vec3 => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as vec3;
const scale = (a: vec3, s: number): vec3 => [a[0] * s, a[1] * s, a[2] * s];

// Blue-grey ranges, paler with distance, as on the landscape's horizon.
const farRange = mix(haze, scale(zenith, 0.72), 0.55);
const nearRange = mix(haze, scale(mix(scrub, zenith, 0.55), 0.7), 0.7);

/**
 * Radiance seen in direction `d` (+Y up, +X east, −Z north): the sky from the
 * haze at the horizon to the zenith, a soft glow around the sun, two layers of
 * ranges, higher to the north, and the mottled highland fading into the haze.
 * The sun itself is left out; the scene's directional light draws its highlight.
 */
function radiance([x, y, z]: vec3): vec3 {
  // Noise on a circle around the viewer, so the ranges wrap without a seam.
  const around = (radius: number, seed: number) => noise(x * radius + 500, z * radius + 500, 1, seed, 4);
  const north = smoothstep(-0.2, 1, -z);
  const elevation = Math.asin(Math.max(-1, Math.min(1, y)));
  if (elevation >= 0) {
    let color = mix(haze, zenith, Math.max(y, 0) ** 0.6);
    const toSun = Math.max(x * sunDirection[0] + y * sunDirection[1] + z * sunDirection[2], 0);
    color = [0, 1, 2].map((i) => color[i] + sun[i] * (0.45 * toSun ** 256 + 0.12 * toSun ** 8)) as vec3;
    const far = (1.5 + 4 * around(2.5, 11) + 2 * north) * degree;
    const near = (0.5 + 4 * around(4, 23) * (0.35 + 0.65 * north)) * degree;
    if (elevation < near) return mix(nearRange, haze, 0.25 * elevation / near);
    if (elevation < far) return mix(farRange, haze, 0.3 * elevation / far);
    return color;
  }
  // Where the view meets the ground, and how much haze lies in between.
  const distance = eyeHeight / -y;
  const [groundX, groundZ] = [x * distance, z * distance];
  const patches = noise(groundX, groundZ, 90, 31);
  const shrubs = smoothstep(0.55, 0.75, noise(groundX, groundZ, 35, 37));
  const rocky = smoothstep(0.7, 0.85, noise(groundX, groundZ, 140, 41));
  const albedo = mix(mix(mix(grass, dry, smoothstep(0.35, 0.65, patches)), scrub, shrubs), rock, rocky);
  return mix(scale(albedo, 0.95), haze, Math.min(Math.max((distance - fogNear) / (fogFar - fogNear), 0), 1));
}

/** Radiance as RGBE bytes: a shared exponent and three 8-bit mantissas. */
function rgbe([r, g, b]: vec3): [number, number, number, number] {
  const brightest = Math.max(r, g, b);
  if (brightest < 1e-32) return [0, 0, 0, 0];
  const exponent = Math.floor(Math.log2(brightest)) + 1;
  const factor = 256 / 2 ** exponent;
  const byte = (value: number) => Math.min(Math.floor(value * factor), 255);
  return [byte(r), byte(g), byte(b), exponent + 128];
}

// Radiance run-length encoding for one channel of a scanline: runs of four or
// more equal bytes as (128 + length, byte), anything else as literals.
function runLength(bytes: Uint8Array, out: number[]) {
  const runAt = (i: number) => {
    let run = 1;
    while (i + run < bytes.length && run < 127 && bytes[i + run] === bytes[i]) run++;
    return run;
  };
  let i = 0;
  while (i < bytes.length) {
    const run = runAt(i);
    if (run >= 4) {
      out.push(128 + run, bytes[i]);
      i += run;
      continue;
    }
    const start = i;
    while (i < bytes.length && i - start < 128 && runAt(i) < 4) i++;
    out.push(i - start, ...bytes.subarray(start, i));
  }
}

/** An equirectangular Radiance HDR, `width` × `width / 2`, top row looking straight up. */
export function environmentMap(width: number) {
  const height = width / 2;
  const out: number[] = [];
  const channels = [0, 1, 2, 3].map(() => new Uint8Array(width));
  for (let row = 0; row < height; row++) {
    const elevation = (0.5 - (row + 0.5) / height) * Math.PI;
    for (let column = 0; column < width; column++) {
      // three.js equirectangular mapping: u = atan(z, x) / 2π + 0.5.
      const azimuth = ((column + 0.5) / width - 0.5) * 2 * Math.PI;
      const pixel = rgbe(radiance([
        Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation),
      ]));
      for (let channel = 0; channel < 4; channel++) channels[channel][column] = pixel[channel];
    }
    out.push(2, 2, width >> 8, width & 255);
    for (const channel of channels) runLength(channel, out);
  }
  const header = `#?RADIANCE\n# Habitta highland environment, generated by scripts/generate-environment-maps.ts\n` +
    `FORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`;
  return new Uint8Array([...new TextEncoder().encode(header), ...out]);
}

// The width each committed map is drawn at, read from its file name.
const width = (url: string) => Number(/-(\d+)\.hdr$/.exec(url)![1]);

export async function generateEnvironmentMaps(publicDirectory = resolve(import.meta.dir, "../public")) {
  for (const url of Object.values(environmentMaps)) {
    const path = resolve(publicDirectory, url.slice(1));
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, environmentMap(width(url)));
  }
}

if (import.meta.main) {
  await generateEnvironmentMaps();
  console.log(`Generated ${Object.values(environmentMaps).join(" and ")}.`);
}
