import { bake, Geometry, mix, normalize, type MeshData, type Paint, type vec3 } from "@/scripts/placeholder-models/geometry";
import { linear } from "@/scripts/placeholder-models/gltf";
import { seeded } from "@/scripts/placeholder-models/noise";

// Generated props for the placeholder highland. No third-party assets: each
// prop is built here, painted with vertex colours and baked against the
// ground it stands on. Every prop is a single mesh, drawn once per part
// through GPU instancing however often it repeats.

const phi = (1 + Math.sqrt(5)) / 2;
const icosahedron: vec3[] = [
  [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
  [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
  [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
].map((point) => normalize(point as vec3));
const octahedron: vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const octahedronFaces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
const icosahedronFaces = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/**
 * A lumpy ellipsoid of twenty faces (or eight, for props seen only from
 * afar): soft, with smooth normals, for foliage; faceted for stone.
 */
export function blob(geometry: Geometry, center: vec3, radii: vec3, seed: number, { jitter = 0.18, soft = true, coarse = false } = {}) {
  const next = seeded(seed);
  const [base, faces] = coarse ? [octahedron, octahedronFaces] : [icosahedron, icosahedronFaces];
  const points = base.map(([x, y, z]): vec3 => {
    const k = 1 - jitter / 2 + next() * jitter;
    return [center[0] + x * radii[0] * k, center[1] + y * radii[1] * k, center[2] + z * radii[2] * k];
  });
  const normals = base.map(([x, y, z]) => normalize([x / radii[0], y / radii[1], z / radii[2]]));
  for (const [a, b, c] of faces) {
    if (soft) geometry.smooth([points[a], points[b], points[c]], [normals[a], normals[b], normals[c]]);
    else geometry.face(points[a], points[b], points[c]);
  }
}

/** A tapering round limb, trunk or branch, open at both ends. */
export function limb(geometry: Geometry, from: vec3, to: vec3, radii: [number, number], sides: number) {
  const axis = normalize([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
  const side = normalize(Math.abs(axis[1]) < 0.95 ? [axis[2], 0, -axis[0]] : [1, 0, 0]);
  const other: vec3 = [axis[1] * side[2] - axis[2] * side[1], axis[2] * side[0] - axis[0] * side[2], axis[0] * side[1] - axis[1] * side[0]];
  const ring = (center: vec3, radius: number) => Array.from({ length: sides }, (_, i) => {
    const angle = i / sides * Math.PI * 2;
    const normal: vec3 = [0, 1, 2].map((k) => side[k] * Math.cos(angle) + other[k] * Math.sin(angle)) as vec3;
    return { point: [0, 1, 2].map((k) => center[k] + normal[k] * radius) as vec3, normal };
  });
  const [bottom, top] = [ring(from, radii[0]), ring(to, radii[1])];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    geometry.smooth([bottom[i].point, bottom[j].point, top[j].point, top[i].point], [bottom[i].normal, bottom[j].normal, top[j].normal, top[i].normal]);
  }
}

// Props are baked against the ground they stand on: a plane at y = 0.
const groundPlane = [-40, 0, -40, -40, 0, 40, 40, 0, 40, -40, 0, -40, 40, 0, 40, 40, 0, -40];
const propShading = { rays: 32, reach: 2.2, strength: 0.75 };

/** Foliage coloured by how much sky it faces: lighter above, darker beneath. */
const foliage = (below: string, above: string): Paint => {
  const [low, high] = [linear(below), linear(above)];
  return (_, normal) => mix(low, high, 0.5 + 0.5 * normal[1]);
};

/**
 * An olive: a short, split trunk under a broad, low, silvery canopy of
 * overlapping clumps. Far olives are a single clump.
 */
export function olive(near: boolean): MeshData {
  const bark = new Geometry();
  const leaves = new Geometry();
  bark.paint = linear("#6F6252");
  leaves.paint = foliage("#687460", "#AEB6A0");
  if (near) {
    limb(bark, [0, -0.3, 0], [0.12, 0.9, 0.05], [0.26, 0.19], 5);
    limb(bark, [0.1, 0.8, 0.04], [-0.6, 1.9, 0.3], [0.15, 0.09], 4);
    limb(bark, [0.14, 0.8, 0.06], [0.75, 2.0, -0.3], [0.14, 0.08], 4);
    blob(leaves, [-0.75, 2.4, 0.4], [1.8, 1.05, 1.6], 1);
    blob(leaves, [0.95, 2.5, -0.35], [1.85, 1.1, 1.65], 2);
    blob(leaves, [0.1, 3.05, 0.05], [1.55, 0.95, 1.45], 3);
  } else {
    limb(bark, [0, -0.3, 0], [0.1, 1.4, 0], [0.24, 0.16], 4);
    blob(leaves, [0.1, 2.6, 0], [2.3, 1.3, 2.1], 4, { coarse: true, jitter: 0.1 });
  }
  return merge(bake([bark, leaves], propShading, groundPlane));
}

/** A cypress: a tall, dark flame. */
export function cypress(): MeshData {
  const geometry = new Geometry();
  const rings: [number, number][] = [[-0.3, 0.5], [3, 1.0], [7.4, 0.62]];
  const sides = 5;
  const apex: vec3 = [0, 10.6, 0];
  const [dark, light] = [linear("#4C5A45"), linear("#6B7A5D")];
  const ring = rings.map(([y, r], k) => Array.from({ length: sides }, (_, i) => {
    const angle = (i + k * 0.5) / sides * Math.PI * 2;
    return { point: [Math.cos(angle) * r, y, Math.sin(angle) * r] as vec3, normal: normalize([Math.cos(angle), 0.35, Math.sin(angle)]) };
  }));
  geometry.paint = (point) => mix(dark, light, Math.min(Math.max(point[1] / 10, 0), 1));
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    const [a, b, c, d] = [ring[k][i], ring[k][j], ring[k + 1][j], ring[k + 1][i]];
    geometry.smooth([a.point, d.point, c.point, b.point], [a.normal, d.normal, c.normal, b.normal]);
  }
  for (let i = 0; i < sides; i++) {
    const [a, b] = [ring.at(-1)![i], ring.at(-1)![(i + 1) % sides]];
    geometry.smooth([a.point, apex, b.point], [a.normal, [0, 1, 0], b.normal]);
  }
  return merge(bake([geometry], propShading, groundPlane));
}

/** A low, rounded mound of scrub: five-sided, soft, darker than the grass it grows in. */
export function scrub(): MeshData {
  const geometry = new Geometry();
  geometry.paint = foliage("#56624A", "#7F8A67");
  const sides = 5;
  const ring = (y: number, radius: number, twist: number) => Array.from({ length: sides }, (_, i) => {
    const angle = (i + twist) / sides * Math.PI * 2;
    const r = radius * (0.85 + 0.3 * ((i * 3) % 5) / 4);
    return { point: [Math.cos(angle) * r, y, -Math.sin(angle) * r] as vec3, normal: normalize([Math.cos(angle), 0.6 + y, -Math.sin(angle)]) };
  });
  const [base, shoulder] = [ring(-0.15, 1.05, 0), ring(0.45, 0.8, 0.5)];
  const top: vec3 = [0, 0.78, 0];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    geometry.smooth([base[i].point, base[j].point, shoulder[i].point], [base[i].normal, base[j].normal, shoulder[i].normal]);
    geometry.smooth([base[j].point, shoulder[j].point, shoulder[i].point], [base[j].normal, shoulder[j].normal, shoulder[i].normal]);
    geometry.smooth([shoulder[i].point, shoulder[j].point, top], [shoulder[i].normal, shoulder[j].normal, [0, 1, 0]]);
  }
  return merge(bake([geometry], propShading, groundPlane));
}

/** A grey limestone boulder, faceted, half sunk into the ground. */
export function rock(): MeshData {
  const geometry = new Geometry();
  const [shadow, lit] = [linear("#8F887B"), linear("#BAB3A5")];
  geometry.paint = (_, normal) => mix(shadow, lit, 0.5 + 0.5 * normal[1]);
  blob(geometry, [0, 0.1, 0], [1.2, 0.8, 1.0], 13, { jitter: 0.28, soft: false });
  return merge(bake([geometry], propShading, groundPlane));
}

/**
 * Five metres of dry-stone terrace wall, battered, buried 0.45 m so it
 * sits on sloping ground. Instances follow the contours.
 */
export function drystoneWall(): MeshData {
  const geometry = new Geometry();
  const [low, high, cap] = [linear("#7C7468"), linear("#A1988A"), linear("#B4AB9A")];
  geometry.paint = (point) => point[1] > 0.7 ? cap : mix(low, high, Math.min(Math.max((point[1] + 0.1) / 0.8, 0), 1));
  const length = 2.5;
  const [bottom, ground, top] = [-0.45, 0.08, 0.72];
  const half = (y: number) => 0.34 - (y - bottom) * 0.1;
  for (const side of [-1, 1]) {
    for (const [y0, y1] of [[bottom, ground], [ground, top]]) {
      geometry.faceToward([0, 0, side], [-length, y0, side * half(y0)], [length, y0, side * half(y0)], [length, y1, side * half(y1)], [-length, y1, side * half(y1)]);
    }
  }
  geometry.faceToward([0, 1, 0], [-length, top, -half(top)], [length, top, -half(top)], [length, top, half(top)], [-length, top, half(top)]);
  for (const end of [-1, 1]) {
    geometry.faceToward([end, 0, 0], [end * length, bottom, -half(bottom)], [end * length, bottom, half(bottom)], [end * length, top, half(top)], [end * length, top, -half(top)]);
  }
  return merge(bake([geometry], { rays: 24, reach: 1.5, strength: 0.6 }, groundPlane));
}

/** Garden planting for roofs, terraces and the court: a few soft clumps. */
export function planting(detail: "low" | "high"): MeshData {
  const geometry = new Geometry();
  geometry.paint = foliage("#5E6C52", "#94A07F");
  if (detail === "low") blob(geometry, [0, 0.25, 0], [0.8, 0.5, 0.65], 21, { jitter: 0.2, coarse: true });
  else {
    blob(geometry, [-0.3, 0.25, 0.05], [0.5, 0.42, 0.45], 22, { jitter: 0.25 });
    blob(geometry, [0.3, 0.3, -0.05], [0.55, 0.5, 0.48], 23, { jitter: 0.25 });
    blob(geometry, [0, 0.55, 0.1], [0.35, 0.4, 0.35], 24, { jitter: 0.25 });
  }
  return merge(bake([geometry], propShading, groundPlane));
}

/** A lane light: a bronze post, an arm over the lane and a lantern. */
export function laneLight(): MeshData {
  const geometry = new Geometry();
  geometry.box([0, 2.2, 0], [0.16, 4.4, 0.16]);
  geometry.box([0, 0.3, 0], [0.3, 0.6, 0.3]);
  geometry.box([0.45, 4.42, 0], [0.9, 0.1, 0.1]);
  geometry.with(linear("#F2EBDD"), () => geometry.box([0.82, 4.22, 0], [0.28, 0.3, 0.28]));
  return merge(bake([geometry], propShading, groundPlane));
}

/**
 * A soft dark disc laid on the ground under a tree: contact shading on
 * terrain whose own vertices are too far apart to carry it. Its alpha is
 * in the vertex colours, from `strength` at the centre to nothing at the rim.
 */
export function contactShade(strength = 0.4): MeshData {
  const sides = 8;
  const mesh: MeshData = { positions: [0, 0, 0], normals: [0, 1, 0], colors: [0, 0, 0, strength], indices: [] };
  for (let i = 0; i < sides; i++) {
    const angle = i / sides * Math.PI * 2;
    mesh.positions.push(Math.cos(angle), 0, -Math.sin(angle));
    mesh.normals.push(0, 1, 0);
    mesh.colors.push(0, 0, 0, 0);
    mesh.indices.push(0, 1 + i, 1 + (i + 1) % sides);
  }
  return mesh;
}

/** Several baked finishes that share one painted material, as one mesh. */
export function merge(meshes: MeshData[]): MeshData {
  const result: MeshData = { positions: [], normals: [], colors: [], indices: [] };
  for (const mesh of meshes) {
    const offset = result.positions.length / 3;
    result.positions.push(...mesh.positions);
    result.normals.push(...mesh.normals);
    result.colors.push(...mesh.colors);
    if (mesh.layers || result.layers) {
      // A part without layers takes none; the first part with them fills in those before it.
      result.layers ??= Array.from({ length: offset * 4 }, () => 0);
      result.layers.push(...(mesh.layers ?? Array.from({ length: mesh.positions.length / 3 * 4 }, () => 0)));
    }
    result.indices.push(...mesh.indices.map((index) => index + offset));
  }
  return result;
}
