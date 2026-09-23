import type { vec3 } from "@gltf-transform/core";

export type { vec3 };

/**
 * A vertex colour, linear RGB. On building finishes it multiplies the
 * material's base colour; on white "painted" materials it is the albedo.
 */
export type Paint = vec3 | ((point: vec3, normal: vec3) => vec3);

/** `cell` overrides the bake's own cell size; Infinity keeps a face whole. */
type Face = { points: vec3[]; normals?: vec3[]; paint: Paint; cell?: number };

/** An axis-aligned solid. Faces entirely inside one are hidden, so they are dropped. */
export type Solid = { min: vec3; max: vec3 };

/** Packed, indexed triangles ready for a glTF primitive. */
export type MeshData = { positions: number[]; normals: number[]; colors: number[]; indices: number[] };

const add = (a: vec3, b: vec3): vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: vec3, b: vec3): vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: vec3, s: number): vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: vec3, b: vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: vec3, b: vec3): vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a: vec3, b: vec3, t: number): vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const distance = (a: vec3, b: vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const normalize = (a: vec3): vec3 => scale(a, 1 / (Math.hypot(...a) || 1));
export const mix = (a: vec3, b: vec3, t: number) => lerp(a, b, t);

/** The normal of a planar polygon, from its winding (Newell's method). */
function faceNormal(points: vec3[]): vec3 {
  const n: vec3 = [0, 0, 0];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  });
  return normalize(n);
}

/**
 * One finish's faces, before they are tessellated, culled and baked. Faces
 * are convex polygons. Baking subdivides quads, so shading has vertices to
 * live on, unless `cell` keeps them whole (small parts need no more).
 */
export class Geometry {
  faces: Face[] = [];
  paint: Paint = [1, 1, 1];
  cell?: number;

  constructor(readonly solids: Solid[] = []) {}

  /** Draws with a different paint (and optionally cell size) for the duration of `draw`. */
  with(paint: Paint, draw: () => void, cell: number | undefined = this.cell) {
    const [previous, previousCell] = [this.paint, this.cell];
    [this.paint, this.cell] = [paint, cell];
    draw();
    [this.paint, this.cell] = [previous, previousCell];
  }

  /** A flat convex face; its winding sets the normal. */
  face(...points: vec3[]) {
    this.faces.push({ points, paint: this.paint, cell: this.cell });
  }

  /** A face turned to look toward `toward`, whatever order its points arrive in. */
  faceToward(toward: vec3, ...points: vec3[]) {
    this.face(...(dot(faceNormal(points), toward) < 0 ? points.reverse() : points));
  }

  /** A face with its own vertex normals, for soft organic shapes. */
  smooth(points: vec3[], normals: vec3[]) {
    this.faces.push({ points, normals, paint: this.paint, cell: Infinity });
  }

  quad(a: vec3, b: vec3, c: vec3, d: vec3) {
    this.face(a, b, c, d);
  }

  /**
   * A box, optionally with its twelve edges chamfered. It registers itself
   * as a solid, so faces it covers (its neighbours', or its own on the
   * ground) are dropped.
   */
  box(center: vec3, size: vec3, { chamfer = 0, solid = true } = {}) {
    const half = scale(size, 0.5);
    const c = Math.min(chamfer, ...half.map((value) => value * 0.45));
    if (solid) this.solids.push({ min: sub(center, sub(half, [c, c, c])), max: add(center, sub(half, [c, c, c])) });
    // A vertex on face (axis, sign), with the other axes inset by the chamfer.
    const point = (axis: number, sign: number, a: number, b: number): vec3 => {
      const p: vec3 = [0, 0, 0];
      const [u, v] = [(axis + 1) % 3, (axis + 2) % 3];
      p[axis] = sign * half[axis];
      p[u] = a * (half[u] - c);
      p[v] = b * (half[v] - c);
      return add(center, p);
    };
    for (let axis = 0; axis < 3; axis++) {
      for (const sign of [-1, 1]) {
        const toward: vec3 = [0, 0, 0];
        toward[axis] = sign;
        this.faceToward(toward, point(axis, sign, -1, -1), point(axis, sign, 1, -1), point(axis, sign, 1, 1), point(axis, sign, -1, 1));
      }
    }
    if (!c) return;
    for (let axis = 0; axis < 3; axis++) {
      const next = (axis + 1) % 3;
      // The edge between face (axis, s) and face (next, t), running along the third axis.
      for (const s of [-1, 1]) for (const t of [-1, 1]) {
        const toward: vec3 = [0, 0, 0];
        toward[axis] = s;
        toward[next] = t;
        this.faceToward(toward, point(axis, s, t, -1), point(axis, s, t, 1), point(next, t, 1, s), point(next, t, -1, s));
      }
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const s = [sx, sy, sz];
      const corner = [0, 1, 2].map((axis) => {
        const [u, v] = [(axis + 1) % 3, (axis + 2) % 3];
        return point(axis, s[axis], s[u], s[v]);
      });
      this.faceToward([sx, sy, sz], ...corner);
    }
  }

  /**
   * A vertical prism over a convex footprint of (x, z) points, from `bottom`
   * to `top`. Its caps are optional; it is not registered as a solid.
   */
  prism(footprint: [number, number][], bottom: number, top: number, { caps = true } = {}) {
    const center = footprint.reduce<[number, number]>((sum, [x, z]) => [sum[0] + x / footprint.length, sum[1] + z / footprint.length], [0, 0]);
    footprint.forEach(([x, z], i) => {
      const [nx, nz] = footprint[(i + 1) % footprint.length];
      this.faceToward([(x + nx) / 2 - center[0], 0, (z + nz) / 2 - center[1]], [x, bottom, z], [nx, bottom, nz], [nx, top, nz], [x, top, z]);
    });
    if (!caps) return;
    this.faceToward([0, 1, 0], ...footprint.map(([x, z]): vec3 => [x, top, z]));
    this.faceToward([0, -1, 0], ...footprint.map(([x, z]): vec3 => [x, bottom, z]));
  }

  /** A box whose four vertical edges are chamfered, as piers and posts are. */
  post(center: vec3, size: vec3, chamfer: number) {
    const [x, y, z] = center;
    const [w, h, d] = scale(size, 0.5);
    const c = Math.min(chamfer, w * 0.45, d * 0.45);
    if (c <= 0) return this.box(center, size);
    this.solids.push({ min: [x - w + c, y - h, z - d + c], max: [x + w - c, y + h, z + d - c] });
    this.prism([
      [x - w + c, z - d], [x + w - c, z - d], [x + w, z - d + c], [x + w, z + d - c],
      [x + w - c, z + d], [x - w + c, z + d], [x - w, z + d - c], [x - w, z - d + c],
    ], y - h, y + h);
  }

  /**
   * A bar between two points with a square section, turned about its own
   * axis so one side faces `up`. Rails, frames and branches use it.
   */
  bar(from: vec3, to: vec3, width: number, up: vec3 = [0, 1, 0], height = width) {
    const axis = normalize(sub(to, from));
    let side = cross(axis, up);
    if (Math.hypot(...side) < 1e-6) side = cross(axis, [1, 0, 0]);
    side = scale(normalize(side), width / 2);
    const lift = scale(normalize(cross(side, axis)), height / 2);
    const corners = (p: vec3) => [add(add(p, side), lift), add(sub(p, side), lift), sub(sub(p, side), lift), sub(add(p, side), lift)];
    const [a, b] = [corners(from), corners(to)];
    const middle = lerp(from, to, 0.5);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.faceToward(sub(lerp(a[i], a[j], 0.5), from), a[i], a[j], b[j], b[i]);
    }
    this.faceToward(sub(from, middle), ...a);
    this.faceToward(sub(to, middle), ...b);
  }
}

/**
 * A bounding volume hierarchy over triangles, for the ambient-occlusion
 * rays. It answers one question: how far along a ray is the nearest hit?
 * Long triangles are split first, so their bounds stay tight.
 */
export class BVH {
  /** Per triangle: a corner and its two edges (Möller–Trumbore's inputs). */
  private triangles: Float64Array;
  private bounds: Float64Array;
  private links: Int32Array;
  private order: Int32Array;
  private count = 0;
  private stack = new Int32Array(256);

  constructor(soup: Float64Array, longest = 2.5) {
    const split: number[] = [];
    const add = (a: vec3, b: vec3, c: vec3, depth: number) => {
      const edges = [distance(a, b), distance(b, c), distance(c, a)];
      const worst = Math.max(...edges);
      if (worst <= longest || depth > 10) {
        split.push(...a, b[0] - a[0], b[1] - a[1], b[2] - a[2], c[0] - a[0], c[1] - a[1], c[2] - a[2]);
        return;
      }
      if (worst === edges[0]) {
        const m = lerp(a, b, 0.5);
        add(a, m, c, depth + 1);
        add(m, b, c, depth + 1);
      } else if (worst === edges[1]) {
        const m = lerp(b, c, 0.5);
        add(a, b, m, depth + 1);
        add(a, m, c, depth + 1);
      } else {
        const m = lerp(c, a, 0.5);
        add(a, b, m, depth + 1);
        add(m, b, c, depth + 1);
      }
    };
    for (let t = 0; t < soup.length; t += 9) {
      add([soup[t], soup[t + 1], soup[t + 2]], [soup[t + 3], soup[t + 4], soup[t + 5]], [soup[t + 6], soup[t + 7], soup[t + 8]], 0);
    }
    this.triangles = new Float64Array(split);
    const total = split.length / 9;
    this.order = Int32Array.from({ length: total }, (_, i) => i);
    this.bounds = new Float64Array(Math.max(total, 1) * 2 * 6);
    this.links = new Int32Array(Math.max(total, 1) * 2 * 3);
    const boxes = new Float64Array(total * 6);
    for (let t = 0; t < total; t++) {
      const [ax, ay, az, e1x, e1y, e1z, e2x, e2y, e2z] = this.triangles.subarray(t * 9, t * 9 + 9);
      boxes.set([
        Math.min(ax, ax + e1x, ax + e2x), Math.min(ay, ay + e1y, ay + e2y), Math.min(az, az + e1z, az + e2z),
        Math.max(ax, ax + e1x, ax + e2x), Math.max(ay, ay + e1y, ay + e2y), Math.max(az, az + e1z, az + e2z),
      ], t * 6);
    }
    if (total) this.build(0, total, boxes);
  }

  private build(start: number, end: number, boxes: Float64Array): number {
    const node = this.count++;
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = start; i < end; i++) {
      const t = this.order[i] * 6;
      for (let axis = 0; axis < 3; axis++) {
        box[axis] = Math.min(box[axis], boxes[t + axis]);
        box[axis + 3] = Math.max(box[axis + 3], boxes[t + axis + 3]);
      }
    }
    this.bounds.set(box, node * 6);
    if (end - start <= 4) {
      this.links.set([-1, start, end - start], node * 3);
      return node;
    }
    const extent = [box[3] - box[0], box[4] - box[1], box[5] - box[2]];
    const axis = extent.indexOf(Math.max(...extent));
    const centre = (t: number) => boxes[t * 6 + axis] + boxes[t * 6 + axis + 3];
    const slice = Array.from(this.order.subarray(start, end)).sort((a, b) => centre(a) - centre(b));
    this.order.set(slice, start);
    const middle = (start + end) >> 1;
    const left = this.build(start, middle, boxes);
    const right = this.build(middle, end, boxes);
    this.links.set([left, right, 0], node * 3);
    return node;
  }

  /** Where the ray enters a node's bounds, or Infinity if it misses them within `best`. */
  private enter(node: number, ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, best: number) {
    const b = node * 6;
    const bounds = this.bounds;
    let t0 = ((ix >= 0 ? bounds[b] : bounds[b + 3]) - ox) * ix;
    let t1 = ((ix >= 0 ? bounds[b + 3] : bounds[b]) - ox) * ix;
    const ty0 = ((iy >= 0 ? bounds[b + 1] : bounds[b + 4]) - oy) * iy;
    const ty1 = ((iy >= 0 ? bounds[b + 4] : bounds[b + 1]) - oy) * iy;
    if (ty0 > t0) t0 = ty0;
    if (ty1 < t1) t1 = ty1;
    const tz0 = ((iz >= 0 ? bounds[b + 2] : bounds[b + 5]) - oz) * iz;
    const tz1 = ((iz >= 0 ? bounds[b + 5] : bounds[b + 2]) - oz) * iz;
    if (tz0 > t0) t0 = tz0;
    if (tz1 < t1) t1 = tz1;
    return t0 > t1 || t1 < 0 || t0 > best ? Infinity : t0;
  }

  /** The distance to the nearest hit within `limit`, or Infinity. */
  nearest(origin: vec3, direction: vec3, limit: number) {
    if (!this.count) return Infinity;
    const [ox, oy, oz] = origin;
    const [dx, dy, dz] = direction;
    const [ix, iy, iz] = [1 / dx, 1 / dy, 1 / dz];
    const { links, triangles, order, stack } = this;
    let best = limit;
    if (this.enter(0, ox, oy, oz, ix, iy, iz, best) === Infinity) return Infinity;
    let top = 0;
    stack[top++] = 0;
    while (top) {
      const node = stack[--top];
      const l = node * 3;
      if (links[l] >= 0) {
        // Visit the nearer child first, so hits found there prune the other.
        const [a, b] = [links[l], links[l + 1]];
        const [ta, tb] = [this.enter(a, ox, oy, oz, ix, iy, iz, best), this.enter(b, ox, oy, oz, ix, iy, iz, best)];
        if (ta <= tb) {
          if (tb !== Infinity) stack[top++] = b;
          if (ta !== Infinity) stack[top++] = a;
        } else {
          if (ta !== Infinity) stack[top++] = a;
          stack[top++] = b;
        }
        continue;
      }
      for (let i = links[l + 1], stop = links[l + 1] + links[l + 2]; i < stop; i++) {
        const t = order[i] * 9;
        // Möller–Trumbore, double-sided.
        const e1x = triangles[t + 3], e1y = triangles[t + 4], e1z = triangles[t + 5];
        const e2x = triangles[t + 6], e2y = triangles[t + 7], e2z = triangles[t + 8];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-12 && det < 1e-12) continue;
        const inv = 1 / det;
        const sx = ox - triangles[t], sy = oy - triangles[t + 1], sz = oz - triangles[t + 2];
        const u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const hit = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (hit > 1e-6 && hit < best) best = hit;
      }
    }
    return best;
  }
}

/** Cosine-weighted directions over the +Y hemisphere, evenly spread (a Fibonacci spiral). */
function hemisphere(count: number): vec3[] {
  return Array.from({ length: count }, (_, i) => {
    const r = Math.sqrt((i + 0.5) / count);
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    return [r * Math.cos(angle), Math.sqrt(1 - r * r), r * Math.sin(angle)];
  });
}

export type Occlusion = {
  /** Rays per vertex. */
  rays: number;
  /** How far occluders count, in metres; nearer ones count more. */
  reach: number;
  /** 0 leaves colours alone; 1 lets a fully enclosed vertex go black. */
  strength: number;
  /** The finest cell baked; the result keeps only the rows and columns shading needs. */
  cell?: number;
  /** How far, in shade, a dropped row or column may stray from what it replaces. */
  tolerance?: number;
};

/** Solids bucketed in a coarse grid, so each culling test looks at a few. */
class SolidIndex {
  private buckets = new Map<string, Solid[]>();

  constructor(solids: Solid[], private size = 4) {
    for (const solid of solids) {
      const [a, b] = [solid.min.map((v) => Math.floor(v / size)), solid.max.map((v) => Math.floor(v / size))];
      for (let x = a[0]; x <= b[0]; x++) for (let y = a[1]; y <= b[1]; y++) for (let z = a[2]; z <= b[2]; z++) {
        const key = `${x},${y},${z}`;
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(solid);
        else this.buckets.set(key, [solid]);
      }
    }
  }

  /** Whether one solid holds every point, lifted slightly off the face along its normal. */
  covers(points: vec3[], normal: vec3) {
    const lifted = points.map((point) => add(point, scale(normal, 0.004)));
    const key = lifted[0].map((v) => Math.floor(v / this.size)).join(",");
    return (this.buckets.get(key) ?? []).some(({ min, max }) => lifted.every((p) =>
      p[0] >= min[0] - 1e-5 && p[0] <= max[0] + 1e-5 &&
      p[1] >= min[1] - 1e-5 && p[1] <= max[1] + 1e-5 &&
      p[2] >= min[2] - 1e-5 && p[2] <= max[2] + 1e-5));
  }
}

/**
 * A face refined for baking: a fine grid of vertices for a quad, or the
 * polygon itself, and which of its cells are hidden.
 */
type Patch = {
  points: vec3[];
  normals: vec3[];
  paint: Paint;
  /** Columns and rows of a quad's grid; 1 × 1 for a polygon. */
  nu: number;
  nv: number;
  polygon: boolean;
  /** The face's middle, which each ray starts a little toward. */
  center: vec3;
  hidden: boolean[];
};

const centroid = (points: vec3[]) => scale(points.reduce(add, [0, 0, 0]), 1 / points.length);

function refine(face: Face, cell: number, solids: SolidIndex): Patch {
  const { points } = face;
  const flat = faceNormal(points);
  const size = face.cell ?? cell;
  if (points.length === 4 && Number.isFinite(size) && !face.normals) {
    const [a, b, c, d] = points;
    const nu = Math.min(Math.max(1, Math.ceil(Math.max(distance(a, b), distance(d, c)) / size)), 256);
    const nv = Math.min(Math.max(1, Math.ceil(Math.max(distance(a, d), distance(b, c)) / size)), 256);
    const grid: vec3[] = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) grid.push(lerp(lerp(a, b, i / nu), lerp(d, c, i / nu), j / nv));
    const hidden: boolean[] = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const at = j * (nu + 1) + i;
      hidden.push(solids.covers([grid[at], grid[at + 1], grid[at + nu + 2], grid[at + nu + 1]], flat));
    }
    return { points: grid, normals: grid.map(() => flat), paint: face.paint, nu, nv, polygon: false, hidden, center: centroid(points) };
  }
  return {
    points, normals: face.normals ?? points.map(() => flat), paint: face.paint, nu: 1, nv: 1, polygon: true,
    hidden: [!face.normals && solids.covers(points, flat)], center: centroid(points),
  };
}

/**
 * The grid lines along one axis that shading needs: both ends, every line
 * where cells turn hidden, and wherever interpolating across a dropped line
 * would stray from the baked shade by more than `tolerance`.
 */
function lines(count: number, across: number, shade: (i: number, j: number) => number | null, edge: (i: number) => boolean, tolerance: number) {
  const keep = new Set([0, count]);
  for (let i = 1; i < count; i++) if (edge(i)) keep.add(i);
  const sorted = () => [...keep].sort((a, b) => a - b);
  for (let changed = true; changed;) {
    changed = false;
    const kept = sorted();
    for (let k = 0; k < kept.length - 1; k++) {
      const [a, b] = [kept[k], kept[k + 1]];
      let [worst, at] = [tolerance, -1];
      for (let i = a + 1; i < b; i++) for (let j = 0; j <= across; j++) {
        const [value, from, to] = [shade(i, j), shade(a, j), shade(b, j)];
        if (value === null || from === null || to === null) continue;
        const error = Math.abs(value - (from + (to - from) * (i - a) / (b - a)));
        if (error > worst) [worst, at] = [error, i];
      }
      if (at >= 0) {
        keep.add(at);
        changed = true;
      }
    }
  }
  return sorted();
}

/** Every face as triangles, flattened, as the BVH and the district's bakes take them. */
export function triangleSoup(geometries: Geometry[]): number[] {
  const soup: number[] = [];
  for (const geometry of geometries) for (const { points } of geometry.faces) {
    for (let i = 2; i < points.length; i++) soup.push(...points[0], ...points[i - 1], ...points[i]);
  }
  return soup;
}

/**
 * Culls, bakes and tessellates a set of finishes that shade one another.
 * Each vertex colour is its paint times the ambient occlusion found by
 * casting rays against every finish and the extra `occluders`, so contact
 * shading comes with the file and costs nothing at runtime. Faces are baked
 * on a fine grid, then keep only the rows and columns their shading needs.
 */
export function bake(geometries: Geometry[], occlusion: Occlusion | null, occluders: number[] = [], unshaded = new Set<Geometry>(), extraSolids: Solid[] = []): MeshData[] {
  const solids = new SolidIndex([...new Set([...geometries.flatMap((geometry) => geometry.solids), ...extraSolids])]);
  const cell = occlusion?.cell ?? Infinity;
  const tolerance = occlusion?.tolerance ?? 0.04;
  const sets = geometries.map((geometry) => geometry.faces.map((face) => refine(face, unshaded.has(geometry) ? Infinity : cell, solids)));
  // Hidden faces sit inside solids, where no ray from a visible face reaches, so every face can occlude.
  const bvh = occlusion ? new BVH(new Float64Array([...occluders, ...triangleSoup(geometries)])) : null;
  const directions = occlusion ? hemisphere(occlusion.rays) : [];
  const direction: vec3 = [0, 0, 0];

  function shade(point: vec3, normal: vec3, center: vec3) {
    if (!bvh || !occlusion) return 1;
    // One fixed set of rays about the normal, so shade varies smoothly over a face.
    const helper: vec3 = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const tangent = normalize(cross(helper, normal));
    const bitangent = cross(normal, tangent);
    // Off the face, and a hair toward its middle: a vertex on a contact line
    // would otherwise start its rays on the very plane that shades it.
    const inward = sub(center, point);
    const length = Math.hypot(...inward);
    const origin = add(add(point, scale(normal, 0.015)), length > 0.02 ? scale(inward, 0.01 / length) : [0, 0, 0]);
    let occluded = 0;
    for (const [x, y, z] of directions) {
      for (let axis = 0; axis < 3; axis++) direction[axis] = tangent[axis] * x + normal[axis] * y + bitangent[axis] * z;
      const hit = bvh.nearest(origin, direction, occlusion.reach);
      if (hit < occlusion.reach) occluded += 1 - hit / occlusion.reach;
    }
    return 1 - occlusion.strength * occluded / directions.length;
  }

  return sets.map((set, g) => {
    const shaded = !unshaded.has(geometries[g]);
    const mesh: MeshData = { positions: [], normals: [], colors: [], indices: [] };
    for (const patch of set) {
      const { nu, nv, hidden, points, normals } = patch;
      const emit = (index: number, ao: number) => {
        const [point, normal] = [points[index], normals[index]];
        const paint = typeof patch.paint === "function" ? patch.paint(point, normal) : patch.paint;
        mesh.positions.push(...point);
        mesh.normals.push(...normal);
        mesh.colors.push(...paint.map((value) => Math.min(Math.max(value * ao, 0), 1)));
      };
      if (patch.polygon) {
        if (hidden[0]) continue;
        const start = mesh.positions.length / 3;
        points.forEach((point, index) => emit(index, shaded ? shade(point, normals[index], patch.center) : 1));
        for (let i = 2; i < points.length; i++) mesh.indices.push(start, start + i - 1, start + i);
        continue;
      }
      const cellHidden = (i: number, j: number) => hidden[j * nu + i];
      const visible = (i: number, j: number) => [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]].some(([ci, cj]) =>
        ci >= 0 && cj >= 0 && ci < nu && cj < nv && !cellHidden(ci, cj));
      const shades = new Map<number, number>();
      const shadeAt = (i: number, j: number) => {
        if (!visible(i, j)) return null;
        const index = j * (nu + 1) + i;
        let value = shades.get(index);
        if (value === undefined) shades.set(index, value = shaded ? shade(points[index], normals[index], patch.center) : 1);
        return value;
      };
      const us = lines(nu, nv, shadeAt, (i) => Array.from({ length: nv }, (_, j) => cellHidden(i - 1, j) !== cellHidden(i, j)).some(Boolean), tolerance);
      const vs = lines(nv, nu, (j, i) => shadeAt(i, j), (j) => Array.from({ length: nu }, (_, i) => cellHidden(i, j - 1) !== cellHidden(i, j)).some(Boolean), tolerance);
      const remap = new Map<number, number>();
      const vertex = (i: number, j: number) => {
        const index = j * (nu + 1) + i;
        let target = remap.get(index);
        if (target === undefined) {
          target = mesh.positions.length / 3;
          remap.set(index, target);
          emit(index, shadeAt(i, j) ?? 1);
        }
        return target;
      };
      for (let l = 0; l < vs.length - 1; l++) for (let k = 0; k < us.length - 1; k++) {
        const [i0, i1, j0, j1] = [us[k], us[k + 1], vs[l], vs[l + 1]];
        // Hidden-cell edges are kept lines, so a coarse cell is all hidden or all shown.
        if (cellHidden(i0, j0)) continue;
        const [a, b, c, d] = [vertex(i0, j0), vertex(i1, j0), vertex(i1, j1), vertex(i0, j1)];
        mesh.indices.push(a, b, c, a, c, d);
      }
    }
    return mesh;
  });
}
