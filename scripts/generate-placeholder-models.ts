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
const placeholder = { placeholder: true, revision: "placeholder-r0", source: "scripts/generate-placeholder-models.ts" };
const terrainHeight = (z: number) => (100 - z) * 0.12;

/** A material batch, with flat normals and indexed triangles. */
class Geometry {
  positions: number[] = [];
  normals: number[] = [];
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

function material(document: Document, name: string, hex: string): Material {
  // Design tokens are sRGB; glTF material factors are linear.
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
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
  return document.createPrimitive().setAttribute("POSITION", floats(document, "VEC3", geometry.positions))
    .setAttribute("NORMAL", floats(document, "VEC3", geometry.normals)).setIndices(indices).setMaterial(surface);
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

function district(document: Document): Node {
  const root = document.createNode("district_PLACEHOLDER_landscape").setExtras(placeholder);
  const terrain = new Geometry();
  terrain.quad([-110,0,100], [110,0,100], [110,24,-100], [-110,24,-100]);
  attach(document, root, "terrain_north_uphill", terrain, material(document, "Dry grass", "#A5AE95"));
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
  ribbon(lane, 4);
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
  const trunk = new Geometry();
  trunk.box([0, 1.5, 0], [0.5, 3, 0.5]);
  const canopy = new Geometry();
  canopy.spindle([0, 6, 0], 2.2, 3.8, 6);
  instanced(document, root, "vegetation_trees_instanced", [
    [trunk, material(document, "Bark", "#7A6A55")],
    [canopy, material(document, "Planting", "#7C8A6C")],
  ], trees);
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
