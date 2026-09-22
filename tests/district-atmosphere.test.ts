import { describe, expect, test } from "bun:test";
import { Texture, Vector2 } from "three";
import { cloudNoise, driftClouds } from "@/components/district-scene/clouds";
import { pixelRatioCap } from "@/components/district-scene/pixel-ratio";

// The scene's atmosphere and render budget, without WebGL.
describe("pixel ratio cap per device class", () => {
  const device = (queries: string[]) => (query: string) => queries.includes(query);
  const desktop = ["(hover: hover) and (pointer: fine)", "(min-width: 768px)"];

  test("1.5 on a capable desktop", () => {
    expect(pixelRatioCap(device(desktop))).toBe(1.5);
  });

  test("1.0 on touch devices and narrow windows", () => {
    expect(pixelRatioCap(device(["(min-width: 768px)"]))).toBe(1);
    expect(pixelRatioCap(device(["(hover: hover) and (pointer: fine)"]))).toBe(1);
    expect(pixelRatioCap(device([]))).toBe(1);
  });
});

describe("cloud drift", () => {
  const layer = () => ({ texture: new Texture(), velocity: new Vector2(-0.002, 0.001) });

  test("stays still and asks for no frame with motion off", () => {
    const layers = [layer(), layer()];
    expect(driftClouds(layers, 1 / 60, false)).toBe(false);
    for (const { texture } of layers) expect(texture.offset.toArray()).toEqual([0, 0]);
  });

  test("moves and asks for the next frame with motion on", () => {
    const layers = [layer()];
    expect(driftClouds(layers, 0.05, true)).toBe(true);
    expect(layers[0].texture.offset.x).toBeCloseTo(-0.0001);
    expect(layers[0].texture.offset.y).toBeCloseTo(0.00005);
  });

  test("resumes without jumping after a still spell", () => {
    const layers = [layer()];
    driftClouds(layers, 30, true);
    expect(layers[0].texture.offset.x).toBeCloseTo(-0.0002);
  });
});

test("cloud noise tiles without a seam", () => {
  const size = 64;
  const noise = cloudNoise(size, 7);
  let interior = 0;
  let seam = 0;
  for (let row = 0; row < size; row++) {
    for (let column = 1; column < size; column++) {
      interior = Math.max(interior, Math.abs(noise[row * size + column] - noise[row * size + column - 1]));
    }
    seam = Math.max(seam, Math.abs(noise[row * size] - noise[row * size + size - 1]));
    seam = Math.max(seam, Math.abs(noise[row] - noise[(size - 1) * size + row]));
  }
  expect(Math.min(...noise)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...noise)).toBeLessThanOrEqual(1);
  expect(seam).toBeLessThanOrEqual(interior);
});
