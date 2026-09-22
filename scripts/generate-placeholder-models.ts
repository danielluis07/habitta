import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Document, type Material, type Node, type vec3 } from "@gltf-transform/core";
import { EXTMeshoptCompression } from "@gltf-transform/extensions";
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

  quad(a: vec3, b: vec3, c: vec3, d: vec3) {
    const u = b.map((v, i) => v - a[i]);
    const v = c.map((value, i) => value - a[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n);
    const start = this.positions.length / 3;
    for (const point of [a, b, c, d]) {
      this.positions.push(...point);
      this.normals.push(...n.map((value) => value / length));
    }
    this.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
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

function attach(document: Document, parent: Node, name: string, geometry: Geometry, surface: Material) {
  if (!geometry.indices.length) return;
  const buffer = document.getRoot().listBuffers()[0];
  const positions = document.createAccessor().setType("VEC3").setArray(new Float32Array(geometry.positions)).setBuffer(buffer);
  const normals = document.createAccessor().setType("VEC3").setArray(new Float32Array(geometry.normals)).setBuffer(buffer);
  const indices = document.createAccessor().setType("SCALAR").setArray(new Uint32Array(geometry.indices)).setBuffer(buffer);
  const mesh = document.createMesh(name).addPrimitive(document.createPrimitive()
    .setAttribute("POSITION", positions).setAttribute("NORMAL", normals).setIndices(indices).setMaterial(surface));
  parent.addChild(document.createNode(name).setMesh(mesh));
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
  const recess = new Geometry();
  let roofSignZ = 0;

  if (concept.slug === "crest") {
    body.box([0, 21, -2], [18, 42, 16]);
    // Twelve readable levels, recessed south loggias and pale vertical piers.
    for (let floor = 0; floor < 12; floor++) {
      trim.box([0, floor * 3.5 + 0.15, 1], [19, 0.3, 23]);
      recess.box([0, floor * 3.5 + 1.9, 6.05], [16, 2.6, 0.1]);
      trim.box([0, floor * 3.5 + 0.85, 11.5], [19, 1.1, 0.5]);
    }
    for (const x of [-9, -3, 3, 9]) trim.box([x, 21, 11.5], [0.6, 42, 1]);
  } else if (concept.slug === "contour") {
    // Four occupied levels with south terraces; each upper level recedes north.
    for (let floor = 0; floor < 4; floor++) {
      const depth = 38 - floor * 7;
      const south = -19 + depth;
      body.box([0, floor * 3.5 + 1.75, -19 + depth / 2], [46, 3.5, depth]);
      trim.box([0, floor * 3.5 + 0.2, south + 1], [47, 0.4, 2]);
      recess.box([0, floor * 3.5 + 1.9, south + 0.05], [42, 2.2, 0.1]);
    }
    roofSignZ = -10;
  } else {
    // Two-storey ring, with a genuinely open central court.
    for (const x of [-18, 18]) body.box([x, 3.5, 0], [10, 7, 38]);
    for (const z of [-14, 14]) body.box([0, 3.5, z], [26, 7, 10]);
    for (const x of [-18, 18]) trim.box([x, 0.6, 0], [10.1, 1.2, 38.1]);
    for (const z of [-14, 14]) trim.box([0, 0.6, z], [26, 1.2, 10.1]);
    for (let floor = 0; floor < 2; floor++) {
      for (const x of [-18, -9, 0, 9, 18]) recess.box([x, floor * 3.5 + 2.1, 19.05], [3, 1.8, 0.1]);
    }
    roofSignZ = -14;
  }
  const colors = {
    crest: ["#E6E0D2", "#CFC7B6"],
    contour: ["#B8B1A5", "#CEC6B5"],
    grove: ["#E5DED0", "#C6AC88"],
  }[concept.slug];
  attach(document, root, `${concept.slug}_PLACEHOLDER_massing`, body, material(document, "Placeholder exterior", colors[0]));
  attach(document, root, `${concept.slug}_PLACEHOLDER_trim`, trim, material(document, "Placeholder mineral trim", colors[1]));
  attach(document, root, `${concept.slug}_PLACEHOLDER_openings`, recess, material(document, "Placeholder recessed openings", "#5E5850"));
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
  ribbon([[-100,50], [-20,20], [5,-30], [95,-55]].map(([x,z]) => [x,terrainHeight(z)+0.2,z]), 4);
  ribbon([[-48,21.3,-38], [-7.5,terrainHeight(-5)+0.25,-5]], 2);
  ribbon([[48,16.3,16], [-10,terrainHeight(0)+0.25,0]], 2);
  ribbon([[-21,9.3,52], [-20,terrainHeight(20)+0.25,20]], 2);
  attach(document, root, "connecting_lane_and_paths", paths, material(document, "Lane and paths", "#CFC7B6"));
  return root;
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
