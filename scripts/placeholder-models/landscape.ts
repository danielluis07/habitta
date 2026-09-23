import type { Document, Node } from "@gltf-transform/core";
import { collection } from "@/lib/collection";
import { buildingOccluders, placeholder, plots } from "@/scripts/placeholder-models/buildings";
import { bake, Geometry, mix, normalize, type MeshData, type vec3 } from "@/scripts/placeholder-models/geometry";
import { attach, instanced, linear, type Instance, type Materials } from "@/scripts/placeholder-models/gltf";
import { hash, noise, seeded, smoothstep } from "@/scripts/placeholder-models/noise";
import * as props from "@/scripts/placeholder-models/props";

// The occupied district is one even slope, rising north. The plots, lane and
// paths sit on it; the landscape beyond blends out from its edge.
const terrainHeight = (z: number) => (100 - z) * 0.12;
const districtBounds = { halfWidth: 110, halfDepth: 100 };
const waterLevel = -64;

/**
 * The highland around the district, after the concept visualizations: the
 * slope climbs north to a ridge, the valley falls south to a lake between
 * flanking hills, and mountain ranges close every horizon.
 */
function landscapeHeight(x: number, z: number) {
  const distance = Math.hypot(x, z);
  const regional = z < -100 ? 24 + 40 * (1 - Math.exp((z + 100) * 0.12 / 40))
    : z < 100 ? terrainHeight(z)
    : -84 * smoothstep(100, 700, z) + 0.3 * Math.max(z - 1150, 0);
  const ridge = 28 * Math.exp(-(((z + 240 - 30 * Math.sin(x / 260)) / 90) ** 2));
  const across = Math.abs(x - 50 * Math.sin(z / 380));
  const valleyWidth = 170 + 0.35 * Math.max(z, 0);
  const flanks = 120 * smoothstep(valleyWidth, valleyWidth + 450, across) * smoothstep(-150, 250, z);
  const peaks = (1 - Math.abs(2 * noise(x, z, 700, 11) - 1)) ** 2;
  const ranges = 220 * smoothstep(900, 1900, distance) * peaks;
  const rolling = 14 * (noise(x, z, 160, 3) - 0.5) * (1 - smoothstep(700, 1300, distance));
  return regional + ridge + flanks + ranges + rolling;
}

/** The ground height anywhere: the district's slope inside it, blending into the landscape. */
function groundHeight(x: number, z: number) {
  const outside = Math.hypot(Math.max(Math.abs(x) - districtBounds.halfWidth, 0), Math.max(Math.abs(z) - districtBounds.halfDepth, 0));
  const blend = smoothstep(0, 160, outside);
  return terrainHeight(z) * (1 - blend) + landscapeHeight(x, z) * blend;
}

/**
 * Grid lines 10 m apart across the district, then widening outward to
 * `extent`. Far enough that, from any framed view, the fog
 * swallows the ground before its edge.
 */
function gridLines(inner: number, extent: number) {
  const lines = [];
  for (let value = 0; value <= inner; value += 10) lines.push(value);
  for (let step = 10; lines.at(-1)! < extent;) {
    step *= 1.12;
    lines.push(Math.min(lines.at(-1)! + step, extent));
  }
  return [...lines.slice(1).reverse().map((value) => -value), ...lines];
}

type Route = { points: vec3[]; width: number };

// The lane through the district, passing north of Grove's bench, and its
// continuation across the landscape.
const lane = ([[-104, 22], [-20, 20], [5, -30], [95, -55]] as const).map(([x, z]): vec3 => [x, terrainHeight(z) + 0.2, z]);
const laneWidth = 6.7;
const onwardRoutes = [
  [[-104, 22], [-165, 60], [-240, 170], [-290, 280], [-300, 420]],
  [[95, -55], [170, -80], [270, -95], [400, -140], [560, -170]],
] as const;

/**
 * A path from a bench down to the lane, ending at the kerb on its side. It
 * starts on the bench, just above its top, and heads for `toward` on the lane.
 */
function plotPath(start: vec3, toward: [number, number], segment: number): vec3[] {
  const [a, b] = [lane[segment], lane[segment + 1]];
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const right = [-(b[2] - a[2]) / length, (b[0] - a[0]) / length];
  const side = Math.sign((start[0] - toward[0]) * right[0] + (start[2] - toward[1]) * right[1]);
  const d = [toward[0] - start[0], toward[1] - start[2]];
  const offset = (start[0] - toward[0]) * right[0] * side + (start[2] - toward[1]) * right[1] * side;
  const t = (laneWidth / 2 - offset) / ((d[0] * right[0] + d[1] * right[1]) * side);
  const [x, z] = [start[0] + d[0] * t, start[2] + d[1] * t];
  return [start, [x, terrainHeight(z) + 0.2, z]];
}

const plotPaths: vec3[][] = [
  plotPath([-48, plots.crest.origin[1] + 0.1, -38.8], [-7.5, -5], 1),
  // Contour's bench meets the lane at its north edge, where its hall is entered.
  plotPath([30, plots.contour.origin[1] + 0.1, -29.8], [28.1, -36.4], 2),
  plotPath([-36, plots.grove.origin[1] + 0.1, 28.8], [-36, 22 - 2 * 68 / 84], 0),
];

function distanceToSegment(x: number, z: number, a: vec3, b: vec3) {
  const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
}

const nearPolyline = (points: vec3[], x: number, z: number, margin: number) =>
  points.slice(1).some((b, i) => distanceToSegment(x, z, points[i], b) < margin);

const onPlot = (x: number, z: number, margin: number) => Object.values(plots).some(({ origin: [px, , pz], size: [w, d] }) =>
  Math.abs(x - px) < w / 2 + margin && Math.abs(z - pz) < d / 2 + margin);

/** The terrain as one smooth-shaded, vertex-coloured grid, and a lookup of its surface. */
function terrain(routes: Route[]) {
  const xs = gridLines(120, 3200);
  const zs = gridLines(120, 3200);
  const heights = zs.map((z) => xs.map((x) => groundHeight(x, z)));
  const ground: MeshData = { positions: [], normals: [], colors: [], indices: [] };
  const [grass, dry, scrubby, rock] = ["#A5AE95", "#B4B094", "#949D80", "#B8B1A3"].map(linear);
  const slope = (lines: number[], values: number[], i: number) => {
    const [a, b] = [Math.max(i - 1, 0), Math.min(i + 1, lines.length - 1)];
    return (values[b] - values[a]) / (lines[b] - lines[a]);
  };
  const nearRoute = (x: number, z: number) => Math.min(...routes.map(({ points, width }) =>
    Math.min(...points.slice(1).map((b, i) => distanceToSegment(x, z, points[i], b) - width / 2))));

  zs.forEach((z, j) => xs.forEach((x, i) => {
    const y = heights[j][i];
    const normal = [-slope(xs, heights[j], i), 1, -slope(zs, heights.map((row) => row[i]), j)];
    const length = Math.hypot(...normal);
    ground.positions.push(x, y, z);
    ground.normals.push(...normal.map((value) => value / length));
    // Dry grass and scrub in patches at two scales, bare rock where the
    // ground is steep or high, and dust along the lanes.
    let color = mix(grass, dry, smoothstep(0.42, 0.6, noise(x, z, 110, 5)));
    color = mix(color, dry, 0.85 * smoothstep(0.52, 0.68, noise(x, z, 34, 13)));
    color = mix(color, scrubby, smoothstep(0.55, 0.7, noise(x, z, 70, 9)));
    color = mix(color, scrubby, 0.85 * smoothstep(0.56, 0.7, noise(x, z, 22, 19)));
    color = mix(color, rock, Math.max(smoothstep(0.93, 0.8, 1 / length), smoothstep(160, 260, y), 0.55 * smoothstep(0.66, 0.8, noise(x, z, 48, 29))));
    if (Math.abs(x) < 700 && Math.abs(z) < 700) color = mix(color, rock, 0.35 * (1 - smoothstep(1, 9, nearRoute(x, z))));
    // Ground seen in the distance is not perfectly even either.
    const shade = 0.94 + 0.12 * hash(Math.round(x), Math.round(z), 3);
    ground.colors.push(...color.map((value) => value * shade));
  }));
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const northwest = j * xs.length + i;
      const southwest = northwest + xs.length;
      ground.indices.push(northwest, southwest, northwest + 1, northwest + 1, southwest, southwest + 1);
    }
  }

  /** The height of the triangulated surface itself, so props rest on what is drawn. */
  function surface(x: number, z: number) {
    const cell = (lines: number[], value: number) => Math.min(Math.max(lines.findLastIndex((line) => line <= value), 0), lines.length - 2);
    const [i, j] = [cell(xs, x), cell(zs, z)];
    const s = (x - xs[i]) / (xs[i + 1] - xs[i]);
    const t = (z - zs[j]) / (zs[j + 1] - zs[j]);
    const [nw, ne, sw, se] = [heights[j][i], heights[j][i + 1], heights[j + 1][i], heights[j + 1][i + 1]];
    return s + t <= 1 ? nw + s * (ne - nw) + t * (sw - nw) : se + (1 - s) * (sw - se) + (1 - t) * (ne - se);
  }
  /** The surface's upward normal. */
  function normalAt(x: number, z: number): vec3 {
    const e = 1.5;
    return normalize([surface(x - e, z) - surface(x + e, z), 2 * e, surface(x, z - e) - surface(x, z + e)]);
  }
  return { ground, surface, normalAt };
}

/** One point of a cross-section: its offset to the right of the centreline, and its height. `null` reaches down into the ground. */
type Section = [offset: number, height: number | null][];

/**
 * A lane or path swept along a polyline: its cross-section repeats at
 * stations `step` metres apart (or only at the polyline's own points, for an
 * infinite step) and at every corner, each edge painted, and the section's
 * outer edges reach down into the ground wherever it runs above it.
 */
function sweep(geometry: Geometry, points: vec3[], section: (distance: number) => Section, paints: vec3[], ground: (x: number, z: number) => number, step: number, breaks: number[] = []) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]));
  const total = lengths.at(-1)!;
  const direction = (k: number) => normalize([points[k + 1][0] - points[k][0], 0, points[k + 1][2] - points[k][2]]);
  // A station on every corner, where the section is mitred. Stations just
  // short of a corner are dropped: squared to their own segment, their inner
  // edge would reach past the mitre and fold the surface back over itself.
  const corners = lengths.slice(1, -1);
  const halfWidth = Math.max(...section(0).map(([offset]) => Math.abs(offset)));
  const reach = corners.map((_, k) => {
    const [before, after] = [direction(k), direction(k + 1)];
    const turn = Math.acos(Math.min(Math.max(before[0] * after[0] + before[2] * after[2], -1), 1));
    return halfWidth * Math.tan(Math.min(turn, 2) / 2) + 0.05;
  });
  const steps = [0, total, ...Array.from({ length: Number.isFinite(step) ? Math.ceil(total / step) : 0 }, (_, i) => i * step)]
    .filter((distance) => distance === 0 || distance === total || corners.every((corner, k) => Math.abs(distance - corner) >= reach[k]));
  const stops = [...new Set([...steps, ...corners, ...breaks.filter((b) => b > 0 && b < total)])].sort((a, b) => a - b);
  const stations = stops.map((distance) => {
    const i = Math.min(Math.max(lengths.findLastIndex((value) => value <= distance), 0), points.length - 2);
    const t = (distance - lengths[i]) / (lengths[i + 1] - lengths[i]);
    const [a, b] = [points[i], points[i + 1]];
    const center: vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    // Mitred at the polyline's corners, so the width holds through bends.
    let forward = direction(i);
    let widen = 1;
    const corner = distance === lengths[i] && i > 0 ? i - 1 : distance === lengths[i + 1] && i + 1 < points.length - 1 ? i + 1 : -1;
    if (corner >= 0) {
      const [before, after] = corner === i - 1 ? [direction(i - 1), direction(i)] : [direction(i), direction(i + 1)];
      forward = normalize([before[0] + after[0], 0, before[2] + after[2]]);
      widen = 1 / Math.max(forward[0] * after[0] + forward[2] * after[2], 0.5);
    }
    const right: vec3 = [-forward[2], 0, forward[0]];
    return section(distance).map(([offset, height]): vec3 => {
      const [x, z] = [center[0] + right[0] * offset * widen, center[2] + right[2] * offset * widen];
      return [x, height === null ? Math.min(ground(x, z) - 0.35, center[1] - 0.35) : center[1] + height, z];
    });
  });
  for (let s = 0; s < stations.length - 1; s++) {
    const [here, there] = [stations[s], stations[s + 1]];
    const forward = normalize([there[0][0] - here[0][0], 0, there[0][2] - here[0][2]]);
    const right: vec3 = [-forward[2], 0, forward[0]];
    for (let k = 0; k < here.length - 1; k++) {
      const [a, b, c, d] = [here[k], here[k + 1], there[k + 1], there[k]];
      if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-4 && Math.hypot(c[0] - d[0], c[1] - d[1], c[2] - d[2]) < 1e-4) continue;
      // The section runs left to right, so each edge faces a quarter turn from its own direction.
      const [dr, dy] = [(b[0] - a[0]) * right[0] + (b[2] - a[2]) * right[2], b[1] - a[1]];
      const toward: vec3 = [right[0] * -dy, dr, right[2] * -dy];
      geometry.with(paints[k], () => geometry.faceToward(toward, a, b, c, d));
    }
  }
}

export function district(document: Document, material: Materials): Node {
  const root = document.createNode("district_PLACEHOLDER_landscape").setExtras(placeholder);
  const onward = onwardRoutes.map((route) => route.map(([x, z]): vec3 => [x, 0, z]));
  const routes: Route[] = [
    { points: lane, width: laneWidth },
    ...plotPaths.map((points) => ({ points, width: 2.8 })),
    ...onward.map((points) => ({ points, width: 6.4 })),
  ];
  const { ground, surface, normalAt } = terrain(routes);
  attach(document, root, "terrain_highland_to_horizon", ground, material("ground"));
  // The lake fills the valley floor wherever the ground dips below the water.
  const lake = new Geometry();
  lake.face(...Array.from({ length: 32 }, (_, i): vec3 => {
    const angle = i / 32 * Math.PI * 2;
    return [Math.cos(angle) * 700, waterLevel, 850 - Math.sin(angle) * 600];
  }));
  attach(document, root, "lake_south_valley", bake([lake], null)[0], material("lake"));

  // Each plot's bench: a dry-stone retaining platform, gravel around the
  // building and planting at its edges, shaded where the building stands.
  const benches: MeshData[] = [];
  const [gravel, garden, wallStone, coping] = ["#D3CAB6", "#A5AE95", "#BDB29D", "#D9D2C4"].map(linear);
  for (const concept of collection) {
    const { origin, size: [w, d] } = plots[concept.slug];
    const occluders = buildingOccluders(concept);
    const bench = new Geometry([...occluders.solids]);
    const edge = (x: number, z: number) => Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z));
    bench.with((point) => mix(garden, gravel, smoothstep(1.2, 3.2, edge(point[0], point[2]) + 1.4 * (noise(point[0] + origin[0], point[2], 6, 61) - 0.5))), () =>
      bench.faceToward([0, 1, 0], [-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2]));
    const low = Math.min(...[-w / 2, w / 2].flatMap((x) => [-d / 2, d / 2].map((z) => surface(x + origin[0], z + origin[2])))) - origin[1] - 0.6;
    bench.with((point) => wallStone.map((value) => value * (0.84 + 0.2 * noise(point[0] + point[2] + origin[0], point[1] * 1.8, 1.6, 71))) as vec3, () => {
      for (const [a, b, out] of [
        [[-w / 2, -d / 2], [w / 2, -d / 2], [0, 0, -1]], [[w / 2, -d / 2], [w / 2, d / 2], [1, 0, 0]],
        [[w / 2, d / 2], [-w / 2, d / 2], [0, 0, 1]], [[-w / 2, d / 2], [-w / 2, -d / 2], [-1, 0, 0]],
      ] as [[number, number], [number, number], vec3][]) {
        bench.faceToward(out, [a[0], low, a[1]], [b[0], low, b[1]], [b[0], -0.12, b[1]], [a[0], -0.12, a[1]]);
      }
    });
    // A pale coping along the top of the retaining walls.
    bench.with(coping, () => {
      for (const [center, span] of [[[0, -d / 2], [w + 0.2, 0.5]], [[0, d / 2], [w + 0.2, 0.5]], [[-w / 2, 0], [0.5, d - 0.3]], [[w / 2, 0], [0.5, d - 0.3]]] as [[number, number], [number, number]][]) {
        bench.box([center[0], -0.03, center[1]], [span[0], 0.2, span[1]]);
      }
    });
    const nearby: number[] = [];
    for (let x = -w / 2 - 12; x < w / 2 + 12; x += 6) for (let z = -d / 2 - 12; z < d / 2 + 12; z += 6) {
      const corner = (dx: number, dz: number) => [x + dx, surface(x + dx + origin[0], z + dz + origin[2]) - origin[1], z + dz];
      nearby.push(...corner(0, 0), ...corner(0, 6), ...corner(6, 6), ...corner(0, 0), ...corner(6, 6), ...corner(6, 0));
    }
    const [mesh] = bake([bench], { rays: 20, reach: 3, strength: 0.85, cell: 1.5, tolerance: 0.09 }, [...occluders.triangles, ...nearby]);
    for (let i = 0; i < mesh.positions.length; i += 3) for (let k = 0; k < 3; k++) mesh.positions[i + k] += origin[k];
    benches.push(mesh);
  }
  attach(document, root, "separate_plot_benches", props.merge(benches), material("plot"));

  // The lane: a paved carriageway between kerbs, dropped where each path
  // meets it. Paths ramp down from their benches between low stone edges.
  // Beyond the district the lane runs on, draped on the ground, with verges.
  const paving = new Geometry();
  const [surfaceTone, kerbTone, stoneSide] = [linear("#CFC7B6"), linear("#DED8CB"), linear("#B7AD99")];
  const laneLengths = [0];
  for (let i = 1; i < lane.length; i++) laneLengths.push(laneLengths[i - 1] + Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][2] - lane[i - 1][2]));
  const junctions = plotPaths.map((path) => {
    const end = path.at(-1)!;
    let best = { distance: Infinity, along: 0, side: 1 };
    lane.slice(1).forEach((b, i) => {
      const a = lane[i];
      const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
      const length = Math.hypot(dx, dz);
      const t = Math.max(0, Math.min(1, ((end[0] - a[0]) * dx + (end[2] - a[2]) * dz) / (length * length)));
      const distance = Math.hypot(end[0] - a[0] - dx * t, end[2] - a[2] - dz * t);
      const side = Math.sign(-dz * (end[0] - a[0]) / length + dx * (end[2] - a[2]) / length);
      if (distance < best.distance) best = { distance, along: laneLengths[i] + t * length, side: side || 1 };
    });
    return best;
  });
  const kerb = (distance: number, side: number) => junctions.some((junction) => junction.side === side && Math.abs(distance - junction.along) < 2.4) ? 0 : 0.15;
  sweep(paving, lane, (distance) => [
    [-3.35, null], [-3.35, kerb(distance, -1)], [-3, kerb(distance, -1)], [-3, 0], [-2.7, 0],
    [2.7, 0], [3, 0], [3, kerb(distance, 1)], [3.35, kerb(distance, 1)], [3.35, null],
  ], [stoneSide, kerbTone, kerbTone, surfaceTone, surfaceTone, surfaceTone, kerbTone, kerbTone, stoneSide], surface, 3,
  junctions.flatMap(({ along }) => [along - 2.4, along + 2.4]));
  for (const path of plotPaths) {
    sweep(paving, path, () => [[-1.4, null], [-1.4, 0.1], [-1.2, 0.1], [-1.2, 0], [1.2, 0], [1.2, 0.1], [1.4, 0.1], [1.4, null]],
      [stoneSide, kerbTone, kerbTone, surfaceTone, kerbTone, kerbTone, stoneSide], surface, 3);
  }
  const [pavingShaded] = bake([paving], { rays: 16, reach: 0.8, strength: 0.7 });
  const verges = new Geometry();
  const onwardDraped = onward.map((route) => route.slice(1).flatMap(([x, , z], i): vec3[] => {
    const [fromX, , fromZ] = route[i];
    const steps = Math.ceil(Math.hypot(x - fromX, z - fromZ) / 10);
    return Array.from({ length: steps + (i === 0 ? 1 : 0) }, (_, step): vec3 => {
      const t = (step + (i === 0 ? 0 : 1)) / steps;
      const [px, pz] = [fromX + (x - fromX) * t, fromZ + (z - fromZ) * t];
      return [px, surface(px, pz) + 0.25, pz];
    });
  }));
  // The draped points are already 10 m apart on the ground; they are the stations.
  for (const points of onwardDraped) {
    sweep(verges, points, () => [[-3.2, -0.45], [-2.6, 0], [2.6, 0], [3.2, -0.45]], [kerbTone.map((v) => v * 0.9) as vec3, surfaceTone, kerbTone.map((v) => v * 0.9) as vec3], surface, Infinity);
  }
  attach(document, root, "connecting_lane_and_paths", props.merge([pavingShaded, bake([verges], null)[0]]), material("lane"));

  const onRoute = (x: number, z: number, margin: number) =>
    nearPolyline(lane, x, z, margin + laneWidth / 2) || plotPaths.some((points) => nearPolyline(points, x, z, margin + 1.4));
  const nearOnward = (x: number, z: number, margin: number) => onwardDraped.some((points) => nearPolyline(points, x, z, margin + 3.2));
  const inDistrict = (x: number, z: number, margin = 0) =>
    Math.abs(x) < districtBounds.halfWidth + margin && Math.abs(z) < districtBounds.halfDepth + margin;

  // Lane lights stand every 16 m on one side of the lane, heads over it.
  const lights: Instance[] = [];
  lane.slice(1).forEach((b, i) => {
    const a = lane[i];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const [nx, nz] = [-(b[2] - a[2]) / length, (b[0] - a[0]) / length];
    for (let t = 8; t < length; t += 16) {
      const x = a[0] + (b[0] - a[0]) * t / length + nx * 4.1;
      const z = a[2] + (b[2] - a[2]) * t / length + nz * 4.1;
      if (!onPlot(x, z, 1) && !plotPaths.some((points) => nearPolyline(points, x, z, 3))) {
        lights.push({ at: [x, terrainHeight(z), z], turn: Math.atan2(nz, -nx) });
      }
    }
  });

  // In the district: olive groves in rows along the contours, behind
  // dry-stone terrace walls; cypresses along the lane; scrub between.
  const olives: Instance[] = [];
  const farOlives: Instance[] = [];
  const cypresses: Instance[] = [];
  const scrub: Instance[] = [];
  const rocks: Instance[] = [];
  const walls: Instance[] = [];
  const next = seeded(24);
  const clear = (x: number, z: number, margin: number) => !onPlot(x, z, margin) && !onRoute(x, z, margin) && inDistrict(x, z, -2);
  const spaced = (list: Instance[], x: number, z: number, gap: number) => !list.some(({ at }) => Math.hypot(at[0] - x, at[2] - z) < gap);
  for (let z = -92; z <= 92; z += 10) {
    for (let x = -104; x <= 104; x += 8) {
      const [px, pz] = [x + (next() - 0.5) * 2.5, z + (next() - 0.5) * 1.5];
      if (noise(px, pz, 55, 31) < 0.54 || !clear(px, pz, 5)) continue;
      const size = 1 + next() * 0.4;
      olives.push({ at: [px, terrainHeight(pz), pz], size: [size, size * (0.9 + next() * 0.25), size], turn: next() * Math.PI * 2 });
    }
  }
  for (let z = -96; z <= 96; z += 18) {
    for (let x = -106; x <= 106; x += 5) {
      const wz = z + 4.5;
      if (noise(x, wz, 55, 31) < 0.44 || ![x - 2.5, x, x + 2.5].every((px) => clear(px, wz, 3))) continue;
      walls.push({ at: [x, terrainHeight(wz), wz], size: [1, 0.85 + next() * 0.3, 1], turn: (next() - 0.5) * 0.06 });
    }
  }
  lane.slice(1).forEach((b, i) => {
    const a = lane[i];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const [nx, nz] = [-(b[2] - a[2]) / length, (b[0] - a[0]) / length];
    for (let t = 14; t < length - 6; t += 13) {
      const x = a[0] + (b[0] - a[0]) * t / length - nx * 6.5;
      const z = a[2] + (b[2] - a[2]) * t / length - nz * 6.5;
      if (!clear(x, z, 2) || !spaced(olives, x, z, 3)) continue;
      const size = 0.85 + next() * 0.3;
      cypresses.push({ at: [x, terrainHeight(z), z], size: [size, size * (0.9 + next() * 0.3), size], turn: next() * Math.PI });
    }
  });
  for (let attempt = 0; attempt < 3000 && scrub.length < 70; attempt++) {
    const [x, z] = [-104 + next() * 208, -94 + next() * 188];
    if (!clear(x, z, 3) || !spaced(olives, x, z, 3) || !spaced(scrub, x, z, 4)) continue;
    const size = 0.7 + next() * 0.6;
    scrub.push({ at: [x, terrainHeight(z) - 0.1, z], size: [size * 1.3, size, size * 1.2], turn: next() * Math.PI });
  }

  // Beyond it, groves of olives, cypresses and scrub thin out into the
  // haze, with limestone outcrops and old terrace walls on the slopes.
  const wild = seeded(37);
  for (let attempt = 0; attempt < 40000 && olives.length + farOlives.length + cypresses.length + scrub.length < 950; attempt++) {
    const angle = wild() * Math.PI * 2;
    const radius = 125 + wild() ** 1.6 * 750;
    const [x, z] = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    const y = surface(x, z);
    const kind = wild();
    const size = 0.8 + wild() * 0.6;
    if (noise(x, z, 120, 21) < 0.45 || inDistrict(x, z, 6) || y < waterLevel + 2 || nearOnward(x, z, 2)) continue;
    const at: vec3 = [x, y - 0.3, z];
    const turn = wild() * Math.PI * 2;
    if (kind < 0.5) scrub.push({ at, size: [size * 1.6, size * 1.2, size * 1.5], turn });
    else if (kind < 0.8) (radius < 160 ? olives : farOlives).push({ at, size: [size, size * (0.85 + wild() * 0.35), size], turn });
    else cypresses.push({ at, size: [size, size * (0.9 + wild() * 0.4), size], turn });
  }
  const stones = seeded(53);
  for (let attempt = 0; attempt < 20000 && rocks.length < 120; attempt++) {
    const angle = stones() * Math.PI * 2;
    const radius = 100 + stones() ** 1.4 * 520;
    const [x, z] = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    const normal = normalAt(x, z);
    // Outcrops gather on steeper, rockier ground.
    if ((normal[1] > 0.97 && stones() > 0.25) || noise(x, z, 48, 29) < 0.45 || inDistrict(x, z, 3) || surface(x, z) < waterLevel + 1 || nearOnward(x, z, 2)) continue;
    const size = 0.6 + stones() ** 2 * 2.4;
    const tilt = orient(normal, stones() * Math.PI * 2);
    for (let piece = 0; piece < 1 + Math.floor(stones() * 3) && rocks.length < 120; piece++) {
      const [px, pz] = [x + (stones() - 0.5) * 6 * size, z + (stones() - 0.5) * 6 * size];
      const s = size * (0.5 + stones() * 0.6);
      rocks.push({ at: [px, surface(px, pz) - 0.15 * s, pz], size: [s * (0.9 + stones() * 0.5), s * (0.6 + stones() * 0.5), s], rotation: tilt });
    }
  }
  // Terrace walls follow the contours of the gentler slopes, in runs.
  const terraces = seeded(67);
  for (let attempt = 0; attempt < 4000 && walls.length < 250; attempt++) {
    const angle = terraces() * Math.PI * 2;
    const radius = 130 + terraces() * 330;
    let [x, z] = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    const normal = normalAt(x, z);
    if (normal[1] < 0.9 || normal[1] > 0.995 || noise(x, z, 90, 43) < 0.55 || surface(x, z) < waterLevel + 3) continue;
    const height = surface(x, z);
    for (let run = 0; run < 14 && walls.length < 250; run++) {
      if (inDistrict(x, z, 8) || nearOnward(x, z, 3) || surface(x, z) < waterLevel + 3) break;
      const n = normalAt(x, z);
      const tangent = normalize([n[2], 0, -n[0]]);
      // Settle on the contour, then step along it.
      const drop = surface(x, z) - height;
      const [gx, gz] = [n[0] / n[1], n[2] / n[1]];
      const pull = drop / Math.max(gx * gx + gz * gz, 1e-4);
      x += gx * pull;
      z += gz * pull;
      walls.push({ at: [x, surface(x, z), z], size: [1, 0.85 + terraces() * 0.3, 1], turn: Math.atan2(-tangent[2], tangent[0]) });
      [x, z] = [x + tangent[0] * 5, z + tangent[2] * 5];
    }
  }

  instanced(document, root, "street_lights_instanced", [[props.laneLight(), material("bronze")]], lights);
  instanced(document, root, "vegetation_olives_instanced", [[props.olive(true), material("olive")]], olives);
  instanced(document, root, "vegetation_far_olives_instanced", [[props.olive(false), material("olive")]], farOlives);
  instanced(document, root, "vegetation_cypress_instanced", [[props.cypress(), material("cypress")]], cypresses);
  instanced(document, root, "vegetation_scrub_instanced", [[props.scrub(), material("scrub")]], scrub);
  instanced(document, root, "rocks_limestone_instanced", [[props.rock(), material("rock")]], rocks);
  instanced(document, root, "terrace_walls_drystone_instanced", [[props.drystoneWall(), material("wall")]], walls);
  // Near trees cast a soft contact shade on the ground, tilted to lie on it.
  const shaded = [...olives, ...cypresses].filter(({ at }) => Math.hypot(at[0], at[2]) < 170);
  instanced(document, root, "vegetation_contact_shade_instanced", [[props.contactShade(), material("shade")]], shaded.map(({ at, size = [1, 1, 1], turn = 0 }) => {
    const radius = 2.6 * size[0];
    return { at: [at[0], surface(at[0], at[2]) + 0.12, at[2]], size: [radius, 1, radius], rotation: orient(normalAt(at[0], at[2]), turn) };
  }));
  return root;
}

/** A rotation that stands a prop's +Y on `normal`, turned `turn` about it. */
function orient(normal: vec3, turn: number): [number, number, number, number] {
  // Tilt +Y onto the normal (about the axis Y × normal), after the turn about Y.
  const [nx, ny, nz] = normal;
  const angle = Math.acos(Math.min(Math.max(ny, -1), 1));
  const axis = normalize([nz, 0, -nx]);
  const [s, c] = [Math.sin(angle / 2), Math.cos(angle / 2)];
  const tilt = [axis[0] * s, axis[1] * s, axis[2] * s, c];
  const spin = [0, Math.sin(turn / 2), 0, Math.cos(turn / 2)];
  // tilt × spin
  const [ax, ay, az, aw] = tilt;
  const [bx, by, bz, bw] = spin;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

