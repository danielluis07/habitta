import { NodeIO } from "@gltf-transform/core";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { download, type SourceFile } from "@/scripts/cc0";
import { BVH, normalize, type MeshData, type vec3 } from "@/scripts/placeholder-models/geometry";
import { linear } from "@/scripts/placeholder-models/gltf";
import { smoothstep } from "@/scripts/placeholder-models/noise";

// The district's limestone rocks: a CC0 photoscanned boulder, decimated to a
// few dozen faces, with its colour and surface baked into small maps on the
// decimated mesh, so the normal map carries the scan's detail.

/** The scanned boulder: source, author and licence, with the MD5 Poly Haven publishes for each file. */
export const rockSource = {
  asset: "boulder_01",
  page: "https://polyhaven.com/a/boulder_01",
  authors: ["Rico Cilliers"],
  licence: "CC0 1.0",
  files: {
    gltf: { url: "https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/boulder_01/boulder_01_1k.gltf", md5: "26e2eef4a1f68c9557c65cd375b21d6c" },
    bin: { url: "https://dl.polyhaven.org/file/ph-assets/Models/gltf/8k/boulder_01/boulder_01.bin", md5: "27a19fa031d8b4c3a09261f19c444dc5" },
    color: { url: "https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/boulder_01/boulder_01_diff_1k.jpg", md5: "25f8a843f13369d56d37f49db05ea8c3" },
    normal: { url: "https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/boulder_01/boulder_01_nor_gl_1k.jpg", md5: "0c4da644d901144b53e4fe2446f3c389" },
    surface: { url: "https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/boulder_01/boulder_01_arm_1k.jpg", md5: "d632159982cc3121ed3d69b89a122146" },
  } satisfies Record<string, SourceFile>,
};

/** The scan's size, in metres, as it stands in the district: about the old placeholder's, half sunk. */
const size = { length: 2.4, base: -0.45 };
/** The near and the far rock: faces, and the size of their baked maps in pixels. */
export const rockDetail = { near: { faces: 128, mapSize: 512 }, far: { faces: 36, mapSize: 128 } };
/** How much of the scan's own colour variation survives the tint to limestone. */
const tint = { token: "#B8B1A3", contrast: 1.05, chroma: 0.25 };

type Scan = {
  positions: Float64Array;
  normals: Float64Array;
  uvs: Float64Array;
  indices: Uint32Array;
  color: Image;
  normal: Image;
  occlusion: Image;
};
type Image = { data: Buffer; width: number; height: number; channels: number };

async function image(bytes: Buffer): Promise<Image> {
  const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/** Bilinear, wrapping, in 0–1 per channel. */
function sample(map: Image, u: number, v: number, out: number[]) {
  const x = u * map.width - 0.5;
  const y = v * map.height - 0.5;
  const [x0, y0] = [Math.floor(x), Math.floor(y)];
  const [fx, fy] = [x - x0, y - y0];
  const wrap = (value: number, limit: number) => ((value % limit) + limit) % limit;
  for (let c = 0; c < 3; c++) out[c] = 0;
  for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const index = (wrap(y0 + dy, map.height) * map.width + wrap(x0 + dx, map.width)) * map.channels;
    for (let c = 0; c < 3; c++) out[c] += map.data[index + c] / 255 * w;
  }
  return out;
}

/** The scan, turned so its longest side runs east–west, scaled and sunk to stand in the district. */
async function scan(): Promise<Scan> {
  const files = rockSource.files;
  const [gltf, bin, color, normal, surface] = await Promise.all([files.gltf, files.bin, files.color, files.normal, files.surface].map(download));
  const json = JSON.parse(gltf.toString("utf8"));
  const document = await new NodeIO().readJSON({ json: { ...json, images: [], textures: [], materials: [] }, resources: { [json.buffers[0].uri]: new Uint8Array(bin) } });
  const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
  const source = primitive.getAttribute("POSITION")!.getArray()!;
  const sourceNormals = primitive.getAttribute("NORMAL")!.getArray()!;
  const [min, max] = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (let i = 0; i < source.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], source[i + k]);
    max[k] = Math.max(max[k], source[i + k]);
  }
  // The scan's longest side is its Z; a quarter turn about Y lays it along X.
  const scale = size.length / (max[2] - min[2]);
  const center = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  const positions = new Float64Array(source.length);
  const normals = new Float64Array(source.length);
  for (let i = 0; i < source.length; i += 3) {
    const [x, y, z] = [source[i] - center[0], source[i + 1] - center[1], source[i + 2] - center[2]];
    positions.set([z * scale, y * scale + size.base, -x * scale], i);
    normals.set(normalize([sourceNormals[i + 2], sourceNormals[i + 1], -sourceNormals[i]]), i);
  }
  return {
    positions, normals,
    uvs: Float64Array.from(primitive.getAttribute("TEXCOORD_0")!.getArray()!),
    indices: Uint32Array.from(primitive.getIndices()!.getArray()!),
    color: await image(color), normal: await image(normal), occlusion: await image(surface),
  };
}

/** The scan's positions, welded, so decimation sees one surface rather than its UV islands. */
function welded(scan: Scan) {
  const index = new Map<string, number>();
  const positions: number[] = [];
  const normals: number[] = [];
  const remap = new Uint32Array(scan.positions.length / 3);
  for (let i = 0; i < remap.length; i++) {
    const key = `${scan.positions[i * 3]},${scan.positions[i * 3 + 1]},${scan.positions[i * 3 + 2]}`;
    let target = index.get(key);
    if (target === undefined) {
      target = positions.length / 3;
      index.set(key, target);
      positions.push(scan.positions[i * 3], scan.positions[i * 3 + 1], scan.positions[i * 3 + 2]);
      normals.push(0, 0, 0);
    }
    for (let k = 0; k < 3; k++) normals[target * 3 + k] += scan.normals[i * 3 + k];
    remap[i] = target;
  }
  return { positions: new Float32Array(positions), normals, indices: scan.indices.map((i) => remap[i]) };
}

type Low = { positions: vec3[]; normals: vec3[]; triangles: [number, number, number][] };

/** The welded scan, decimated to about `faces` triangles, with smooth normals from the scan's. */
function decimate(weld: ReturnType<typeof welded>, faces: number): Low {
  const [indices] = MeshoptSimplifier.simplify(weld.indices, weld.positions, 3, faces * 3, 1);
  const used = [...new Set(indices)];
  const local = new Map(used.map((index, i) => [index, i]));
  const positions = used.map((i): vec3 => [weld.positions[i * 3], weld.positions[i * 3 + 1], weld.positions[i * 3 + 2]]);
  // Each kept vertex takes the face normals around it, so the low mesh shades as its own shape.
  const normals = positions.map((): vec3 => [0, 0, 0]);
  const triangles: [number, number, number][] = [];
  for (let t = 0; t < indices.length; t += 3) {
    const triangle = [local.get(indices[t])!, local.get(indices[t + 1])!, local.get(indices[t + 2])!] as [number, number, number];
    triangles.push(triangle);
    const [a, b, c] = triangle.map((i) => positions[i]);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const i of triangle) for (let k = 0; k < 3; k++) normals[i][k] += n[k];
  }
  return { positions, normals: normals.map(normalize), triangles };
}

type Charted = { positions: vec3[]; normals: vec3[]; uvs: [number, number][]; indices: number[]; tangents: [number, number, number, number][] };

/**
 * UVs for the decimated rock: faces grouped into charts by the axis they face
 * most, each chart projected along its axis, and the charts packed in rows.
 */
function chart(low: Low, padding: number): Charted {
  const axisOf = (t: number) => {
    const [a, b, c] = low.triangles[t].map((i) => low.positions[i]);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const k = [0, 1, 2].reduce((best, axis) => Math.abs(n[axis]) > Math.abs(n[best]) ? axis : best, 0);
    return k * 2 + (n[k] < 0 ? 1 : 0);
  };
  const axes = low.triangles.map((_, t) => axisOf(t));
  // Faces sharing an edge and an axis join one chart.
  const edges = new Map<string, number[]>();
  low.triangles.forEach((triangle, t) => triangle.forEach((a, k) => {
    const b = triangle[(k + 1) % 3];
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    edges.set(key, [...(edges.get(key) ?? []), t]);
  }));
  const chartOf = new Int32Array(low.triangles.length).fill(-1);
  const charts: number[][] = [];
  for (let seed = 0; seed < low.triangles.length; seed++) {
    if (chartOf[seed] >= 0) continue;
    const members = [seed];
    chartOf[seed] = charts.length;
    for (let m = 0; m < members.length; m++) {
      const triangle = low.triangles[members[m]];
      triangle.forEach((a, k) => {
        const b = triangle[(k + 1) % 3];
        for (const other of edges.get(a < b ? `${a},${b}` : `${b},${a}`)!) {
          if (chartOf[other] < 0 && axes[other] === axes[seed]) {
            chartOf[other] = charts.length;
            members.push(other);
          }
        }
      });
    }
    charts.push(members);
  }
  // Project each chart along its axis.
  const projected = charts.map((members) => {
    const axis = axes[members[0]];
    const k = axis >> 1;
    const sign = axis & 1 ? -1 : 1;
    const [i, j] = [(k + 1) % 3, (k + 2) % 3];
    const vertices = new Map<number, [number, number]>();
    for (const t of members) for (const v of low.triangles[t]) {
      const p = low.positions[v];
      vertices.set(v, k === 1 ? [p[j] * sign, p[i]] : [p[i] * sign, -p[j]]);
    }
    const all = [...vertices.values()];
    const min = [Math.min(...all.map(([u]) => u)), Math.min(...all.map(([, v]) => v))];
    const max = [Math.max(...all.map(([u]) => u)), Math.max(...all.map(([, v]) => v))];
    for (const [v, [u, w]] of vertices) vertices.set(v, [u - min[0], w - min[1]]);
    return { members, vertices, width: max[0] - min[0], height: max[1] - min[1] };
  });
  // Shelf packing at the largest scale that fits, tallest charts first.
  const order = projected.map((_, i) => i).sort((a, b) => projected[b].height - projected[a].height);
  const pack = (scale: number) => {
    const places: [number, number][] = [];
    let [x, y, shelf] = [padding, padding, 0];
    for (const c of order) {
      const [w, h] = [projected[c].width * scale, projected[c].height * scale];
      if (x + w + padding > 1) [x, y, shelf] = [padding, y + shelf + padding, 0];
      places[c] = [x, y];
      x += w + padding;
      shelf = Math.max(shelf, h);
    }
    return y + shelf + padding <= 1 ? places : null;
  };
  let [low0, high0] = [0, 10];
  for (let step = 0; step < 40; step++) {
    const mid = (low0 + high0) / 2;
    if (pack(mid)) low0 = mid;
    else high0 = mid;
  }
  const places = pack(low0)!;
  const result: Charted = { positions: [], normals: [], uvs: [], indices: [], tangents: [] };
  projected.forEach(({ members, vertices }, c) => {
    const local = new Map<number, number>();
    for (const [v, [u, w]] of vertices) {
      local.set(v, result.positions.length);
      result.positions.push(low.positions[v]);
      result.normals.push(low.normals[v]);
      result.uvs.push([places[c][0] + u * low0, places[c][1] + w * low0]);
    }
    for (const t of members) result.indices.push(...low.triangles[t].map((v) => local.get(v)!));
  });
  // glTF tangents, so the normal map needs no runtime-generated frame: +X
  // along U, and the bitangent (the normal × tangent, times W) against V.
  const [us, vs] = [result.positions.map((): vec3 => [0, 0, 0]), result.positions.map((): vec3 => [0, 0, 0])];
  for (let t = 0; t < result.indices.length; t += 3) {
    const corners = result.indices.slice(t, t + 3);
    const { gu, gv } = gradients(corners.map((i) => result.positions[i]), corners.map((i) => result.uvs[i]));
    for (const i of corners) for (let k = 0; k < 3; k++) [us[i][k], vs[i][k]] = [us[i][k] + gu[k], vs[i][k] + gv[k]];
  }
  result.tangents = result.normals.map((n, i) => {
    const tangent = normalize(sub(us[i], n.map((value) => value * dot(us[i], n)) as vec3));
    return [...tangent, dot(cross(n, tangent), vs[i]) > 0 ? -1 : 1];
  });
  return result;
}

const sub = (a: vec3, b: vec3): vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: vec3, b: vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: vec3, b: vec3): vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** How U and V change across a triangle's plane. */
function gradients(p: vec3[], uv: [number, number][]) {
  const [e1, e2] = [sub(p[1], p[0]), sub(p[2], p[0])];
  const [du1, dv1, du2, dv2] = [uv[1][0] - uv[0][0], uv[1][1] - uv[0][1], uv[2][0] - uv[0][0], uv[2][1] - uv[0][1]];
  const n = cross(e1, e2);
  const [p1, p2] = [cross(e2, n), cross(n, e1)];
  const area = dot(n, n) || 1;
  const gu: vec3 = [0, 1, 2].map((k) => (p1[k] * du1 + p2[k] * du2) / area) as vec3;
  const gv: vec3 = [0, 1, 2].map((k) => (p1[k] * dv1 + p2[k] * dv2) / area) as vec3;
  return { gu, gv };
}

/**
 * Bakes the scan onto the charted low mesh. Each texel casts a ray along the
 * low surface's normal to the scan and takes the scan's colour, occlusion and
 * normal there (its own normal map included), the normal re-expressed in the
 * low mesh's tangent frame, as its tangents define it.
 */
function bakeMaps(scan: Scan, low: Charted, size: number) {
  const soup = new Float64Array(scan.indices.length * 3);
  scan.indices.forEach((vertex, i) => soup.set(scan.positions.subarray(vertex * 3, vertex * 3 + 3), i * 3));
  const bvh = new BVH(soup, Infinity);
  const color = new Float64Array(size * size * 3);
  const normal = new Float64Array(size * size * 3);
  const filled = new Uint8Array(size * size);
  const hit = { triangle: 0, u: 0, v: 0 };
  const [c, n, o] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const reach = 0.3;
  const scanVertex = (t: number, k: number) => scan.indices[t * 3 + k];
  const scanPoint = (v: number): vec3 => [scan.positions[v * 3], scan.positions[v * 3 + 1], scan.positions[v * 3 + 2]];

  for (let t = 0; t < low.indices.length; t += 3) {
    const corners = [low.indices[t], low.indices[t + 1], low.indices[t + 2]];
    const p = corners.map((i) => low.positions[i]);
    const nn = corners.map((i) => low.normals[i]);
    const uv = corners.map((i) => low.uvs[i]);
    const tangents = corners.map((i) => low.tangents[i]);
    const px = uv.map(([u, v]) => [u * size, v * size]);
    const [x0, x1] = [Math.floor(Math.min(...px.map(([x]) => x))) - 1, Math.ceil(Math.max(...px.map(([x]) => x))) + 1];
    const [y0, y1] = [Math.floor(Math.min(...px.map(([, y]) => y))) - 1, Math.ceil(Math.max(...px.map(([, y]) => y))) + 1];
    const area = (px[1][0] - px[0][0]) * (px[2][1] - px[0][1]) - (px[2][0] - px[0][0]) * (px[1][1] - px[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = Math.max(y0, 0); y <= Math.min(y1, size - 1); y++) for (let x = Math.max(x0, 0); x <= Math.min(x1, size - 1); x++) {
      // Barycentrics of the texel centre, a little past the edges so texels on them are filled too.
      const [sx, sy] = [x + 0.5, y + 0.5];
      const w1 = ((sx - px[0][0]) * (px[2][1] - px[0][1]) - (px[2][0] - px[0][0]) * (sy - px[0][1])) / area;
      const w2 = ((px[1][0] - px[0][0]) * (sy - px[0][1]) - (sx - px[0][0]) * (px[1][1] - px[0][1])) / area;
      const w0 = 1 - w1 - w2;
      const margin = -0.02;
      if (w0 < margin || w1 < margin || w2 < margin || filled[y * size + x]) continue;
      const point = [0, 1, 2].map((k) => w0 * p[0][k] + w1 * p[1][k] + w2 * p[2][k]) as vec3;
      const surface = normalize([0, 1, 2].map((k) => w0 * nn[0][k] + w1 * nn[1][k] + w2 * nn[2][k]) as vec3);
      // From outside the scan inward, keeping the hit nearest the low surface.
      const origin: vec3 = [point[0] + surface[0] * reach, point[1] + surface[1] * reach, point[2] + surface[2] * reach];
      if (bvh.nearest(origin, [-surface[0], -surface[1], -surface[2]], reach * 2, hit) === Infinity) continue;
      const tri = hit.triangle;
      const [b1, b2] = [hit.u, hit.v];
      const b0 = 1 - b1 - b2;
      const vs = [scanVertex(tri, 0), scanVertex(tri, 1), scanVertex(tri, 2)];
      const suv = vs.map((v) => [scan.uvs[v * 2], scan.uvs[v * 2 + 1]] as [number, number]);
      const [su, sv] = [b0 * suv[0][0] + b1 * suv[1][0] + b2 * suv[2][0], b0 * suv[0][1] + b1 * suv[1][1] + b2 * suv[2][1]];
      const sn = normalize([0, 1, 2].map((k) => b0 * scan.normals[vs[0] * 3 + k] + b1 * scan.normals[vs[1] * 3 + k] + b2 * scan.normals[vs[2] * 3 + k]) as vec3);
      // The scan's normal map, in its own tangent frame (glTF: +X along U, +Y against V).
      const frame = gradients(vs.map(scanPoint), suv);
      const st = normalize(sub(frame.gu, sn.map((value) => value * dot(frame.gu, sn)) as vec3));
      const up: vec3 = frame.gv.map((value) => -value) as vec3;
      const sb = normalize(sub(sub(up, sn.map((value) => value * dot(up, sn)) as vec3), st.map((value) => value * dot(up, st)) as vec3));
      sample(scan.normal, su, sv, n);
      const [nx, ny, nz] = [n[0] * 2 - 1, n[1] * 2 - 1, n[2] * 2 - 1];
      const world = normalize([0, 1, 2].map((k) => st[k] * nx + sb[k] * ny + sn[k] * nz) as vec3);
      // In the low mesh's frame, as its tangents set it at this texel.
      const along = [0, 1, 2].map((k) => w0 * tangents[0][k] + w1 * tangents[1][k] + w2 * tangents[2][k]) as vec3;
      const tangent = normalize(sub(along, surface.map((value) => value * dot(along, surface)) as vec3));
      const bitangent = cross(surface, tangent).map((value) => value * tangents[0][3]) as vec3;
      const encoded = normalize([dot(world, tangent), dot(world, bitangent), Math.max(dot(world, surface), 0.05)]);
      sample(scan.color, su, sv, c);
      sample(scan.occlusion, su, sv, o);
      const index = y * size + x;
      for (let k = 0; k < 3; k++) {
        const value = c[k] <= 0.04045 ? c[k] / 12.92 : ((c[k] + 0.055) / 1.055) ** 2.4;
        // The scan's own occlusion (red of its ARM map) deepens its crevices.
        color[index * 3 + k] = value * (0.35 + 0.65 * o[0]);
        normal[index * 3 + k] = encoded[k];
      }
      filled[index] = 1;
    }
  }
  dilate(normal, filled.slice(), size);
  dilate(color, filled, size);
  return { color, normal };
}

/** Grows the charts' edges outward, so filtering and mipmaps never reach the empty texels between them. */
function dilate(values: Float64Array, filled: Uint8Array, size: number) {
  for (let pass = 0; pass < 12; pass++) {
    const next = filled.slice();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const index = y * size + x;
      if (filled[index]) continue;
      const sum = [0, 0, 0];
      let count = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const [nx, ny] = [x + dx, y + dy];
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || !filled[ny * size + nx]) continue;
        for (let k = 0; k < 3; k++) sum[k] += values[(ny * size + nx) * 3 + k];
        count++;
      }
      if (!count) continue;
      for (let k = 0; k < 3; k++) values[index * 3 + k] = sum[k] / count;
      next[index] = 1;
    }
    filled.set(next);
  }
  // Whatever is left takes the mean, so it never reads as a dark seam.
  const mean = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < size * size; i++) if (filled[i]) {
    for (let k = 0; k < 3; k++) mean[k] += values[i * 3 + k];
    count++;
  }
  for (let i = 0; i < size * size; i++) if (!filled[i]) for (let k = 0; k < 3; k++) values[i * 3 + k] = mean[k] / count;
}

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const toSRGB = (value: number) => Math.round(255 * Math.min(Math.max(value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055, 0), 1));

/** The colour map tinted to limestone: its mean is the rock token, its hue close to it. */
function tinted(color: Float64Array) {
  const pixels = color.length / 3;
  const mean = [0, 0, 0];
  for (let i = 0; i < pixels; i++) for (let k = 0; k < 3; k++) mean[k] += color[i * 3 + k] / pixels;
  const meanLight = luminance(mean[0], mean[1], mean[2]);
  const token = linear(tint.token);
  const out = new Float64Array(color.length);
  for (let i = 0; i < pixels; i++) {
    const light = luminance(color[i * 3], color[i * 3 + 1], color[i * 3 + 2]) || 1e-4;
    for (let k = 0; k < 3; k++) {
      const hue = color[i * 3 + k] / mean[k] / (light / meanLight);
      out[i * 3 + k] = token[k] * (light / meanLight) ** tint.contrast * Math.max(hue, 0) ** tint.chroma;
    }
  }
  for (let pass = 0; pass < 4; pass++) {
    const now = [0, 0, 0];
    for (let i = 0; i < pixels; i++) for (let k = 0; k < 3; k++) now[k] += out[i * 3 + k] / pixels;
    for (let i = 0; i < pixels; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = Math.min(out[i * 3 + k] * token[k] / now[k], 1);
  }
  return out;
}

/** Contact shading in the vertex colours: the rock darkens toward the ground it is sunk in. */
function mesh(charted: Charted): MeshData {
  return {
    positions: charted.positions.flat(),
    normals: charted.normals.flat(),
    colors: charted.positions.flatMap(([, y]) => {
      const shade = 0.6 + 0.4 * smoothstep(size.base, size.base + 0.9, y);
      return [shade, shade, shade];
    }),
    uvs: charted.uvs.flat(),
    tangents: charted.tangents.flat(),
    indices: charted.indices,
  };
}

export type LimestoneRock = { mesh: MeshData; color: Uint8Array; normal: Uint8Array };

/**
 * The limestone rock at both levels of detail, each decimated from the scan
 * and baked into its own maps: the far rock's are much smaller.
 */
export async function limestoneRocks(): Promise<Record<keyof typeof rockDetail, LimestoneRock>> {
  await MeshoptSimplifier.ready;
  const source = await scan();
  const weld = welded(source);
  const bake = async ({ faces, mapSize }: { faces: number; mapSize: number }): Promise<LimestoneRock> => {
    const charted = chart(decimate(weld, faces), 3 / mapSize);
    const { color, normal } = bakeMaps(source, charted, mapSize);
    const encode = (values: Float64Array, srgb: boolean) => sharp(Buffer.from(Array.from(values, (value) => srgb ? toSRGB(value) : Math.round((value * 0.5 + 0.5) * 255))),
      { raw: { width: mapSize, height: mapSize, channels: 3 } }).jpeg({ quality: srgb ? 84 : 86, mozjpeg: true, chromaSubsampling: srgb ? "4:2:0" : "4:4:4" }).toBuffer();
    return { mesh: mesh(charted), color: new Uint8Array(await encode(tinted(color), true)), normal: new Uint8Array(await encode(normal, false)) };
  };
  return { near: await bake(rockDetail.near), far: await bake(rockDetail.far) };
}
