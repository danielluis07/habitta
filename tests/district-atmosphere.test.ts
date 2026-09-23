import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { Box3, MathUtils, PerspectiveCamera, Raycaster, Vector2, Vector3, type Mesh, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { cameraFar, fogFar } from "@/components/district-scene/atmosphere";
import {
  aboveForeground,
  buildingDirection,
  buildingFill,
  clearRegion,
  frame,
  framingPoints,
  framingRegion,
  labelRoom,
  lensShift,
  overviewDirection,
  overviewFill,
  overviewForeground,
  wholeView,
  type Clearance,
  type ViewRegion,
} from "@/components/district-scene/framing";
import { configureLoader } from "@/components/district-scene/models";
import { collection, type ConceptSlug } from "@/lib/collection";
import type { Viewpoint } from "@/lib/journey";
import { seenGround } from "@/scripts/placeholder-models/landscape";

// The scene's atmosphere and framing, without WebGL. Rendering tiers are in
// rendering-quality.test.ts.

const fov = 42;
// The district canvas fills a 1440 × 1000 desktop and a 390 × 844 phone.
const viewports = { desktop: { width: 1440, height: 1000 }, mobile: { width: 390, height: 844 } };
const aspects = { desktop: 1440 / 1000, mobile: 390 / 844 };
// What the page lays over the canvas there: the header and arrival copy over
// the overview, and the header and building overview beside a building.
const none: Clearance = { top: 0, right: 0, bottom: 0, left: 0 };
const clearances = {
  desktop: { overview: { ...none, top: 400 }, building: { ...none, top: 102, right: 420 } },
  mobile: { overview: { ...none, top: 480 }, building: { ...none, top: 170, bottom: 844 * 0.6 } },
};
let district: Object3D;

beforeAll(async () => {
  const data = await Bun.file(resolve(import.meta.dir, "../public/models/district-low.glb")).arrayBuffer();
  const loader = new GLTFLoader();
  configureLoader(loader);
  district = (await loader.parseAsync(data, "")).scene;
});

const framedPoints = (slug?: ConceptSlug) => framingPoints(district, slug);

function camera({ position, target }: Viewpoint, aspect: number, region: ViewRegion = wholeView) {
  const camera = new PerspectiveCamera(fov, aspect, 1, cameraFar);
  lensShift(camera, region.x, region.y);
  camera.position.set(...position);
  camera.lookAt(new Vector3(...target));
  camera.updateMatrixWorld();
  return camera;
}

function projector(viewpoint: Viewpoint, aspect: number, region: ViewRegion = wholeView) {
  const view = camera(viewpoint, aspect, region);
  return (point: Vector3) => point.clone().project(view);
}

/** The overview as the scene frames it: clear of the page, above its foreground. */
function overview(device: keyof typeof viewports) {
  const size = viewports[device];
  const aspect = size.width / size.height;
  const region = framingRegion(size, clearances[device].overview, overviewForeground);
  return { size, aspect, region, viewpoint: frame(framedPoints(), fov, aspect, overviewFill, region, overviewDirection) };
}

const pitch = (direction: Vector3) => MathUtils.radToDeg(Math.asin(direction.y));

describe("default overview framing", () => {
  test("the camera is fixed: the overview looks down about 6°, building views about 18°", () => {
    expect(pitch(overviewDirection)).toBeCloseTo(6, 0);
    expect(pitch(buildingDirection)).toBeCloseTo(18, 0);
    // Both look northwest, from the valley side.
    const heading = (direction: Vector3) => Math.atan2(direction.x, direction.z);
    expect(heading(overviewDirection)).toBeCloseTo(heading(buildingDirection));
  });

  test.each(Object.entries(aspects))("the three buildings dominate the %s view, centred", (_, aspect) => {
    const project = projector(frame(framedPoints(), fov, aspect, overviewFill, wholeView, overviewDirection), aspect);
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

describe("framing clear of the page", () => {
  test("the clear region is what the page leaves uncovered", () => {
    const size = { width: 1000, height: 800 };
    expect(clearRegion(size, none)).toEqual(wholeView);
    // The top 40% covered: the lower 60%, centred 0.4 below the middle.
    const below = clearRegion(size, { ...none, top: 320 });
    expect(below.x).toBeCloseTo(0);
    expect(below.y).toBeCloseTo(-0.4);
    expect(below.width).toBeCloseTo(1);
    expect(below.height).toBeCloseTo(0.6);
    const beside = clearRegion(size, { ...none, right: 400 });
    expect(beside.x).toBeCloseTo(-0.4);
    expect(beside.width).toBeCloseTo(0.6);
  });

  test("however much is covered, the buildings keep a quarter of the view against the open edge", () => {
    const region = clearRegion({ width: 1000, height: 800 }, { ...none, top: 790 });
    expect(region.height).toBeCloseTo(0.25);
    expect(region.y).toBeCloseTo(-0.75);
  });

  const cases = Object.entries(clearances).flatMap(([device, views]) =>
    Object.entries(views).map(([view, clearance]) => [view, device, clearance] as const));

  test.each(cases)("the %s on %s fills its clear region, centred", (view, device, clearance) => {
    const size = viewports[device as keyof typeof viewports];
    const aspect = size.width / size.height;
    const slug = view === "building" ? "crest" : undefined;
    const fill = slug ? buildingFill : overviewFill;
    const region = aboveForeground(clearRegion(size, clearance), slug ? 0 : overviewForeground);
    const viewpoint = frame(framedPoints(slug), fov, aspect, fill, region, slug ? buildingDirection : overviewDirection);
    const projected = framedPoints(slug).map(projector(viewpoint, aspect, region));
    // In pixels from the canvas's top left, every framed point stays clear.
    const xs = projected.map(({ x }) => (x + 1) / 2 * size.width);
    const ys = projected.map(({ y }) => (1 - y) / 2 * size.height);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(clearance.left - 1e-6);
    expect(Math.max(...xs)).toBeLessThanOrEqual(size.width - clearance.right + 1e-6);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(clearance.top - 1e-6);
    // The overview's buildings stay above its foreground.
    const foreground = slug ? 0 : (size.height - clearance.top - clearance.bottom) * overviewForeground;
    expect(Math.max(...ys)).toBeLessThanOrEqual(size.height - clearance.bottom - foreground + 1e-6);
    const middle = (values: number[]) => (Math.min(...values) + Math.max(...values)) / 2;
    expect(middle(xs)).toBeCloseTo((clearance.left + size.width - clearance.right) / 2, -1);
    expect(middle(ys)).toBeCloseTo((clearance.top + size.height - clearance.bottom - foreground) / 2, -1);
  });

  test("the foreground is a share of the clear region, below it", () => {
    const region = aboveForeground({ x: 0, y: -0.4, width: 1, height: 0.6 }, 0.25);
    // The top edge stays where it was; the bottom quarter is left clear.
    expect(region.y + region.height).toBeCloseTo(0.2);
    expect(region.height).toBeCloseTo(0.45);
  });
});

describe("near landscape frames the overview", () => {
  test.each(Object.keys(viewports) as (keyof typeof viewports)[])(
    "the ground in front of the buildings fills the foreground on %s",
    (device) => {
      const { aspect, region, viewpoint } = overview(device);
      const view = camera(viewpoint, aspect, region);
      const ground = district.getObjectByName("terrain_highland_to_horizon") as Mesh;
      const nearest = Math.min(...framedPoints().map((point) => point.distanceTo(view.position)));
      const ray = new Raycaster();
      // Across the bottom of the canvas, and up to the foreground's top.
      const top = region.y - region.height;
      for (const [x, y] of [[-1, -1], [0, -1], [1, -1], [0, (top - 1) / 2], [0, top]]) {
        ray.setFromCamera(new Vector2(x, y), view);
        const [hit] = ray.intersectObject(ground, false);
        expect(hit?.distance).toBeLessThan(nearest);
      }
    },
  );
});

describe("labels clear of the page", () => {
  // The arrival copy reaches 421px down on desktop. Wide, short browser
  // windows leave the least height below it, so labels have the least room.
  const desktops = [[1536, 730], [1536, 864], [1280, 720], [1366, 768], [1920, 1080]] as const;

  test.each(desktops)("every overview label clears the arrival copy at %i × %i", (width, height) => {
    const clearance = { ...none, top: 421 };
    const region = framingRegion({ width, height }, clearance, overviewForeground);
    const viewpoint = frame(framedPoints(), fov, width / height, overviewFill, region, overviewDirection);
    const project = projector(viewpoint, width / height, region);
    for (const { scene } of collection) {
      const anchor = district.getObjectByName(scene.labelAnchor)!.getWorldPosition(new Vector3());
      const y = (1 - project(anchor).y) / 2 * height;
      // A 44px label hangs above its anchor; its top stays below the copy.
      expect(y - 44).toBeGreaterThanOrEqual(clearance.top);
    }
  });

  test("the label room fits a label", () => {
    expect(labelRoom).toBeGreaterThan(44);
  });
});

describe("landscape to the horizon", () => {
  test("the haze is complete before the far plane", () => {
    expect(fogFar).toBeLessThan(cameraFar);
  });

  // No terrain edge shows if, from every framed view, the ground reaches
  // past where the haze is complete in every direction the camera can see.
  const views = [undefined, ...collection.map(({ slug }) => slug)].flatMap((slug) =>
    (Object.keys(viewports) as (keyof typeof viewports)[]).map((device) =>
      [slug ?? "overview", device, slug] as const));

  test.each(views)("the ground outruns the haze from the %s view on %s", (_, device, slug) => {
    const size = viewports[device];
    const aspect = size.width / size.height;
    const region = framingRegion(size, clearances[device][slug ? "building" : "overview"], slug ? 0 : overviewForeground);
    const { position } = frame(
      framedPoints(slug), fov, aspect, slug ? buildingFill : overviewFill, region,
      slug ? buildingDirection : overviewDirection,
    );
    const ground = new Box3().setFromObject(district.getObjectByName("terrain_highland_to_horizon")!);
    // The lens shift widens the frustum on the side it shifts toward.
    const tan = Math.tan(MathUtils.degToRad(fov) / 2);
    const reach = fogFar * Math.hypot(1, tan * (1 + Math.abs(region.y)), tan * aspect * (1 + Math.abs(region.x)));
    expect(ground.min.x).toBeLessThan(position[0] - reach);
    expect(ground.max.x).toBeGreaterThan(position[0] + reach);
    expect(ground.min.z).toBeLessThan(position[2] - reach);
    expect(ground.max.z).toBeGreaterThan(position[2] + reach);
  });

  // The ground's grid coarsens fast beyond the bounds the fixed views see,
  // so every point of it a view shows, short of the haze, must lie within them.
  test.each(views)("the %s view on %s sees only the finely gridded ground", (_, device, slug) => {
    const size = viewports[device];
    const aspect = size.width / size.height;
    const region = framingRegion(size, clearances[device][slug ? "building" : "overview"], slug ? 0 : overviewForeground);
    const viewpoint = frame(framedPoints(slug), fov, aspect, slug ? buildingFill : overviewFill, region, slug ? buildingDirection : overviewDirection);
    const view = camera(viewpoint, aspect, region);
    const terrain = district.getObjectByName("terrain_highland_to_horizon") as Mesh;
    const positions = terrain.geometry.getAttribute("position");
    const index = terrain.geometry.getIndex()!;
    const seen: Vector3[] = [];
    // Each triangle's corners and centre: the ground itself, not the air above it.
    for (let t = 0; t < index.count; t += 3) {
      const corners = [0, 1, 2].map((k) => new Vector3().fromBufferAttribute(positions, index.getX(t + k)));
      for (const point of [...corners, corners[0].clone().add(corners[1]).add(corners[2]).divideScalar(3)]) {
        if (point.distanceTo(view.position) > fogFar) continue;
        const projected = point.clone().project(view);
        if (Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z < 1) seen.push(point);
      }
    }
    expect(seen.length).toBeGreaterThan(0);
    for (const { x, z } of seen) {
      expect(x).toBeWithin(seenGround.west, seenGround.east);
      expect(z).toBeWithin(seenGround.north, seenGround.south);
    }
  });
});
