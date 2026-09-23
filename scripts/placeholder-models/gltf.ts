import type { Document, Material, Node } from "@gltf-transform/core";
import { EXTMeshGPUInstancing } from "@gltf-transform/extensions";
import { layerAttribute } from "@/components/district-scene/ground";
import type { MeshData, vec3 } from "@/scripts/placeholder-models/geometry";

// Design tokens are sRGB; glTF material factors and vertex colours are linear.
export function linear(hex: string): vec3 {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return [r, g, b];
}

type Finish = { name: string; color: string; roughness: number; metallic?: number; blend?: boolean };

/**
 * The PBR finishes of the placeholder district, one material each. Building
 * finishes carry their colour here and take baked shading from vertex
 * colours. "Painted" finishes are white and take their colour, too, from
 * the vertices, so one draw can hold a whole prop.
 */
export const finishes = {
  limestone: { name: "Warm limestone", color: "#E4DCCB", roughness: 0.8 },
  stone: { name: "Rubble stone", color: "#BAAB92", roughness: 0.95 },
  plaster: { name: "Chalk plaster", color: "#EFEAE0", roughness: 0.9 },
  oak: { name: "Pale oak", color: "#C6A57E", roughness: 0.65 },
  bronze: { name: "Dark bronze", color: "#6E5842", roughness: 0.38, metallic: 0.75 },
  glass: { name: "Glass", color: "#C7D5DA", roughness: 0.05 },
  concrete: { name: "Board-textured concrete", color: "#BBB7AF", roughness: 0.88 },
  timber: { name: "Oiled timber", color: "#9C7452", roughness: 0.7 },
  render: { name: "Lime render", color: "#EAE1D2", roughness: 0.95 },
  brick: { name: "Buff brick", color: "#CFB28B", roughness: 0.9 },
  tile: { name: "Clay tile", color: "#A87660", roughness: 0.8 },
  paving: { name: "Stone paving", color: "#D8CFBE", roughness: 0.9 },
  planting: { name: "Planting", color: "#FFFFFF", roughness: 0.95 },
  sign: { name: "Placeholder sign", color: "#FFFFFF", roughness: 0.9 },
  ground: { name: "Highland ground", color: "#FFFFFF", roughness: 0.95 },
  lake: { name: "Lake", color: "#9EB3B7", roughness: 0.45 },
  plot: { name: "Plot ground and retaining walls", color: "#FFFFFF", roughness: 0.95 },
  lane: { name: "Lane paving and kerbs", color: "#FFFFFF", roughness: 0.92 },
  olive: { name: "Olive", color: "#FFFFFF", roughness: 0.9 },
  cypress: { name: "Cypress", color: "#FFFFFF", roughness: 0.9 },
  scrub: { name: "Scrub", color: "#FFFFFF", roughness: 0.95 },
  rock: { name: "Limestone rock", color: "#FFFFFF", roughness: 0.92 },
  wall: { name: "Dry-stone wall", color: "#FFFFFF", roughness: 0.95 },
  shade: { name: "Contact shade", color: "#000000", roughness: 1, blend: true },
} satisfies Record<string, Finish>;

export type FinishName = keyof typeof finishes;

/** One material per finish per document. */
export function materials(document: Document) {
  const cache = new Map<FinishName, Material>();
  return (finish: FinishName) => {
    let material = cache.get(finish);
    if (!material) {
      const spec: Finish = finishes[finish];
      const [r, g, b] = linear(spec.color);
      material = document.createMaterial(spec.name).setBaseColorFactor([r, g, b, 1])
        .setMetallicFactor(spec.metallic ?? 0).setRoughnessFactor(spec.roughness);
      if (spec.blend) material.setAlphaMode("BLEND");
      cache.set(finish, material);
    }
    return material;
  };
}

export type Materials = ReturnType<typeof materials>;

function floats(document: Document, type: "VEC3" | "VEC4", values: number[]) {
  const buffer = document.getRoot().listBuffers()[0];
  return document.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
}

function primitive(document: Document, mesh: MeshData, surface: Material) {
  const buffer = document.getRoot().listBuffers()[0];
  const indices = document.createAccessor().setType("SCALAR").setArray(new Uint32Array(mesh.indices)).setBuffer(buffer);
  const result = document.createPrimitive().setAttribute("POSITION", floats(document, "VEC3", mesh.positions))
    .setAttribute("NORMAL", floats(document, "VEC3", mesh.normals)).setIndices(indices).setMaterial(surface);
  if (mesh.layers) {
    // The scene's ground-layer weights, as normalized bytes, like the colours.
    const weights = Uint8Array.from(mesh.layers, (value) => Math.round(Math.min(Math.max(value, 0), 1) * 255));
    result.setAttribute(layerAttribute.gltf, document.createAccessor().setType("VEC4").setArray(weights).setNormalized(true).setBuffer(buffer));
  }
  if (!mesh.colors.length) return result;
  // Colours travel as normalized bytes, a quarter of the size of floats. The
  // contact shade's fourth component is its alpha; everything else is opaque.
  const components = mesh.colors.length / (mesh.positions.length / 3);
  const rgba = new Uint8Array(mesh.positions.length / 3 * 4);
  for (let i = 0; i < rgba.length / 4; i++) {
    for (let k = 0; k < 4; k++) rgba[i * 4 + k] = Math.round((k < components ? mesh.colors[i * components + k] : 1) * 255);
  }
  return result.setAttribute("COLOR_0", document.createAccessor().setType("VEC4").setArray(rgba).setNormalized(true).setBuffer(buffer));
}

export function attach(document: Document, parent: Node, name: string, mesh: MeshData, surface: Material) {
  if (!mesh.indices.length) return;
  parent.addChild(document.createNode(name).setMesh(document.createMesh(name).addPrimitive(primitive(document, mesh, surface))));
}

/** One placement of a repeated prop: position, per-axis size, and a turn about +Y or a full rotation. */
export type Instance = { at: vec3; size?: vec3; turn?: number; rotation?: [number, number, number, number] };

// Repeated props are one mesh drawn through EXT_mesh_gpu_instancing, so each
// part costs one draw call however many times the prop appears.
export function instanced(document: Document, parent: Node, name: string, parts: [MeshData, Material][], instances: Instance[]) {
  if (!instances.length) return;
  const mesh = document.createMesh(name);
  for (const [data, surface] of parts) if (data.indices.length) mesh.addPrimitive(primitive(document, data, surface));
  const batch = document.createExtension(EXTMeshGPUInstancing).setRequired(true).createInstancedMesh()
    .setAttribute("TRANSLATION", floats(document, "VEC3", instances.flatMap(({ at }) => at)))
    .setAttribute("ROTATION", floats(document, "VEC4", instances.flatMap(({ turn = 0, rotation }) =>
      rotation ?? [0, Math.sin(turn / 2), 0, Math.cos(turn / 2)])))
    .setAttribute("SCALE", floats(document, "VEC3", instances.flatMap(({ size = [1, 1, 1] }) => size)));
  parent.addChild(document.createNode(name).setMesh(mesh).setExtension("EXT_mesh_gpu_instancing", batch));
}
