import type { Document, Node } from "@gltf-transform/core";
import type { Concept } from "@/lib/collection";
import { bake, Geometry, mix, triangleSoup, type Occlusion, type Paint, type Solid, type vec3 } from "@/scripts/placeholder-models/geometry";
import { attach, instanced, linear, type FinishName, type Instance, type Materials } from "@/scripts/placeholder-models/gltf";
import { noise3 } from "@/scripts/placeholder-models/noise";
import { planting } from "@/scripts/placeholder-models/props";
import { olive } from "@/scripts/placeholder-models/vegetation";

export type Detail = "low" | "high";

// Development massing only, in plot coordinates (the plot's bench top is
// y = 0). Both detail levels draw the same design from these definitions;
// the detailed export adds fidelity, never a different building.
export const plots = {
  crest: { origin: [-48, 21.2, -55], size: [30, 34] },
  contour: { origin: [48, 16.2, -8], size: [56, 48] },
  grove: { origin: [-48, 9.2, 52], size: [54, 48] },
} as const;

export const placeholder = { placeholder: true, revision: "placeholder-r2", source: "scripts/generate-placeholder-models.ts" };

/** Baking per detail level: a finer bake and more rays up close. */
const levels: Record<Detail, Occlusion> = {
  low: { rays: 16, reach: 2.4, strength: 0.9, cell: 2, tolerance: 0.13 },
  high: { rays: 28, reach: 2.4, strength: 0.9, cell: 0.5, tolerance: 0.06 },
};
// Small parts are shaded at their corners only.
const whole = new Set<FinishName>(["glass", "bronze", "timber", "sign"]);

/**
 * The finishes of one building as they are being drawn. Every finish shares
 * the building's solids (and its hidden interior), so faces they cover are
 * dropped before baking.
 */
class Build {
  readonly solids: Solid[] = [];
  readonly parts = new Map<FinishName, Geometry>();
  readonly props: { name: string; mesh: ReturnType<typeof planting>; finish: FinishName; instances: Instance[] }[] = [];

  constructor(readonly detail: Detail) {}

  get high() {
    return this.detail === "high";
  }

  part(finish: FinishName) {
    let geometry = this.parts.get(finish);
    if (!geometry) {
      geometry = new Geometry(this.solids);
      if (whole.has(finish)) geometry.cell = Infinity;
      this.parts.set(finish, geometry);
    }
    return geometry;
  }

  /** Space inside the envelope. Nothing drawn wholly within it can be seen, so it is dropped. */
  hollow(min: vec3, max: vec3) {
    this.solids.push({ min, max });
  }
}

/** A vertical facade plane: `along` runs across it, `out` faces away from the building. */
type Plane = { origin: vec3; along: vec3; out: vec3 };
type Rect = { u0: number; u1: number; v0: number; v1: number };

const at = ({ origin, along, out }: Plane, u: number, v: number, w = 0): vec3 =>
  [origin[0] + along[0] * u + out[0] * w, origin[1] + v, origin[2] + along[2] * u + out[2] * w];

/** A box given in facade coordinates. */
function slab(geometry: Geometry, plane: Plane, u: [number, number], v: [number, number], w: [number, number], chamfer = 0) {
  const [a, b] = [at(plane, u[0], v[0], w[0]), at(plane, u[1], v[1], w[1])];
  geometry.box(
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])],
    { chamfer },
  );
}

function panel(geometry: Geometry, plane: Plane, { u0, u1, v0, v1 }: Rect, w: number, toward = plane.out) {
  geometry.faceToward(toward, at(plane, u0, v0, w), at(plane, u1, v0, w), at(plane, u1, v1, w), at(plane, u0, v1, w));
}

/**
 * A wall face with rectangular openings and their reveals. Rows run between
 * the openings' edges, so each row splits only where an opening crosses it.
 */
function punched(wall: Geometry, plane: Plane, span: Rect, openings: Rect[], reveal: number, revealPart = wall, w = 0) {
  const edges = [...new Set([span.v0, span.v1, ...openings.flatMap(({ v0, v1 }) => [v0, v1])])]
    .filter((v) => v >= span.v0 && v <= span.v1).sort((a, b) => a - b);
  for (let row = 0; row < edges.length - 1; row++) {
    const [v0, v1] = [edges[row], edges[row + 1]];
    const crossing = openings.filter((o) => o.v0 <= v0 + 1e-6 && o.v1 >= v1 - 1e-6).sort((a, b) => a.u0 - b.u0);
    let cursor = span.u0;
    for (const opening of crossing) {
      if (opening.u0 > cursor + 1e-6) panel(wall, plane, { u0: cursor, u1: opening.u0, v0, v1 }, w);
      cursor = Math.max(cursor, opening.u1);
    }
    if (span.u1 > cursor + 1e-6) panel(wall, plane, { u0: cursor, u1: span.u1, v0, v1 }, w);
  }
  const up: vec3 = [0, 1, 0];
  const down: vec3 = [0, -1, 0];
  for (const { u0, u1, v0, v1 } of openings) {
    const inward = (u: number): vec3 => [plane.along[0] * u, 0, plane.along[2] * u];
    revealPart.faceToward(down, at(plane, u0, v1, w), at(plane, u1, v1, w), at(plane, u1, v1, w - reveal), at(plane, u0, v1, w - reveal));
    revealPart.faceToward(up, at(plane, u0, v0, w), at(plane, u1, v0, w), at(plane, u1, v0, w - reveal), at(plane, u0, v0, w - reveal));
    revealPart.faceToward(inward(1), at(plane, u0, v0, w), at(plane, u0, v1, w), at(plane, u0, v1, w - reveal), at(plane, u0, v0, w - reveal));
    revealPart.faceToward(inward(-1), at(plane, u1, v0, w), at(plane, u1, v1, w), at(plane, u1, v1, w - reveal), at(plane, u1, v0, w - reveal));
  }
}

// Glass reads as glass by its sheen: a pale sky reflection at the head of
// each pane, darkening to the room behind toward its foot.
const glassFoot = [0.3, 0.32, 0.34] as vec3;
const glassHead = [0.92, 0.95, 0.97] as vec3;
const glassTone = (bottom: number, top: number): Paint => (point) =>
  mix(glassFoot, glassHead, Math.min(Math.max((point[1] - bottom) / (top - bottom), 0), 1) ** 0.8);

/**
 * Glazing set `depth` behind the facade plane: glass panes divided by
 * mullions, in a frame of the given finish. Low detail draws the frame as
 * flat strips on the glass; high detail as bars with depth and a sill.
 */
function glazing(build: Build, plane: Plane, opening: Rect, depth: number, {
  frame, panes = 1, transom, width = 0.07, sill,
}: { frame: FinishName; panes?: number; transom?: number; width?: number; sill?: FinishName }) {
  const glass = build.part("glass");
  const bars = build.part(frame);
  const { u0, u1, v0, v1 } = opening;
  const y = (v: number) => plane.origin[1] + v;
  glass.with(glassTone(y(v0), y(v1)), () => panel(glass, plane, opening, -depth));
  const mullions = Array.from({ length: panes - 1 }, (_, i) => u0 + (u1 - u0) * (i + 1) / panes);
  if (!build.high) {
    // From the district the frame is lost in the reveal; the divisions still show.
    const strip = (rect: Rect) => panel(bars, plane, rect, -depth + 0.015);
    for (const u of mullions) strip({ u0: u - width / 2, u1: u + width / 2, v0, v1 });
    if (transom !== undefined) strip({ u0, u1, v0: transom - width / 2, v1: transom + width / 2 });
    return;
  }
  const [back, front] = [-depth - 0.02, -depth + 0.07];
  slab(bars, plane, [u0, u1], [v0, v0 + width], [back, front]);
  slab(bars, plane, [u0, u1], [v1 - width, v1], [back, front]);
  slab(bars, plane, [u0, u0 + width], [v0 + width, v1 - width], [back, front]);
  slab(bars, plane, [u1 - width, u1], [v0 + width, v1 - width], [back, front]);
  for (const u of mullions) slab(bars, plane, [u - width * 0.4, u + width * 0.4], [v0 + width, v1 - width], [back, front - 0.01]);
  if (transom !== undefined) slab(bars, plane, [u0 + width, u1 - width], [transom - width * 0.4, transom + width * 0.4], [back, front - 0.01]);
  if (sill) slab(build.part(sill), plane, [u0 - 0.08, u1 + 0.08], [v0 - 0.07, v0 + 0.005], [-depth, 0.06], 0.015);
}

/** Stone that varies block to block. */
const mottled = (amount: number, wavelength = 0.9, seed = 5): Paint => (point) => {
  const k = 1 - amount / 2 + amount * noise3(point, wavelength, seed);
  return [k, k, k];
};
const tone = (k: number): vec3 => [k, k, k];

// A geometry-only roof sign: visible text and diagonal hatch, no textures.
const glyphs: Record<string, string[]> = {
  P: ["1110", "1001", "1001", "1110", "1000", "1000", "1000"],
  L: ["1000", "1000", "1000", "1000", "1000", "1000", "1111"],
  A: ["0110", "1001", "1001", "1111", "1001", "1001", "1001"],
  C: ["0111", "1000", "1000", "1000", "1000", "1000", "0111"],
  E: ["1111", "1000", "1000", "1110", "1000", "1000", "1111"],
  H: ["1001", "1001", "1001", "1111", "1001", "1001", "1001"],
  O: ["0110", "1001", "1001", "1001", "1001", "1001", "0110"],
  D: ["1110", "1001", "1001", "1001", "1001", "1001", "1110"],
  R: ["1110", "1001", "1001", "1110", "1010", "1001", "1001"],
};

/**
 * The PLACEHOLDER plaque, paper and ink in one painted finish. It lies on
 * the roof at `height`, centred on `z`, tilted up toward the north by
 * `pitch` radians where the roof slopes.
 */
function sign(build: Build, height: number, z: number, pitch = 0) {
  const geometry = new Geometry();
  const [paper, ink] = [linear("#FBF9F5"), linear("#5E5850")];
  geometry.with(paper, () => geometry.box([0, 0.06, 0], [13, 0.12, 2.7], { solid: false }));
  geometry.paint = ink;
  for (const [letterIndex, letter] of [..."PLACEHOLDER"].entries()) {
    glyphs[letter].forEach((row, rowIndex) => [...row].forEach((pixel, column) => {
      if (pixel === "0") return;
      const x = -5.8 + letterIndex * 1.15 + column * 0.23;
      const depth = -0.9 + rowIndex * 0.23;
      geometry.quad([x, 0.13, depth + 0.2], [x + 0.2, 0.13, depth + 0.2], [x + 0.2, 0.13, depth], [x, 0.13, depth]);
    }));
  }
  for (let x = -6; x < 6; x += 0.5) {
    geometry.quad([x, 0.13, 1.2], [x + 0.04, 0.13, 1.2], [x + 0.34, 0.13, 0.85], [x + 0.3, 0.13, 0.85]);
  }
  const [cos, sin] = [Math.cos(pitch), Math.sin(pitch)];
  const target = build.part("sign");
  for (const face of geometry.faces) {
    target.faces.push({ ...face, cell: Infinity, points: face.points.map(([x, y, depth]): vec3 => [x, height + y * cos - depth * sin, z + y * sin + depth * cos]) });
  }
}

/** Soft planting clumps, instanced: on roofs, terraces and in the court. */
function plant(build: Build, instances: Instance[]) {
  const existing = build.props.find(({ name }) => name === "plants");
  if (existing) existing.instances.push(...instances);
  else build.props.push({ name: "plants", mesh: planting(build.detail), finish: "planting", instances });
}

/** Evenly spaced positions along [from, to], `spacing` apart, centred. */
function along(from: number, to: number, spacing: number) {
  const count = Math.max(1, Math.floor((to - from) / spacing));
  const start = from + (to - from - (count - 1) * spacing) / 2;
  return Array.from({ length: count }, (_, i) => start + i * spacing);
}

/**
 * Crest: twelve levels, 3.5 m apart, on a rubble-stone plinth. Limestone
 * piers run the full height; between them, windows on the east, west and
 * north and, on the south, loggias recessed behind the pier plane, each
 * with a solid parapet, a bronze rail and an oak soffit. A limestone crown
 * closes the roof.
 */
function crest(build: Build) {
  const { high } = build;
  const limestone = build.part("limestone");
  const stone = build.part("stone");
  const bronze = build.part("bronze");
  const storey = 3.5;
  const top = 42;
  const chamfer = high ? 0.06 : 0;
  build.hollow([-8.55, 3.3, -10.05], [8.55, top - 0.1, 7.05]);

  // The plinth: the ground storey in rubble stone, a limestone coping, the entrance.
  stone.with(mottled(0.3), () => stone.box([0, 1.65, 0.425], [19.2, 3.3, 23.05], { chamfer: high ? 0.04 : 0 }));
  for (const [center, size] of [
    [[0, 3.4, -10.8], [19.2, 0.2, 0.6]], [[9.3, 3.4, 0.725], [0.6, 0.2, 22.45]], [[-9.3, 3.4, 0.725], [0.6, 0.2, 22.45]], [[0, 3.4, 11.8], [18, 0.2, 0.3]],
  ] as [vec3, vec3][]) limestone.box(center, size, { chamfer: high ? 0.03 : 0 });
  const plinthSouth: Plane = { origin: [0, 0, 11.95], along: [1, 0, 0], out: [0, 0, 1] };
  glazing(build, plinthSouth, { u0: -1.8, u1: 1.8, v0: 0, v1: 2.8 }, -0.01, { frame: "bronze", panes: 3, transom: 2.3 });
  limestone.box([0, 3.02, 12.6], [5.2, 0.16, 1.3], { chamfer: high ? 0.03 : 0 });
  for (const [origin, alongAxis, out, span] of [
    [[9.6, 0, 11.95], [0, 0, -1], [1, 0, 0], [3, 20]],
    [[-9.6, 0, -11.1], [0, 0, 1], [-1, 0, 0], [3, 20]],
    [[9.6, 0, -11.1], [-1, 0, 0], [0, 0, -1], [3, 16.2]],
  ] as [vec3, vec3, vec3, [number, number]][]) {
    const plane = { origin, along: alongAxis, out };
    for (const u of along(span[0], span[1], 5)) glazing(build, plane, { u0: u - 0.9, u1: u + 0.9, v0: 1.1, v1: 2.7 }, -0.01, { frame: "bronze", panes: 2 });
  }

  // East, west and north: punched walls between projecting piers and floor bands.
  const faces: { plane: Plane; length: number; piers: number[] }[] = [
    { plane: { origin: [9, 0, 7.5], along: [0, 0, -1], out: [1, 0, 0] }, length: 18, piers: [0, 6, 12] },
    { plane: { origin: [-9, 0, -10.5], along: [0, 0, 1], out: [-1, 0, 0] }, length: 18, piers: [6, 12, 18] },
    { plane: { origin: [-9, 0, -10.5], along: [1, 0, 0], out: [0, 0, -1] }, length: 18, piers: [6, 12] },
  ];
  for (const { plane, length, piers } of faces) {
    const openings: Rect[] = [];
    for (let floor = 1; floor < 12; floor++) for (let bay = 0; bay < 3; bay++) {
      openings.push({ u0: bay * 6 + 1.7, u1: bay * 6 + 4.3, v0: floor * storey + 0.6, v1: floor * storey + 3 });
    }
    limestone.with(tone(0.95), () => punched(limestone, plane, { u0: 0, u1: length, v0: storey, v1: top }, openings, 0.3));
    for (const opening of openings) glazing(build, plane, opening, 0.3, { frame: "bronze", panes: 2, sill: "limestone" });
    for (let floor = 1; floor <= 12; floor++) slab(limestone, plane, [0, length], [floor * storey - 0.35, floor * storey], [0, 0.2], high ? 0.04 : 0);
    for (const u of piers) slab(limestone, plane, [u - 0.45, u + 0.45], [storey, top], [0, 0.45], chamfer);
  }
  for (const [x, z] of [[9, -10.5], [-9, -10.5]]) limestone.post([x, (storey + top) / 2, z], [0.9, top - storey, 0.9], chamfer);

  // South: deep fins frame three loggia bays on every residential level.
  for (const x of [-9, -3, 3, 9]) limestone.post([x, (storey + top) / 2, 9.65], [0.9, top - storey, 4.3], chamfer);
  const bays: [number, number][] = [[-8.55, -3.45], [-2.55, 2.55], [3.45, 8.55]];
  const plaster = build.part("plaster");
  const oak = build.part("oak");
  for (let floor = 1; floor <= 12; floor++) {
    const y = floor * storey;
    limestone.box([0, y - 0.175, 9.575], [17.1, 0.35, 4.15], { chamfer: high ? 0.03 : 0 });
    if (floor === 12) break;
    for (const [x0, x1] of bays) {
      const width = x1 - x0;
      const center = (x0 + x1) / 2;
      // Parapet, with a bronze rail above it.
      limestone.box([center, y + 0.45, 11.5], [width, 0.9, 0.3], { chamfer: high ? 0.03 : 0 });
      bronze.bar([x0, y + 1.1, 11.5], [x1, y + 1.1, 11.5], 0.06);
      if (high) {
        limestone.box([center, y + 0.93, 11.5], [width, 0.06, 0.38], { chamfer: 0.015 });
        for (const x of along(x0 + 0.3, x1 - 0.3, 1.25)) bronze.box([x, y + 1.02, 11.5], [0.04, 0.16, 0.04]);
      }
      if (high) oak.box([center, y + storey - 0.37, 9.45], [width, 0.04, 3.9]);
      else oak.faceToward([0, -1, 0], [x0, y + storey - 0.35, 7.5], [x1, y + storey - 0.35, 7.5], [x1, y + storey - 0.35, 11.4], [x0, y + storey - 0.35, 11.4]);
      // The back wall: chalk plaster around a three-panel bronze opening.
      const back: Plane = { origin: [x0, y, 7.5], along: [1, 0, 0], out: [0, 0, 1] };
      const opening = { u0: 0.35, u1: width - 0.35, v0: 0, v1: 2.7 };
      punched(plaster, back, { u0: 0, u1: width, v0: 0, v1: storey - 0.39 }, [opening], 0.2);
      glazing(build, back, opening, 0.2, { frame: "bronze", panes: 3, width: 0.08 });
    }
  }

  // The crown, the roof and what stands on it.
  for (const [center, size] of [
    [[9, top + 0.5, 0.425], [0.9, 1, 22.75]], [[-9, top + 0.5, 0.425], [0.9, 1, 22.75]],
    [[0, top + 0.5, -10.5], [17.1, 1, 0.9]], [[0, top + 0.5, 11.35], [17.1, 1, 0.9]],
  ] as [vec3, vec3][]) {
    limestone.box(center, size, { chamfer });
    if (high) limestone.box([center[0], top + 1.04, center[2]], [size[0] + 0.1, 0.08, size[2] + 0.1], { chamfer: 0.02 });
  }
  limestone.with(tone(0.86), () => limestone.faceToward([0, 1, 0], [-8.55, top, -10.05], [8.55, top, -10.05], [8.55, top, 7.5], [-8.55, top, 7.5]));
  plaster.box([0, top + 1.3, -6.5], [11, 2.6, 5.4], { chamfer: high ? 0.04 : 0 });
  limestone.box([0, top + 2.68, -6.5], [11.4, 0.16, 5.8], { chamfer: high ? 0.03 : 0 });
  limestone.box([0, top + 0.25, 6.5], [16, 0.5, 1.3], { chamfer: high ? 0.03 : 0 });
  plant(build, along(-7.4, 7.4, high ? 1.1 : 2.2).map((x, i) => ({ at: [x, top + 0.45, 6.5 + (i % 2 ? 0.15 : -0.15)], turn: i * 1.3 })));
  sign(build, top, 0);
}

/**
 * Contour: four levels stepping north into the hillside above a stone
 * retaining base. Each level opens south through a bronze-framed glass
 * wall under the concrete slab of its own roof, which is the deep terrace
 * of the level above: stone paving, timber screens and a planted edge.
 */
function contour(build: Build) {
  const { high } = build;
  const concrete = build.part("concrete");
  const stone = build.part("stone");
  const timber = build.part("timber");
  const paving = build.part("paving");
  const storey = 3.5;
  const base = 0.9;
  const fronts = [19, 12, 5, -2];
  const chamfer = high ? 0.04 : 0;

  // The stone retaining base, and the uphill wall the levels step against.
  stone.with(mottled(0.3), () => {
    stone.box([0, base / 2, 2], [48.8, base, 43.2], { chamfer: high ? 0.04 : 0 });
    stone.box([0, base + 7, -19.6], [47.2, 14, 0.8]);
  });
  plant(build, along(-22.5, 22.5, high ? 1.6 : 2.6).map((x, i) => ({ at: [x, base + 0.5, 23.1], turn: i })));
  concrete.box([0, base + 0.25, 23.1], [46.4, 0.5, 0.8], { chamfer });

  fronts.forEach((front, level) => {
    const floor = base + level * storey;
    const ceiling = floor + storey - 0.45;
    build.hollow([-22.7, floor + 0.05, -18.9], [22.7, ceiling - 0.05, front - 0.3]);
    // The roof slab, its edge overhanging the glass by 1.4 m.
    concrete.with(mottled(0.08, 2.5, 11), () => concrete.box([0, ceiling + 0.225, (front + 1.4 - 19.3) / 2], [47.2, 0.45, front + 1.4 + 19.3], { chamfer }));
    // Stone end walls.
    stone.with(mottled(0.3), () => {
      for (const x of [-23.3, 23.3]) stone.box([x, (floor + ceiling) / 2, (front - 19) / 2], [0.6, ceiling - floor, front + 19], { chamfer: high ? 0.03 : 0 });
    });
    // The glass wall.
    const plane: Plane = { origin: [-23, floor, front], along: [1, 0, 0], out: [0, 0, 1] };
    if (high) for (let i = 0; i < 20; i++) glazing(build, plane, { u0: i * 2.3, u1: (i + 1) * 2.3, v0: 0, v1: ceiling - floor }, 0, { frame: "bronze", width: 0.08 });
    else glazing(build, plane, { u0: 0, u1: 46, v0: 0, v1: ceiling - floor }, 0, { frame: "bronze", panes: 20, width: 0.12 });
    // Timber screens slide in front of parts of the glass.
    const slats = high ? 15 : 7;
    for (const center of [-15.5 + level * 3, 1.5 - level * 2, 14 + level]) {
      const [x0, x1] = [center - 1.6, center + 1.6];
      for (let i = 0; i < slats; i++) {
        const x = x0 + 0.1 + (x1 - x0 - 0.2) * i / (slats - 1);
        timber.box([x, (floor + ceiling) / 2, front + 0.45], [high ? 0.07 : 0.14, ceiling - floor - 0.1, 0.12]);
      }
      if (high) for (const y of [floor + 0.05, ceiling - 0.05]) timber.box([center, y, front + 0.45], [3.2, 0.1, 0.14]);
    }
    // The terrace on this roof: paving, and a planted edge along its front.
    if (level === 3) return;
    const next = fronts[level + 1];
    const deck = ceiling + 0.45;
    paving.with(mottled(0.1, 1.4, 17), () => paving.box([0, deck + 0.02, (next + front + 0.4) / 2], [46, 0.04, front + 0.4 - next]));
    concrete.box([0, deck + 0.28, front + 0.95], [46.4, 0.56, 0.9], { chamfer });
    plant(build, along(-22.4, 22.4, high ? 1.6 : 2.6).map((x, i) => ({ at: [x, deck + 0.52, front + 0.95], turn: i * 0.7 })));
    if (high) {
      // Outdoor rooms: a dining table and benches, and a pair of loungers.
      const z = next + 3.2;
      timber.box([-17, deck + 0.74, z], [2.2, 0.06, 0.95]);
      for (const x of [-17.9, -16.1]) timber.box([x, deck + 0.36, z], [0.08, 0.72, 0.8]);
      for (const side of [-1, 1]) timber.box([-17, deck + 0.44, z + side * 0.85], [2, 0.05, 0.35]);
      for (const x of [8, 9.2]) {
        timber.box([x, deck + 0.3, z + 0.6], [0.7, 0.08, 1.9]);
        timber.box([x, deck + 0.5, z - 0.3], [0.7, 0.4, 0.08]);
      }
    }
  });
  // The top roof is planted over its concrete, behind a planted front edge.
  const roof = base + 4 * storey;
  concrete.box([0, roof + 0.28, fronts[3] + 0.95], [46.4, 0.56, 0.9], { chamfer });
  plant(build, along(-22.4, 22.4, high ? 1.6 : 2.6).map((x, i) => ({ at: [x, roof + 0.52, fronts[3] + 0.95], turn: i * 0.9 })));
  plant(build, along(-21, 21, high ? 2 : 4).flatMap((x, i) => [
    { at: [x, roof, -16 + (i % 3)], turn: i },
    { at: [x + 1, roof, -4 - (i % 2)], turn: i + 2 },
  ] satisfies Instance[]));
  sign(build, roof, -10);
}

/**
 * Grove: four straight two-storey wings around an open court. Buff brick
 * carries the ground storey and lime render the upper one, with deep
 * reveals, timber frames and shutters. A hipped ring of clay tile covers
 * the wings; the court is planted, with a private brick-walled patio for
 * the Garden residence in its northeast corner.
 */
function grove(build: Build) {
  const { high } = build;
  const render = build.part("render");
  const brick = build.part("brick");
  const tile = build.part("tile");
  const timber = build.part("timber");
  const [plinth, eaves] = [3.2, 6.2];
  const proud = 0.06;
  for (const [min, max] of [
    [[13.6, 0.05, -18.4], [22.4, eaves - 0.05, 18.4]], [[-22.4, 0.05, -18.4], [-13.6, eaves - 0.05, 18.4]],
    [[-12.4, 0.05, -18.4], [12.4, eaves - 0.05, -9.6]], [[-12.4, 0.05, 9.6], [12.4, eaves - 0.05, 18.4]],
  ] as [vec3, vec3][]) build.hollow(min, max);
  // Under the court's paving, too.
  build.hollow([-12.9, -0.05, -8.9], [12.9, 0.015, 8.9]);

  // Each face: its plane, its length, and which openings it has.
  const faces: { plane: Plane; length: number; court: boolean }[] = [
    { plane: { origin: [-23, 0, 19], along: [1, 0, 0], out: [0, 0, 1] }, length: 46, court: false },
    { plane: { origin: [23, 0, -19], along: [-1, 0, 0], out: [0, 0, -1] }, length: 46, court: false },
    { plane: { origin: [23, 0, 19], along: [0, 0, -1], out: [1, 0, 0] }, length: 38, court: false },
    { plane: { origin: [-23, 0, -19], along: [0, 0, 1], out: [-1, 0, 0] }, length: 38, court: false },
    { plane: { origin: [-13, 0, -9], along: [1, 0, 0], out: [0, 0, 1] }, length: 26, court: true },
    { plane: { origin: [13, 0, 9], along: [-1, 0, 0], out: [0, 0, -1] }, length: 26, court: true },
    { plane: { origin: [13, 0, -9], along: [0, 0, 1], out: [-1, 0, 0] }, length: 18, court: true },
    { plane: { origin: [-13, 0, 9], along: [0, 0, -1], out: [1, 0, 0] }, length: 18, court: true },
  ];
  faces.forEach(({ plane, length, court }, index) => {
    // Outer corners are convex: brick wraps them. Court corners are concave.
    const [start, end] = court ? [proud, length - proud] : [-proud, length + proud];
    const centres = along(1.8, length - 1.8, 3.6);
    const ground: Rect[] = centres.map((u) => court
      ? { u0: u - 0.9, u1: u + 0.9, v0: 0.1, v1: 2.5 }
      : { u0: u - 0.7, u1: u + 0.7, v0: 0.3, v1: 2.4 });
    // The Garden residence opens its living room west, onto its patio.
    if (index === 4) ground.splice(ground.length - 2, 2, { u0: 20.4, u1: 22.8, v0: 0.1, v1: 2.5 });
    const upper: Rect[] = centres.map((u) => ({ u0: u - 0.6, u1: u + 0.6, v0: plinth + 0.9, v1: plinth + 2.5 }));
    brick.with(mottled(0.14, 0.6, 3), () => punched(brick, plane, { u0: start, u1: end, v0: 0, v1: plinth }, ground, 0.35 + proud, brick, proud));
    render.with(mottled(0.05, 3, 8), () => punched(render, plane, { u0: 0, u1: length, v0: plinth, v1: eaves }, upper, 0.35));
    // The brick plinth's top, where the render steps back.
    brick.faceToward([0, 1, 0], at(plane, start, plinth, 0), at(plane, end, plinth, 0), at(plane, end, plinth, proud), at(plane, start, plinth, proud));
    for (const opening of ground) glazing(build, plane, opening, 0.35, { frame: "timber", panes: 2, transom: court ? undefined : 1.9, width: 0.08 });
    for (const opening of upper) {
      glazing(build, plane, opening, 0.35, { frame: "timber", panes: 2, width: 0.07, sill: high ? "render" : undefined });
      // Shutters folded back against the render on either side.
      for (const [u0, u1] of [[opening.u0 - 0.62, opening.u0 - 0.02], [opening.u1 + 0.02, opening.u1 + 0.62]]) {
        if (!high) {
          panel(timber, plane, { u0, u1, v0: opening.v0, v1: opening.v1 }, 0.04);
          continue;
        }
        slab(timber, plane, [u0, u1], [opening.v0, opening.v1], [0.01, 0.06]);
        for (const u of [u0, u1 - 0.05]) slab(timber, plane, [u, u + 0.05], [opening.v0, opening.v1], [0.06, 0.1]);
        for (let v = opening.v0 + 0.08; v < opening.v1 - 0.12; v += 0.12) {
          timber.faceToward([0, 1, 0], at(plane, u0 + 0.05, v, 0.09), at(plane, u1 - 0.05, v, 0.09), at(plane, u1 - 0.05, v + 0.12, 0.065), at(plane, u0 + 0.05, v + 0.12, 0.065));
          timber.faceToward([0, -1, 0], at(plane, u0 + 0.05, v, 0.065), at(plane, u1 - 0.05, v, 0.065), at(plane, u1 - 0.05, v, 0.09), at(plane, u0 + 0.05, v, 0.09));
        }
      }
    }
  });

  // The hipped ring roof: eaves 0.45 m out, a 22° pitch up to one ridge ring.
  const pitch = Math.tan(22 * Math.PI / 180);
  const [outer, inner, ridge] = [[23.45, 19.45], [12.55, 8.55], [18, 14]];
  const ridgeHeight = eaves + (outer[0] - ridge[0]) * pitch;
  const corners = ([x, z]: number[], y: number): vec3[] => [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]];
  const [outerRing, innerRing, ridgeRing] = [corners(outer, eaves), corners(inner, eaves), corners(ridge, ridgeHeight)];
  const slopes: [vec3, vec3, vec3, vec3][] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    slopes.push([outerRing[i], outerRing[j], ridgeRing[j], ridgeRing[i]]);
    slopes.push([innerRing[j], innerRing[i], ridgeRing[i], ridgeRing[j]]);
  }
  const terracotta = mottled(0.16, 1.6, 31);
  tile.with(terracotta, () => {
    for (const [a, b, c, d] of slopes) {
      const normal = roofNormal(a, b, c);
      if (!high) {
        tile.faceToward(normal, a, b, c, d);
        continue;
      }
      // Courses of tile, each with a lip at its foot, running between the hips.
      const courses = Math.round(Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / 0.42);
      const lift = normal.map((value) => value * 0.035) as vec3;
      for (let k = 0; k < courses; k++) {
        const [t0, t1] = [k / courses, (k + 1) / courses];
        const [p0, p1, p2, p3] = [lerp3(a, d, t0), lerp3(b, c, t0), lerp3(b, c, t1), lerp3(a, d, t1)];
        const [q0, q1] = [add3(p0, lift), add3(p1, lift)];
        tile.faceToward(normal, q0, q1, p2, p3);
        tile.faceToward(sub3(a, d), p0, p1, q1, q0);
      }
    }
  });
  // Ridge and hip tiles, fascias and soffits under the eaves.
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tile.with(tone(0.92), () => {
      tile.bar(ridgeRing[i], ridgeRing[j], 0.26, [0, 1, 0], 0.16);
      tile.bar(outerRing[i], ridgeRing[i], 0.24, [0, 1, 0], 0.14);
    });
    for (const [ring, wall, facing] of [[outerRing, 1, 1], [innerRing, -1, -1]] as const) {
      const [a, b] = [ring[i], ring[j]];
      const out = sub3(mid3(a, b), [0, a[1], 0]).map((value, k) => k === 1 ? 0 : value * facing) as vec3;
      render.faceToward(out, [a[0], eaves - 0.16, a[2]], [b[0], eaves - 0.16, b[2]], b, a);
      const shrink = (p: vec3): vec3 => [p[0] - Math.sign(p[0]) * 0.45 * wall, eaves - 0.16, p[2] - Math.sign(p[2]) * 0.45 * wall];
      render.faceToward([0, -1, 0], [a[0], eaves - 0.16, a[2]], [b[0], eaves - 0.16, b[2]], shrink(b), shrink(a));
    }
  }
  // Chimneys, rendered, under small tile caps.
  for (const [x, z] of [[18, -6], [-18, 6], [-8, -14], [8, 14]]) {
    render.box([x, ridgeHeight + 0.3, z], [0.8, 2.6, 0.8], { chamfer: high ? 0.03 : 0 });
    tile.box([x, ridgeHeight + 1.66, z], [1.1, 0.12, 1.1], { chamfer: high ? 0.03 : 0 });
  }

  // The court: gravel paths around planted beds and olives.
  const paving = build.part("paving");
  paving.with(mottled(0.1, 1.2, 41), () => paving.faceToward([0, 1, 0], [-12.94, 0.02, -8.94], [12.94, 0.02, -8.94], [12.94, 0.02, 8.94], [-12.94, 0.02, 8.94]));
  const garden = build.part("planting");
  const beds: [number, number, number, number][] = [[-11, -2, -7.3, -1.4], [-11, -2, 1.4, 7.3], [2, 11, 1.4, 7.3], [1.5, 4, -7.3, -1.4]];
  garden.with(foliageBed, () => {
    for (const [x0, x1, z0, z1] of beds) garden.box([(x0 + x1) / 2, 0.14, (z0 + z1) / 2], [x1 - x0, 0.24, z1 - z0]);
  });
  brick.with(tone(0.9), () => {
    for (const [x0, x1, z0, z1] of beds) {
      for (const [cx, cz, sx, sz] of [
        [(x0 + x1) / 2, z0, x1 - x0 + 0.24, 0.12], [(x0 + x1) / 2, z1, x1 - x0 + 0.24, 0.12],
        [x0, (z0 + z1) / 2, 0.12, z1 - z0], [x1, (z0 + z1) / 2, 0.12, z1 - z0],
      ]) brick.box([cx, 0.16, cz], [sx, 0.32, sz]);
    }
  });
  build.props.push({
    name: "court_trees", mesh: olive("near"), finish: "foliage",
    instances: [[-6.5, -4.3], [-6.5, 4.3], [6.5, 4.3], [2.75, -4.3]].map(([x, z], i): Instance => ({ at: [x, 0.26, z], size: [0.7, 0.75, 0.7], turn: i * 1.7 })),
  });
  plant(build, beds.flatMap(([x0, x1, z0, z1], b) => along(x0 + 0.6, x1 - 0.6, high ? 1.2 : 2.4).flatMap((x, i) =>
    [z0 + 0.6, z1 - 0.6].map((z, k): Instance => ({ at: [x, 0.26, z], size: [0.7, 0.7, 0.7], turn: b + i + k })))));

  // The Garden residence's patio: light clay tile inside a low brick wall and a timber gate.
  paving.with([1, 0.86, 0.74], () => paving.box([9, 0.04, -6.3], [7.88, 0.04, 5.28]));
  brick.with(mottled(0.14, 0.6, 3), () => {
    brick.box([9, 0.5, -3.6], [7.88, 1, 0.3], { chamfer: high ? 0.02 : 0 });
    brick.box([5.15, 0.5, -7.77], [0.3, 1, 2.34], { chamfer: high ? 0.02 : 0 });
    brick.box([5.15, 0.5, -4.1], [0.3, 1, 0.7], { chamfer: high ? 0.02 : 0 });
  });
  timber.box([5.15, 0.5, -5.55], [0.08, 1, 2.1]);

  sign(build, eaves + (outer[1] - 16.7) * pitch + 0.02, 16.7, Math.atan(pitch));
}

const foliageBed: Paint = (point, normal) => normal[1] > 0.5
  ? mix(linear("#6F7C5C"), linear("#8E9A74"), noise3(point, 1.4, 51))
  : linear("#7A6A55");

const lerp3 = (a: vec3, b: vec3, t: number): vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add3 = (a: vec3, b: vec3): vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a: vec3, b: vec3): vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mid3 = (a: vec3, b: vec3) => lerp3(a, b, 0.5);
function roofNormal(a: vec3, b: vec3, c: vec3): vec3 {
  const [u, v] = [sub3(b, a), sub3(c, a)];
  const n: vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(...n);
  return n[1] < 0 ? n.map((value) => -value / length) as vec3 : n.map((value) => value / length) as vec3;
}

const designs = { crest, contour, grove };

/** A plane under the plot, so walls and props shade where they meet the ground. */
export function plotGround(slug: Concept["slug"]) {
  const [w, d] = plots[slug].size.map((value) => value / 2 + 2);
  return [-w, 0, -d, -w, 0, d, w, 0, d, -w, 0, -d, w, 0, d, w, 0, -d];
}

/** A building's finishes, tessellated, culled and baked, with its instanced props. */
export function drawBuilding(concept: Concept, detail: Detail) {
  const build = new Build(detail);
  designs[concept.slug](build);
  const finishes = [...build.parts.keys()];
  const geometries = finishes.map((finish) => build.parts.get(finish)!);
  // Glass reflects rather than scatters, so it keeps its sheen instead of taking ambient shading.
  const unshaded = new Set([build.parts.get("sign")!, build.parts.get("glass")!]);
  const meshes = bake(geometries, levels[detail], plotGround(concept.slug), unshaded);
  return { finishes, meshes, props: build.props };
}

/** The low-detail building as triangles, so the district can bake the plot's contact shading. */
export function buildingOccluders(concept: Concept) {
  const build = new Build("low");
  designs[concept.slug](build);
  return { triangles: triangleSoup([...build.parts.values()]), solids: build.solids };
}

/** The building's selection target: every finish and prop under one node at the plot origin. */
export function building(document: Document, material: Materials, concept: Concept, detail: Detail): Node {
  const { origin } = plots[concept.slug];
  const root = document.createNode(concept.scene.selectionTarget).setTranslation([...origin]).setExtras({ ...placeholder, concept: concept.slug, detail });
  root.addChild(document.createNode(concept.scene.labelAnchor).setTranslation([0, concept.facts.heightM + 4, 0]));
  const { finishes, meshes, props } = drawBuilding(concept, detail);
  finishes.forEach((finish, i) => {
    const name = finish === "sign" ? "PLACEHOLDER_sign" : `${concept.slug}_PLACEHOLDER_${finish}`;
    attach(document, root, name, meshes[i], material(finish));
  });
  for (const { name, mesh, finish, instances } of props) {
    instanced(document, root, `${concept.slug}_PLACEHOLDER_${name}`, [[mesh, material(finish)]], instances);
  }
  return root;
}
