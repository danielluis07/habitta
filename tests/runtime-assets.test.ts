import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Document, type Node, Primitive } from "@gltf-transform/core";
import { EXTMeshGPUInstancing, type InstancedMesh } from "@gltf-transform/extensions";
import sharp from "sharp";
import { groundTextures } from "@/components/district-scene/ground";
import { desktopPack, environmentMaps } from "@/components/district-scene/quality";
import { collection } from "@/lib/collection";
import { modelIO } from "@/scripts/model-io";
import { validateModels } from "@/scripts/validate-models";

const publicDirectory = resolve(import.meta.dir, "../public");
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "habitta-models-"));
  temporaryDirectories.push(directory);
  for (const folder of ["models", "environments", "textures"]) {
    await cp(join(publicDirectory, folder), join(directory, folder), { recursive: true });
  }
  return directory;
}

async function edit(directory: string, filename: string, change: (document: Document) => void) {
  const io = await modelIO();
  const path = join(directory, "models", filename);
  const document = await io.read(path);
  change(document);
  await io.write(path, document);
}

// One twelve-triangle primitive with many GPU instances: triangle budgets must
// count the instances, while the primitive still contributes only one draw call.
function addInstances(document: Document, count: number) {
  const root = document.getRoot();
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i & 1, (i >> 1) & 1, (i >> 2) & 1]);
  const faces = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
  const positions = document.createAccessor().setType("VEC3").setBuffer(root.listBuffers()[0])
    .setArray(new Float32Array(faces.flatMap(([a, b, c, d]) => [a, b, c, a, c, d].flatMap((i) => corners[i]))));
  const mesh = document.createMesh().addPrimitive(document.createPrimitive().setAttribute("POSITION", positions));
  const transforms = document.createAccessor().setType("VEC3")
    .setArray(new Float32Array(count * 3)).setBuffer(root.listBuffers()[0]);
  const instances = document.createExtension(EXTMeshGPUInstancing).setRequired(true)
    .createInstancedMesh().setAttribute("TRANSLATION", transforms);
  root.getDefaultScene()!.addChild(document.createNode("budget_test_instances").setMesh(mesh)
    .setExtension("EXT_mesh_gpu_instancing", instances));
}

test("every committed runtime GLB passes Khronos validation, scene bindings and all budgets", async () => {
  const report = await validateModels();
  expect(report.errors).toEqual([]);
  expect(report.assets.map((asset) => asset.url).sort()).toEqual([
    "/models/district-low.glb", ...collection.map((concept) => concept.scene.detailedModel),
  ].sort());
  expect(report.scenarios).toHaveLength(4);
  for (const scenario of report.scenarios) {
    expect(scenario.triangles).toBeGreaterThan(0);
    expect(scenario.drawCalls).toBeGreaterThan(0);
  }
});

test("the opening transfer is the district, the base environment map and the ground textures, on every tier", async () => {
  const report = await validateModels();
  const bytes = (url: string) => [...report.assets, ...report.environments, ...report.textures].find((asset) => asset.url === url)!.bytes;
  expect(report.textures.map(({ url }) => url)).toEqual([...groundTextures]);
  expect(report.transfer.opening).toBe(bytes("/models/district-low.glb") + bytes(environmentMaps.base) +
    groundTextures.reduce((sum, url) => sum + bytes(url), 0));
  expect(report.transfer.opening).toBeLessThanOrEqual(2_000_000);
  // The upgrade is fetched later, by the high tier alone.
  expect(desktopPack).toEqual([environmentMaps.high]);
  expect(report.transfer.desktopPack).toBe(bytes(environmentMaps.high));
  expect(report.transfer.desktopPack).toBeLessThanOrEqual(3_000_000);
  const base = report.environments.find(({ url }) => url === environmentMaps.base)!;
  expect(base.width).toBeGreaterThanOrEqual(256);
  expect(base.width).toBeLessThanOrEqual(512);
});

describe("environment maps", () => {
  // A valid Radiance header over `bytes` in all.
  const radiance = (width: number, bytes: number) => {
    const header = new TextEncoder().encode(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${width / 2} +X ${width}\n`);
    const file = new Uint8Array(bytes);
    file.set(header);
    return file;
  };

  test("the base map counts toward the opening budget", async () => {
    const directory = await fixture();
    // The district and the ground textures stay under 2 MB; with the base map, they don't.
    const before = await validateModels(directory);
    const district = before.assets.find(({ url }) => url === "/models/district-low.glb")!;
    const textures = before.textures.reduce((sum, { bytes }) => sum + bytes, 0);
    await edit(directory, "district-low.glb", (document) => {
      document.getRoot().setExtras({ oversizedMetadata: "x".repeat(2_000_000 - district.bytes - textures - 40_000) });
    });
    const report = await validateModels(directory);
    expect(report.assets.find(({ url }) => url === "/models/district-low.glb")!.bytes + textures).toBeLessThan(2_000_000);
    expect(report.errors.join("\n")).toContain("Opening transfer (district GLB, base environment map and ground textures)");
  });

  test("an oversized desktop pack", async () => {
    const directory = await fixture();
    await writeFile(join(directory, environmentMaps.high.slice(1)), radiance(1024, 3_000_001));
    expect((await validateModels(directory)).errors.join("\n")).toContain("Desktop pack: 3000001 bytes exceeds 3000000");
  });

  test("a base map outside 256 to 512 px", async () => {
    const directory = await fixture();
    await writeFile(join(directory, environmentMaps.base.slice(1)), radiance(1024, 1000));
    expect((await validateModels(directory)).errors.join("\n")).toContain("256 to 512 px wide; found 1024");
  });

  test("a missing or unreadable map", async () => {
    const directory = await fixture();
    await rm(join(directory, environmentMaps.base.slice(1)));
    await writeFile(join(directory, environmentMaps.high.slice(1)), "not an HDR");
    const errors = (await validateModels(directory)).errors.join("\n");
    expect(errors).toContain(`${environmentMaps.base}: missing environment map.`);
    expect(errors).toContain(`${environmentMaps.high}: Environment maps must be Radiance HDR`);
  });
});

describe("ground textures", () => {
  test("they count toward the opening budget", async () => {
    const directory = await fixture();
    const before = await validateModels(directory);
    // Growing one map past what's left of the 2 MB fails the opening transfer.
    const path = join(directory, groundTextures[0].slice(1));
    const map = await readFile(path);
    const grown = new Uint8Array(map.byteLength + 2_000_001 - before.transfer.opening);
    grown.set(map);
    await writeFile(path, grown);
    const report = await validateModels(directory);
    expect(report.transfer.opening).toBe(2_000_001);
    expect(report.errors.join("\n")).toContain("Opening transfer (district GLB, base environment map and ground textures): 2000001 bytes");
  });

  test("a missing, unreadable or oversized map", async () => {
    const directory = await fixture();
    const [missing, unreadable, oversized] = groundTextures;
    await rm(join(directory, missing.slice(1)));
    await writeFile(join(directory, unreadable.slice(1)), "not a JPEG");
    await writeFile(join(directory, oversized.slice(1)), await sharp({ create: { width: 2048, height: 2048, channels: 3, background: "#A5AE95" } }).jpeg().toBuffer());
    const errors = (await validateModels(directory)).errors.join("\n");
    expect(errors).toContain(`${missing}: missing ground texture.`);
    expect(errors).toContain(`${unreadable}: Ground textures must be JPEG files.`);
    expect(errors).toContain(`${oversized}: Ground textures are square, a power of two, 256 to 1,024 px; found 2048 × 2048.`);
  });
});

test("repeated street, vegetation, rock, wall and planting props are GPU-instanced", async () => {
  const io = await modelIO();
  const document = await io.read(join(publicDirectory, "models/district-low.glb"));
  const instances = new Map(document.getRoot().listNodes().flatMap((node) => {
    const batch = node.getExtension<InstancedMesh>("EXT_mesh_gpu_instancing");
    return batch ? [[node.getName(), batch.listAttributes()[0].getCount()] as const] : [];
  }));
  const props = [
    "street_lights_instanced", "vegetation_olives_instanced", "vegetation_far_olives_instanced", "vegetation_cypress_instanced",
    "vegetation_scrub_instanced", "rocks_limestone_instanced", "terrace_walls_drystone_instanced", "vegetation_contact_shade_instanced",
    ...collection.map(({ slug }) => `${slug}_PLACEHOLDER_plants`),
  ];
  for (const name of props) expect(instances.get(name)).toBeGreaterThan(1);
});

/** The building's own nodes, in one export: its selection target and everything under it. */
async function buildingNodes(file: string, slug: string) {
  const io = await modelIO();
  const document = await io.read(join(publicDirectory, "models", file));
  const target = document.getRoot().listNodes().find((node) => node.getName() === `${slug}_selection_target`)!;
  const nodes: Node[] = [];
  target.traverse((node) => nodes.push(node));
  return nodes;
}

// The finishes each brief names, as the placeholder materials call them.
const briefFinishes = {
  crest: ["Warm limestone", "Rubble stone", "Chalk plaster", "Pale oak", "Dark bronze", "Glass"],
  contour: ["Board-textured concrete", "Rubble stone", "Oiled timber", "Stone paving", "Dark bronze", "Glass"],
  grove: ["Lime render", "Buff brick", "Clay tile", "Oiled timber", "Glass"],
};

test.each(collection.map(({ slug }) => slug))("%s has its brief's finishes at both detail levels, with glossy glass", async (slug) => {
  const finishes = async (file: string) => {
    const materials = (await buildingNodes(file, slug)).flatMap((node) => node.getMesh()?.listPrimitives().map((primitive) => primitive.getMaterial()!) ?? []);
    const glass = materials.find((material) => material.getName() === "Glass")!;
    expect(glass.getRoughnessFactor()).toBeLessThan(0.2);
    return new Set(materials.map((material) => material.getName()));
  };
  const [low, high] = [await finishes("district-low.glb"), await finishes(`building-${slug}.glb`)];
  for (const finish of briefFinishes[slug]) expect(low).toContain(finish);
  // Detail adds fidelity, never another finish.
  expect(high).toEqual(low);
});

test.each(collection.map(({ slug }) => slug))("%s has baked contact shading where its walls meet the ground", async (slug) => {
  for (const file of ["district-low.glb", `building-${slug}.glb`]) {
    // Vertex colours on the walls: at their foot, and anywhere.
    const [foot, walls]: number[][] = [[], []];
    for (const node of await buildingNodes(file, slug)) {
      if (node.getExtension("EXT_mesh_gpu_instancing")) continue;
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        if (["Glass", "Placeholder sign"].includes(primitive.getMaterial()!.getName())) continue;
        const [position, normal, color] = ["POSITION", "NORMAL", "COLOR_0"].map((name) => primitive.getAttribute(name)!);
        expect(color).toBeTruthy();
        for (let i = 0; i < position.getCount(); i++) {
          if (Math.abs(normal.getElement(i, [0, 0, 0])[1]) > 0.2) continue;
          const shade = color.getElement(i, [0, 0, 0, 0]).slice(0, 3).reduce((sum, value) => sum + value, 0) / 3;
          walls.push(shade);
          if (position.getElement(i, [0, 0, 0])[1] < 0.05) foot.push(shade);
        }
      }
    }
    expect(foot.length).toBeGreaterThan(0);
    expect(foot.reduce((sum, value) => sum + value, 0) / foot.length).toBeLessThan(0.8);
    // Walls in the open keep their full colour.
    expect(Math.max(...walls)).toBeGreaterThan(0.95);
  }
});

describe("invalid exports fail the release check", () => {
  test.each(["district-low.glb", "building-crest.glb"])("missing collection binding in %s", async (file) => {
    const directory = await fixture();
    await edit(directory, file, (document) => {
      document.getRoot().listNodes().find((node) => node.getName() === collection[0].scene.labelAnchor)!
        .setName("accidentally_renamed_anchor");
    });
    expect((await validateModels(directory)).errors.join("\n")).toContain('scene binding "crest_label_anchor"');
  });

  test("a missing detailed file", async () => {
    const directory = await fixture();
    await rm(join(directory, "models/building-grove.glb"));
    expect((await validateModels(directory)).errors.join("\n")).toContain("/models/building-grove.glb: missing");
  });

  test("corrupt GLBs are found even outside models/ and the collection", async () => {
    const directory = await fixture();
    await writeFile(join(directory, "forgotten-export.glb"), "not a GLB");
    expect((await validateModels(directory)).errors.join("\n")).toContain("/forgotten-export.glb:");
  });

  test("Khronos errors in decoded geometry", async () => {
    const directory = await fixture();
    await edit(directory, "building-crest.glb", (document) => {
      const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
      const indices = primitive.getIndices()!;
      indices.setScalar(0, primitive.getAttribute("POSITION")!.getCount() + 1);
    });
    expect((await validateModels(directory)).errors.join("\n")).toContain("ACCESSOR_INDEX_OOB");
  });

  test("duplicate and inactive node names cannot satisfy bindings", async () => {
    const directory = await fixture();
    await edit(directory, "building-crest.glb", (document) => {
      const root = document.getRoot();
      const target = root.listNodes().find((node) => node.getName() === "crest_selection_target")!;
      const anchor = root.listNodes().find((node) => node.getName() === "crest_label_anchor")!;
      target.removeChild(anchor);
      root.getDefaultScene()!.addChild(document.createNode("crest_selection_target"));
    });
    const errors = (await validateModels(directory)).errors.join("\n");
    expect(errors).toContain('"crest_label_anchor" must name exactly one active node; found 0');
    expect(errors).toContain('"crest_selection_target" must name exactly one active node; found 2');
  });

  test("a detailed export with a different world origin", async () => {
    const directory = await fixture();
    await edit(directory, "building-crest.glb", (document) => {
      document.getRoot().listNodes().find((node) => node.getName() === "crest_selection_target")!.setTranslation([0, 0, 0]);
    });
    expect((await validateModels(directory)).errors.join("\n")).toContain("crest: target transform differs");
  });

  test("an oversized opening scene", async () => {
    const directory = await fixture();
    await edit(directory, "district-low.glb", (document) => {
      document.getRoot().setExtras({ oversizedMetadata: "x".repeat(2_000_000) });
    });
    expect((await validateModels(directory)).errors.join("\n")).toContain("bytes exceeds 2000000");
  });

  test("opening triangle limits include GPU instances on both tiers", async () => {
    const directory = await fixture();
    const before = (await validateModels(directory)).scenarios[0];
    await edit(directory, "district-low.glb", (document) => addInstances(document, Math.ceil((150_001 - before.triangles) / 12)));
    const report = await validateModels(directory);
    expect(report.errors.join("\n")).toMatch(/opening \(mobile\): .* triangles exceeds 75000/);
    expect(report.errors.join("\n")).toMatch(/opening \(desktop\): .* triangles exceeds 150000/);
    expect(report.scenarios[0].drawCalls).toBe(before.drawCalls + 1);
  });

  test("selection triangle limits include the district and the detail together", async () => {
    const directory = await fixture();
    const before = (await validateModels(directory)).scenarios.find(({ name }) => name === "selected crest")!;
    await edit(directory, "building-crest.glb", (document) => addInstances(document, Math.ceil((150_001 - before.triangles) / 12)));
    const report = await validateModels(directory);
    expect(report.assets.find((asset) => asset.url === "/models/building-crest.glb")!.triangles).toBeLessThan(150_000);
    expect(report.errors.join("\n")).toMatch(/selected crest \(mobile\): .* triangles exceeds 150000/);
    expect(report.errors.join("\n")).not.toContain("selected crest (desktop)");
  });

  test("desktop selected triangle limit", async () => {
    const directory = await fixture();
    const before = (await validateModels(directory)).scenarios.find(({ name }) => name === "selected crest")!;
    await edit(directory, "building-crest.glb", (document) => addInstances(document, Math.ceil((300_001 - before.triangles) / 12)));
    expect((await validateModels(directory)).errors.join("\n")).toMatch(/selected crest \(desktop\): .* triangles exceeds 300000/);
  });

  test("draw calls count ordinary nodes sharing a mesh", async () => {
    const directory = await fixture();
    await edit(directory, "building-crest.glb", (document) => {
      const root = document.getRoot();
      for (let i = 0; i < 120; i++) root.getDefaultScene()!.addChild(document.createNode().setMesh(root.listMeshes()[0]));
    });
    const errors = (await validateModels(directory)).errors.join("\n");
    expect(errors).toMatch(/selected crest \(mobile\): .* draw calls exceeds 60/);
    expect(errors).toMatch(/selected crest \(desktop\): .* draw calls exceeds 120/);
  });

  test("an uncompressed export", async () => {
    const directory = await fixture();
    await edit(directory, "building-crest.glb", (document) => {
      document.getRoot().listExtensionsUsed().find((extension) => extension.extensionName === "EXT_meshopt_compression")!.dispose();
    });
    expect((await validateModels(directory)).errors.join("\n")).toContain("required EXT_meshopt_compression");
  });
});

test("counts non-indexed triangle lists, strips and fans without rounding down", async () => {
  const directory = await fixture();
  const before = (await validateModels(directory)).scenarios[0];
  await edit(directory, "district-low.glb", (document) => {
    const root = document.getRoot();
    for (const mode of [Primitive.Mode.TRIANGLES, Primitive.Mode.TRIANGLE_STRIP, Primitive.Mode.TRIANGLE_FAN]) {
      const count = mode === Primitive.Mode.TRIANGLES ? 3 : 4;
      const positions = document.createAccessor().setType("VEC3")
        .setArray(new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,1,0].slice(0, count * 3)))
        .setBuffer(root.listBuffers()[0]);
      const mesh = document.createMesh().addPrimitive(document.createPrimitive().setMode(mode).setAttribute("POSITION", positions));
      root.getDefaultScene()!.addChild(document.createNode().setMesh(mesh));
    }
  });
  const report = await validateModels(directory);
  expect(report.errors).toEqual([]);
  expect(report.scenarios[0].triangles).toBe(before.triangles + 5);
  expect(report.scenarios[0].drawCalls).toBe(before.drawCalls + 3);
});
