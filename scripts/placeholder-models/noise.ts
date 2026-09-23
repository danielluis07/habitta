import type { vec3 } from "@/scripts/placeholder-models/geometry";

export const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

export function hash(x: number, z: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Fractal value noise in [0, 1], with its largest features `wavelength` metres apart. */
export function noise(x: number, z: number, wavelength: number, seed: number, octaves = 3) {
  let total = 0;
  let weight = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const u = x / wavelength * 2 ** octave;
    const v = z / wavelength * 2 ** octave;
    const [x0, z0] = [Math.floor(u), Math.floor(v)];
    const [fx, fz] = [smoothstep(0, 1, u - x0), smoothstep(0, 1, v - z0)];
    const corner = (dx: number, dz: number) => hash(x0 + dx, z0 + dz, seed + octave);
    const north = corner(0, 0) + (corner(1, 0) - corner(0, 0)) * fx;
    const south = corner(0, 1) + (corner(1, 1) - corner(0, 1)) * fx;
    total += (north + (south - north) * fz) * 0.5 ** octave;
    weight += 0.5 ** octave;
  }
  return total / weight;
}

/** Value noise in [0, 1] over space, for mottling finishes on walls as well as the ground. */
export function noise3([x, y, z]: vec3, wavelength: number, seed: number) {
  return (noise(x + y * 0.7, z - y * 0.4, wavelength, seed, 2) + noise(z + y, x - y * 0.6, wavelength * 0.7, seed + 7, 2)) / 2;
}

/** A small deterministic generator (mulberry32), so regeneration is reproducible. */
export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
