import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { Box3, MathUtils, PerspectiveCamera, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { cameraFar, fogFar } from "@/components/district-scene/atmosphere";
import { buildingFill, frame, framingPoints, overviewFill } from "@/components/district-scene/framing";
import { configureLoader } from "@/components/district-scene/models";
import { pixelRatioCap } from "@/components/district-scene/pixel-ratio";
import { collection, type ConceptSlug } from "@/lib/collection";
import type { Viewpoint } from "@/lib/journey";

// The scene's atmosphere, framing and render budget, without WebGL.
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

const fov = 42;
// The district canvas on a 1440 × 1000 desktop and a 390 × 844 phone.
const aspects = { desktop: 1440 / 856, mobile: 390 / 549 };
let district: Object3D;

beforeAll(async () => {
  const data = await Bun.file(resolve(import.meta.dir, "../public/models/district-low.glb")).arrayBuffer();
  const loader = new GLTFLoader();
  configureLoader(loader);
  district = (await loader.parseAsync(data, "")).scene;
});

const framedPoints = (slug?: ConceptSlug) => framingPoints(district, slug);

function projector({ position, target }: Viewpoint, aspect: number) {
  const camera = new PerspectiveCamera(fov, aspect, 1, cameraFar);
  camera.position.set(...position);
  camera.lookAt(new Vector3(...target));
  camera.updateMatrixWorld();
  return (point: Vector3) => point.clone().project(camera);
}

describe("default overview framing", () => {
  test.each(Object.entries(aspects))("the three buildings dominate the %s view, centred", (_, aspect) => {
    const project = projector(frame(framedPoints(), fov, aspect, overviewFill), aspect);
    const projected = framedPoints().map(project);
    const xs = projected.map(({ x }) => x);
    const ys = projected.map(({ y }) => y);
    for (const value of [...xs, ...ys]) expect(Math.abs(value)).toBeLessThanOrEqual(overviewFill + 1e-6);
    // Filled to the edge on the limiting axis, and balanced on both.
    expect(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))).toBeGreaterThan(2 * overviewFill - 0.05);
    expect(Math.max(...xs) + Math.min(...xs)).toBeCloseTo(0, 1);
    expect(Math.max(...ys) + Math.min(...ys)).toBeCloseTo(0, 1);
  });
});

describe("landscape to the horizon", () => {
  test("the haze is complete before the far plane", () => {
    expect(fogFar).toBeLessThan(cameraFar);
  });

  // No terrain edge shows if, from every framed view, the ground reaches
  // past where the haze is complete in every direction the camera can see.
  const views = [undefined, ...collection.map(({ slug }) => slug)].flatMap((slug) =>
    Object.entries(aspects).map(([device, aspect]) => [slug ?? "overview", device, slug, aspect] as const));

  test.each(views)("the ground outruns the haze from the %s view on %s", (_, __, slug, aspect) => {
    const { position } = frame(framedPoints(slug), fov, aspect, slug ? buildingFill : overviewFill);
    const ground = new Box3().setFromObject(district.getObjectByName("terrain_highland_to_horizon")!);
    const tan = Math.tan(MathUtils.degToRad(fov) / 2);
    const reach = fogFar * Math.hypot(1, tan, tan * aspect);
    expect(ground.min.x).toBeLessThan(position[0] - reach);
    expect(ground.max.x).toBeGreaterThan(position[0] + reach);
    expect(ground.min.z).toBeLessThan(position[2] - reach);
    expect(ground.max.z).toBeGreaterThan(position[2] + reach);
  });
});
