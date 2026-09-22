import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Document, type Material, type Node, type vec3 } from "@gltf-transform/core";
import { EXTMeshGPUInstancing, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { collection, type Concept } from "@/lib/collection";
import { modelIO } from "@/scripts/model-io";

// Development massing only. Both detail levels use these same definitions.
const plots = {
  crest: { origin: [-48, 21.2, -55], size: [30, 34] },
  contour: { origin: [48, 16.2, -8], size: [56, 48] },
  grove: { origin: [-48, 9.2, 52], size: [54, 48] },
} as const;
const placeholder = { placeholder: true, revision: "placeholder-r1", source: "scripts/generate-placeholder-models.ts" };
// The occupied district is one even slope, rising north. The plots, lane and
// paths sit on it; the landscape beyond blends out from its edge.
const terrainHeight = (z: number) => (100 - z) * 0.12;
const districtBounds = { halfWidth: 110, halfDepth: 100 };
const waterLevel = -64;

/** A material batch, with flat normals and indexed triangles. */
class Geometry {
  positions: number[] = [];
  normals: number[] = [];
  /** Optional linear vertex colours, one RGB triple per position. */
  colors: number[] = [];
  indices: number[] = [];

  /** A flat convex face; its winding sets the normal. */
  face(...points: vec3[]) {
    const [a, b, c] = points;
    const u = b.map((v, i) => v - a[i]);
    const v = c.map((value, i) => value - a[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n);
    const start = this.positions.length / 3;
    for (const point of points) {
      this.positions.push(...point);
      this.normals.push(...n.map((value) => value / length));
    }
    for (let i = 2; i < points.length; i++) this.indices.push(start, start + i - 1, start + i);
  }

  quad(a: vec3, b: vec3, c: vec3, d: vec3) {
    this.face(a, b, c, d);
  }

  /** A vertical double pyramid, the placeholder canopy. */
  spindle(center: vec3, radius: number, halfHeight: number, sides: number) {
    const [x, y, z] = center;
    const top: vec3 = [x, y + halfHeight, z];
    const bottom: vec3 = [x, y - halfHeight, z];
    const rim = Array.from({ length: sides }, (_, i): vec3 => {
      const angle = i / sides * Math.PI * 2;
      return [x + Math.cos(angle) * radius, y, z - Math.sin(angle) * radius];
    });
    rim.forEach((a, i) => {
      const b = rim[(i + 1) % sides];
      this.face(a, b, top);
      this.face(b, a, bottom);
    });
  }

  box(center: vec3, size: vec3) {
    const [x, y, z] = center;
    const [w, h, d] = size.map((value) => value / 2);
    this.quad([x-w,y-h,z+d], [x+w,y-h,z+d], [x+w,y+h,z+d], [x-w,y+h,z+d]);
    this.quad([x+w,y-h,z-d], [x-w,y-h,z-d], [x-w,y+h,z-d], [x+w,y+h,z-d]);
    this.quad([x+w,y-h,z+d], [x+w,y-h,z-d], [x+w,y+h,z-d], [x+w,y+h,z+d]);
    this.quad([x-w,y-h,z-d], [x-w,y-h,z+d], [x-w,y+h,z+d], [x-w,y+h,z-d]);
    this.quad([x-w,y+h,z+d], [x+w,y+h,z+d], [x+w,y+h,z-d], [x-w,y+h,z-d]);
    this.quad([x-w,y-h,z-d], [x+w,y-h,z-d], [x+w,y-h,z+d], [x-w,y-h,z+d]);
  }
}

// Design tokens are sRGB; glTF material factors and vertex colours are linear.
function linear(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
}

function material(document: Document, name: string, hex: string): Material {
  const rgb = linear(hex);
  return document.createMaterial(name).setBaseColorFactor([rgb[0], rgb[1], rgb[2], 1])
    .setMetallicFactor(0).setRoughnessFactor(0.9);
}

function floats(document: Document, type: "VEC3" | "VEC4", values: number[]) {
  const buffer = document.getRoot().listBuffers()[0];
  return document.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
}

function primitive(document: Document, geometry: Geometry, surface: Material) {
  const buffer = document.getRoot().listBuffers()[0];
  const indices = document.createAccessor().setType("SCALAR").setArray(new Uint32Array(geometry.indices)).setBuffer(buffer);
  const result = document.createPrimitive().setAttribute("POSITION", floats(document, "VEC3", geometry.positions))
    .setAttribute("NORMAL", floats(document, "VEC3", geometry.normals)).setIndices(indices).setMaterial(surface);
  return geometry.colors.length ? result.setAttribute("COLOR_0", floats(document, "VEC3", geometry.colors)) : result;
}

function attach(document: Document, parent: Node, name: string, geometry: Geometry, surface: Material) {
  if (!geometry.indices.length) return;
  parent.addChild(document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive(document, geometry, surface))));
}

/** One placement of a repeated prop: position, per-axis size and a turn about +Y. */
type Instance = { at: vec3; size?: vec3; turn?: number };

const unitBox = new Geometry();
unitBox.box([0, 0, 0], [1, 1, 1]);

// Repeated props are one mesh drawn through EXT_mesh_gpu_instancing, so each
// part costs one draw call however many times the prop appears.
function instanced(document: Document, parent: Node, name: string, parts: [Geometry, Material][], instances: Instance[]) {
  const mesh = document.createMesh(name);
  for (const [geometry, surface] of parts) mesh.addPrimitive(primitive(document, geometry, surface));
  const batch = document.createExtension(EXTMeshGPUInstancing).setRequired(true).createInstancedMesh()
    .setAttribute("TRANSLATION", floats(document, "VEC3", instances.flatMap(({ at }) => at)))
    .setAttribute("ROTATION", floats(document, "VEC4", instances.flatMap(({ turn = 0 }) => [0, Math.sin(turn / 2), 0, Math.cos(turn / 2)])))
    .setAttribute("SCALE", floats(document, "VEC3", instances.flatMap(({ size = [1, 1, 1] }) => size)));
  parent.addChild(document.createNode(name).setMesh(mesh).setExtension("EXT_mesh_gpu_instancing", batch));
}

// A small geometry-only roof sign: visible text and diagonal hatch, no textures.
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

function sign(document: Document, parent: Node, height: number, z: number) {
  const paper = new Geometry();
  const ink = new Geometry();
  paper.box([0, height + 0.06, z], [13, 0.12, 2.7]);
  for (const [letterIndex, letter] of [..."PLACEHOLDER"].entries()) {
    glyphs[letter].forEach((row, rowIndex) => [...row].forEach((pixel, column) => {
      if (pixel === "0") return;
      const x = -5.8 + letterIndex * 1.15 + column * 0.23;
      const depth = z - 0.9 + rowIndex * 0.23;
      ink.quad([x,height+0.13,depth+0.2], [x+0.2,height+0.13,depth+0.2], [x+0.2,height+0.13,depth], [x,height+0.13,depth]);
    }));
  }
  for (let x = -6; x < 6; x += 0.5) {
    ink.quad([x,height+0.13,z+1.2], [x+0.04,height+0.13,z+1.2], [x+0.34,height+0.13,z+0.85], [x+0.3,height+0.13,z+0.85]);
  }
  attach(document, parent, "PLACEHOLDER_sign", paper, material(document, "Placeholder paper", "#FBF9F5"));
  attach(document, parent, "PLACEHOLDER_text_and_hatch", ink, material(document, "Placeholder ink", "#5E5850"));
}

function building(document: Document, concept: Concept) {
  const { origin } = plots[concept.slug];
  const root = document.createNode(concept.scene.selectionTarget).setTranslation([...origin]).setExtras({ ...placeholder, concept: concept.slug });
  root.addChild(document.createNode(concept.scene.labelAnchor).setTranslation([0, concept.facts.heightM + 4, 0]));
  const body = new Geometry();
  const trim = new Geometry();
  // Facade openings and roof props repeat, so they are instanced.
  const openings: Instance[] = [];
  const roofProps: Instance[] = [];
  let roofSignZ = 0;

  if (concept.slug === "crest") {
    body.box([0, 21, -2], [18, 42, 16]);
    // Twelve readable levels, recessed south loggias and pale vertical piers.
    for (let floor = 0; floor < 12; floor++) {
      trim.box([0, floor * 3.5 + 0.15, 1], [19, 0.3, 23]);
      openings.push({ at: [0, floor * 3.5 + 1.9, 6.05], size: [16, 2.6, 0.1] });
      trim.box([0, floor * 3.5 + 0.85, 11.5], [19, 1.1, 0.5]);
    }
    for (const x of [-9, -3, 3, 9]) trim.box([x, 21, 11.5], [0.6, 42, 1]);
    for (const x of [-6, -2, 2, 6]) for (const z of [-7, 4]) roofProps.push({ at: [x, 42.4, z], size: [3, 0.8, 1.6] });
  } else if (concept.slug === "contour") {
    // Four occupied levels with south terraces; each upper level recedes north.
    for (let floor = 0; floor < 4; floor++) {
      const depth = 38 - floor * 7;
      const south = -19 + depth;
      body.box([0, floor * 3.5 + 1.75, -19 + depth / 2], [46, 3.5, depth]);
      trim.box([0, floor * 3.5 + 0.2, south + 1], [47, 0.4, 2]);
      openings.push({ at: [0, floor * 3.5 + 1.9, south + 0.05], size: [42, 2.2, 0.1] });
      // Planters line the terrace that each receding level leaves open.
      if (floor < 3) for (const x of [-18, -9, 0, 9, 18]) roofProps.push({ at: [x, floor * 3.5 + 3.9, south - 1.5], size: [5, 0.8, 1.2] });
    }
    roofSignZ = -10;
  } else {
    // Two-storey ring, with a genuinely open central court.
    for (const x of [-18, 18]) body.box([x, 3.5, 0], [10, 7, 38]);
    for (const z of [-14, 14]) body.box([0, 3.5, z], [26, 7, 10]);
    for (const x of [-18, 18]) trim.box([x, 0.6, 0], [10.1, 1.2, 38.1]);
    for (const z of [-14, 14]) trim.box([0, 0.6, z], [26, 1.2, 10.1]);
    for (let floor = 0; floor < 2; floor++) {
      for (const x of [-18, -9, 0, 9, 18]) openings.push({ at: [x, floor * 3.5 + 2.1, 19.05], size: [3, 1.8, 0.1] });
    }
    roofSignZ = -14;
    for (const x of [-18, 18]) for (const z of [-6, 2, 10]) roofProps.push({ at: [x, 7.3, z], size: [4, 0.6, 3] });
  }
  const colors = {
    crest: ["#E6E0D2", "#CFC7B6"],
    contour: ["#B8B1A5", "#CEC6B5"],
    grove: ["#E5DED0", "#C6AC88"],
  }[concept.slug];
  attach(document, root, `${concept.slug}_PLACEHOLDER_massing`, body, material(document, "Placeholder exterior", colors[0]));
  attach(document, root, `${concept.slug}_PLACEHOLDER_trim`, trim, material(document, "Placeholder mineral trim", colors[1]));
  instanced(document, root, `${concept.slug}_PLACEHOLDER_openings`, [[unitBox, material(document, "Placeholder recessed openings", "#5E5850")]], openings);
  instanced(document, root, `${concept.slug}_PLACEHOLDER_roof_props`, [[unitBox, material(document, "Placeholder roof planting", "#8C9780")]], roofProps);
  sign(document, root, concept.facts.heightM, roofSignZ);
  return root;
}

const smoothstep = (from: number, to: number, value: number) => {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

function hash(x: number, z: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Fractal value noise in [0, 1], with its largest features `wavelength` metres apart. */
function noise(x: number, z: number, wavelength: number, seed: number, octaves = 3) {
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
 * `extent`. Far enough that, from any camera the controls allow, the fog
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

/** The terrain as one smooth-shaded, vertex-coloured grid, and a lookup of its surface. */
function terrain() {
  const xs = gridLines(120, 3200);
  const zs = gridLines(120, 3200);
  const heights = zs.map((z) => xs.map((x) => groundHeight(x, z)));
  const ground = new Geometry();
  const [grass, dry, scrub, rock] = ["#A5AE95", "#B4B094", "#949D80", "#B8B1A3"].map(linear);
  const mix = (a: number[], b: number[], t: number) => a.map((value, i) => value + (b[i] - value) * t);
  const slope = (lines: number[], values: number[], i: number) => {
    const [a, b] = [Math.max(i - 1, 0), Math.min(i + 1, lines.length - 1)];
    return (values[b] - values[a]) / (lines[b] - lines[a]);
  };

  zs.forEach((z, j) => xs.forEach((x, i) => {
    const y = heights[j][i];
    const normal = [-slope(xs, heights[j], i), 1, -slope(zs, heights.map((row) => row[i]), j)];
    const length = Math.hypot(...normal);
    ground.positions.push(x, y, z);
    ground.normals.push(...normal.map((value) => value / length));
    // Dry grass and scrub in patches, bare rock where the ground is steep or high.
    let color = mix(grass, dry, smoothstep(0.45, 0.62, noise(x, z, 110, 5)));
    color = mix(color, scrub, smoothstep(0.55, 0.72, noise(x, z, 70, 9)));
    color = mix(color, rock, Math.max(smoothstep(0.93, 0.8, 1 / length), smoothstep(160, 260, y)));
    ground.colors.push(...color);
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
  return { ground, surface };
}

function district(document: Document): Node {
  const root = document.createNode("district_PLACEHOLDER_landscape").setExtras(placeholder);
  const { ground, surface } = terrain();
  attach(document, root, "terrain_highland_to_horizon", ground, material(document, "Highland ground", "#FFFFFF"));
  // The lake fills the valley floor wherever the ground dips below the water.
  const lake = new Geometry();
  lake.face(...Array.from({ length: 32 }, (_, i): vec3 => {
    const angle = i / 32 * Math.PI * 2;
    return [Math.cos(angle) * 700, waterLevel, 850 - Math.sin(angle) * 600];
  }));
  attach(document, root, "lake_south_valley", lake, material(document, "Lake", "#9EB3B7").setRoughnessFactor(0.45));
  const benches = new Geometry();
  for (const { origin: [x,y,z], size: [w,d] } of Object.values(plots)) benches.box([x,y-4,z], [w,8,d]);
  attach(document, root, "separate_plot_benches", benches, material(document, "Plot stone", "#CFC7B6"));
  const paths = new Geometry();
  function ribbon(points: vec3[], width: number) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i-1];
      const b = points[i];
      const length = Math.hypot(b[0]-a[0], b[2]-a[2]);
      const dx = -(b[2]-a[2]) / length * width / 2;
      const dz = (b[0]-a[0]) / length * width / 2;
      paths.quad([a[0]+dx,a[1],a[2]+dz], [b[0]+dx,b[1],b[2]+dz], [b[0]-dx,b[1],b[2]-dz], [a[0]-dx,a[1],a[2]-dz]);
    }
  }
  const lane = ([[-100,50], [-20,20], [5,-30], [95,-55]] as const).map(([x,z]): vec3 => [x,terrainHeight(z)+0.2,z]);
  const plotPaths: vec3[][] = [
    [[-48,21.3,-38], [-7.5,terrainHeight(-5)+0.25,-5]],
    [[48,16.3,16], [-10,terrainHeight(0)+0.25,0]],
    [[-21,9.3,52], [-20,terrainHeight(20)+0.25,20]],
  ];
  // Past the district the lane runs on across the landscape, draped on the ground.
  const onward = ([
    [[-100,50], [-170,95], [-240,170], [-290,280], [-300,420]],
    [[95,-55], [170,-80], [270,-95], [400,-140], [560,-170]],
  ] as const).map((route) => route.slice(1).flatMap(([x, z], i): vec3[] => {
    const [fromX, fromZ] = route[i];
    const steps = Math.ceil(Math.hypot(x - fromX, z - fromZ) / 10);
    return Array.from({ length: steps + (i === 0 ? 1 : 0) }, (_, step): vec3 => {
      const t = (step + (i === 0 ? 0 : 1)) / steps;
      const [px, pz] = [fromX + (x - fromX) * t, fromZ + (z - fromZ) * t];
      return [px, surface(px, pz) + 0.25, pz];
    });
  }));
  ribbon(lane, 4);
  for (const points of onward) ribbon(points, 4);
  for (const points of plotPaths) ribbon(points, 2);
  attach(document, root, "connecting_lane_and_paths", paths, material(document, "Lane and paths", "#CFC7B6"));

  const onPlot = (x: number, z: number, margin: number) => Object.values(plots).some(({ origin: [px,,pz], size: [w,d] }) =>
    Math.abs(x - px) < w / 2 + margin && Math.abs(z - pz) < d / 2 + margin);
  const onRoute = (x: number, z: number, margin: number) => [lane, ...plotPaths].some((points) =>
    points.slice(1).some((b, i) => distanceToSegment(x, z, points[i], b) < margin));

  // Lane lights stand every 16 m on one side of the lane, heads over it.
  const lights: Instance[] = [];
  lane.slice(1).forEach((b, i) => {
    const a = lane[i];
    const length = Math.hypot(b[0]-a[0], b[2]-a[2]);
    const [nx, nz] = [-(b[2]-a[2]) / length, (b[0]-a[0]) / length];
    for (let t = 8; t < length; t += 16) {
      const x = a[0] + (b[0]-a[0]) * t / length + nx * 3.5;
      const z = a[2] + (b[2]-a[2]) * t / length + nz * 3.5;
      if (!onPlot(x, z, 1) && !onRoute(x, z, 1.5)) lights.push({ at: [x, terrainHeight(z), z], turn: Math.atan2(nz, -nx) });
    }
  });
  const light = new Geometry();
  light.box([0, 2.25, 0], [0.18, 4.5, 0.18]);
  light.box([0.4, 4.45, 0], [0.9, 0.18, 0.3]);
  instanced(document, root, "street_lights_instanced", [[light, material(document, "Bronze", "#8A7457")]], lights);

  // Trees scatter over the open slopes, clear of plots, the lane and paths.
  const trees: Instance[] = [];
  const next = seeded(24);
  for (let attempt = 0; attempt < 4000 && trees.length < 48; attempt++) {
    const x = -104 + next() * 208;
    const z = -94 + next() * 188;
    if (onPlot(x, z, 4) || onRoute(x, z, 4) || trees.some(({ at }) => Math.hypot(at[0] - x, at[2] - z) < 6)) continue;
    const scale = 0.75 + next() * 0.5;
    trees.push({ at: [x, terrainHeight(z), z], size: [scale, scale * (0.85 + next() * 0.35), scale], turn: next() * Math.PI });
  }

  // Beyond the district, groves of trees, cypresses and scrub thin out into
  // the haze. They keep clear of the water and the onward lane.
  const scrub: Instance[] = [];
  const cypresses: Instance[] = [];
  const wild = seeded(37);
  const nearDistrict = (x: number, z: number) =>
    Math.abs(x) < districtBounds.halfWidth + 6 && Math.abs(z) < districtBounds.halfDepth + 6;
  const nearOnward = (x: number, z: number) => onward.some((points) =>
    points.slice(1).some((b, i) => distanceToSegment(x, z, points[i], b) < 5));
  for (let attempt = 0; attempt < 30000 && scrub.length + cypresses.length + trees.length < 1400; attempt++) {
    const angle = wild() * Math.PI * 2;
    const radius = 125 + wild() ** 1.6 * 750;
    const [x, z] = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    const y = surface(x, z);
    const kind = wild();
    const scale = 0.8 + wild() * 0.6;
    if (noise(x, z, 120, 21) < 0.45 || nearDistrict(x, z) || y < waterLevel + 2 || nearOnward(x, z)) continue;
    const at: vec3 = [x, y - 0.3, z];
    const turn = wild() * Math.PI;
    if (kind < 0.6) scrub.push({ at, size: [scale * 2, scale * 1.4, scale * 2], turn });
    else if (kind < 0.85) trees.push({ at, size: [scale, scale * (0.85 + wild() * 0.35), scale], turn });
    else cypresses.push({ at, size: [scale, scale * (0.9 + wild() * 0.4), scale], turn });
  }

  const trunk = new Geometry();
  trunk.box([0, 1.5, 0], [0.5, 3, 0.5]);
  const canopy = new Geometry();
  canopy.spindle([0, 6, 0], 2.2, 3.8, 6);
  instanced(document, root, "vegetation_trees_instanced", [
    [trunk, material(document, "Bark", "#7A6A55")],
    [canopy, material(document, "Planting", "#7C8A6C")],
  ], trees);
  const cypress = new Geometry();
  cypress.spindle([0, 5, 0], 1, 5.2, 5);
  instanced(document, root, "vegetation_cypress_instanced", [[cypress, material(document, "Cypress", "#5F6E57")]], cypresses);
  const bush = new Geometry();
  bush.spindle([0, 0.3, 0], 1.2, 0.9, 5);
  instanced(document, root, "vegetation_scrub_instanced", [[bush, material(document, "Scrub", "#76826A")]], scrub);
  return root;
}

function distanceToSegment(x: number, z: number, a: vec3, b: vec3) {
  const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
}

/** A small deterministic generator (mulberry32), so regeneration is reproducible. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function generatePlaceholderModels(publicDirectory = resolve(import.meta.dir, "../public")) {
  const io = await modelIO();
  await mkdir(resolve(publicDirectory, "models"), { recursive: true });
  for (const selected of [null, ...collection]) {
    const document = new Document();
    document.getRoot().getAsset().generator = "Habitta PLACEHOLDER massing generator";
    document.getRoot().setExtras({ ...placeholder, units: "metres", north: "-Z", up: "+Y", east: "+X" });
    document.createBuffer();
    const scene = document.createScene("Habitta PLACEHOLDER district").setExtras(placeholder);
    document.getRoot().setDefaultScene(scene);
    if (!selected) scene.addChild(district(document));
    for (const concept of selected ? [selected] : collection) scene.addChild(building(document, concept));
    document.createExtension(EXTMeshoptCompression).setRequired(true);
    const url = selected ? selected.scene.detailedModel : "/models/district-low.glb";
    await io.write(resolve(publicDirectory, url.slice(1)), document);
  }
}

if (import.meta.main) {
  await generatePlaceholderModels();
  console.log("Generated four Meshopt-compressed PLACEHOLDER GLBs in public/models/.");
}
