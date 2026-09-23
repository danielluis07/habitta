import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { type Document, type Node, Primitive } from "@gltf-transform/core";
import { EXTMeshoptCompression, type InstancedMesh } from "@gltf-transform/extensions";
import { validateBytes } from "gltf-validator";
import { groundTextures } from "@/components/district-scene/ground";
import { desktopPack, environmentMaps } from "@/components/district-scene/quality";
import { collection } from "@/lib/collection";
import { modelIO } from "@/scripts/model-io";

export const modelBudgets = {
  /** The district GLB, the base environment map and the ground textures, on every tier. */
  openingBytes: 2_000_000,
  /** What the high tier fetches after the scene opens. */
  desktopPackBytes: 3_000_000,
  mobile: { openingTriangles: 75_000, selectedTriangles: 150_000, drawCalls: 60 },
  desktop: { openingTriangles: 150_000, selectedTriangles: 300_000, drawCalls: 120 },
} as const;

type Counts = { triangles: number; drawCalls: number };
type AssetReport = Counts & { url: string; bytes: number; warnings: number };
type Scenario = Counts & { name: string };
type EnvironmentReport = { url: string; bytes: number; width: number; height: number };

/** The size of an equirectangular Radiance HDR, from its header. */
function radianceSize(bytes: Uint8Array) {
  const header = new TextDecoder().decode(bytes.subarray(0, 512));
  const resolution = /\n\n-Y (\d+) \+X (\d+)\n/.exec(header);
  if (!/^#\?(RADIANCE|RGBE)\n/.test(header) || !header.includes("FORMAT=32-bit_rle_rgbe") || !resolution) {
    throw new Error("Environment maps must be Radiance HDR (RGBE) files.");
  }
  const [height, width] = [Number(resolution[1]), Number(resolution[2])];
  if (width !== height * 2) throw new Error(`An equirectangular map is twice as wide as it is high; found ${width} × ${height}.`);
  return { width, height };
}

/** The size of a baseline or progressive JPEG, from its first frame header. */
function jpegSize(bytes: Uint8Array) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Ground textures must be JPEG files.");
  for (let at = 2; at + 9 < bytes.length;) {
    if (bytes[at] !== 0xff) break;
    const marker = bytes[at + 1];
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    // SOF0 to SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: (bytes[at + 5] << 8) | bytes[at + 6], width: (bytes[at + 7] << 8) | bytes[at + 8] };
    }
    at += 2 + length;
  }
  throw new Error("Ground textures must be readable JPEG files.");
}

/** Count rendered occurrences, including shared meshes and GPU instances. */
function sceneCounts(nodes: Node[]): Counts {
  let triangles = 0;
  let drawCalls = 0;
  for (const node of nodes) {
    const instances = node.getExtension<InstancedMesh>("EXT_mesh_gpu_instancing")
      ?.listAttributes()[0]?.getCount() ?? 1;
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const count = (primitive.getIndices() ?? primitive.getAttribute("POSITION"))!.getCount();
      switch (primitive.getMode()) {
        case Primitive.Mode.TRIANGLES:
          triangles += (count / 3) * instances;
          break;
        case Primitive.Mode.TRIANGLE_STRIP:
        case Primitive.Mode.TRIANGLE_FAN:
          triangles += Math.max(0, count - 2) * instances;
          break;
        default:
          throw new Error("Runtime geometry must use triangles, triangle strips or triangle fans.");
      }
      // GPU instances share the primitive's draw call; ordinary nodes do not.
      drawCalls += 1;
    }
  }
  return { triangles, drawCalls };
}

function activeNodes(document: Document): Node[] {
  const scene = document.getRoot().getDefaultScene();
  if (!scene || document.getRoot().listScenes().length !== 1) {
    throw new Error("Export exactly one scene and mark it as the default scene.");
  }
  const nodes: Node[] = [];
  scene.traverse((node) => nodes.push(node));
  return nodes;
}

async function listGLBs(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listGLBs(path) : Promise.resolve(/\.glb$/i.test(entry.name) ? [path] : []);
  }));
  return files.flat().sort();
}

/** Shared by the CLI and the collection-integrity tests; never imported by the app. */
export async function validateModels(publicDirectory = resolve(import.meta.dir, "../public")) {
  const errors: string[] = [];
  const assets: AssetReport[] = [];
  const scenarios: Scenario[] = [];
  const environments: EnvironmentReport[] = [];
  const textures: EnvironmentReport[] = [];
  const documents = new Map<string, Node[]>();
  const io = await modelIO();

  async function validate(bytes: Uint8Array, url: string) {
    const report = await validateBytes(bytes, { uri: url, format: "glb", maxIssues: 0, writeTimestamp: false });
    for (const issue of report.issues.messages.filter((issue) => issue.severity === 0)) {
      errors.push(`${url}: ${issue.code} ${issue.pointer ?? ""} ${issue.message}`);
    }
    return report.issues;
  }

  // Discover every public GLB, including exports not yet referenced by the collection.
  for (const path of await listGLBs(publicDirectory)) {
    const url = `/${relative(publicDirectory, path).replaceAll("\\", "/")}`;
    try {
      const bytes = new Uint8Array(await readFile(path));
      const raw = await validate(bytes, url);
      if (raw.numErrors) continue;
      const json = (await io.binaryToJSON(bytes)).json;
      if ([...(json.buffers ?? []), ...(json.images ?? [])].some((resource) => resource.uri)) {
        throw new Error("All buffers and textures must be embedded in the GLB (no external or data URIs).");
      }
      if (!json.extensionsRequired?.includes("EXT_meshopt_compression") ||
          !json.bufferViews?.some((view) => view.extensions?.EXT_meshopt_compression)) {
        throw new Error("Runtime GLBs must contain required EXT_meshopt_compression geometry.");
      }
      const allowed = new Set(["EXT_meshopt_compression", "EXT_mesh_gpu_instancing", "KHR_mesh_quantization"]);
      for (const extension of json.extensionsUsed ?? []) {
        if (!allowed.has(extension)) throw new Error(`Unsupported runtime extension: ${extension}. Update the asset contract before adopting it.`);
      }

      const document = await io.readBinary(bytes);
      // Khronos doesn't decode Meshopt. Validate the actual decoded buffers too.
      document.getRoot().listExtensionsUsed().find((extension) =>
        extension.extensionName === EXTMeshoptCompression.EXTENSION_NAME)?.dispose();
      const decoded = await validate(await io.writeBinary(document), `${url} (decoded)`);
      if (decoded.numErrors) continue;
      const nodes = activeNodes(document);
      documents.set(url, nodes);
      assets.push({ url, bytes: bytes.byteLength, ...sceneCounts(nodes), warnings: raw.numWarnings + decoded.numWarnings });
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // The base environment map opens every tier; the rest belong to the desktop pack.
  for (const url of Object.values(environmentMaps)) {
    const bytes = await readFile(join(publicDirectory, url.slice(1))).catch(() => null);
    if (!bytes) {
      errors.push(`${url}: missing environment map.`);
      continue;
    }
    try {
      environments.push({ url, bytes: bytes.byteLength, ...radianceSize(new Uint8Array(bytes)) });
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const base = environments.find((environment) => environment.url === environmentMaps.base);
  if (base && (base.width < 256 || base.width > 512)) {
    errors.push(`${base.url}: the base environment map is 256 to 512 px wide; found ${base.width}.`);
  }
  // The ground's maps open with the district on every tier. They tile, so
  // each is square, a power of two, and small.
  for (const url of groundTextures) {
    const bytes = await readFile(join(publicDirectory, url.slice(1))).catch(() => null);
    if (!bytes) {
      errors.push(`${url}: missing ground texture.`);
      continue;
    }
    try {
      const { width, height } = jpegSize(new Uint8Array(bytes));
      if (width !== height || width & (width - 1) || width < 256 || width > 1024) {
        throw new Error(`Ground textures are square, a power of two, 256 to 1,024 px; found ${width} × ${height}.`);
      }
      textures.push({ url, bytes: bytes.byteLength, width, height });
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const textureBytes = textures.reduce((sum, { bytes }) => sum + bytes, 0);
  const packBytes = environments.filter(({ url }) => desktopPack.includes(url)).reduce((sum, { bytes }) => sum + bytes, 0);
  if (packBytes > modelBudgets.desktopPackBytes) {
    errors.push(`Desktop pack: ${packBytes} bytes exceeds ${modelBudgets.desktopPackBytes} bytes.`);
  }

  const districtURL = "/models/district-low.glb";
  const required = [districtURL, ...collection.map((concept) => concept.scene.detailedModel)];
  for (const url of required) {
    if (!documents.has(url)) errors.push(`${url}: missing or invalid required runtime GLB.`);
  }

  for (const concept of collection) {
    const bindings: { target: Node; anchor: Node }[] = [];
    for (const url of [districtURL, concept.scene.detailedModel]) {
      const nodes = documents.get(url);
      if (!nodes) continue;
      const target = nodes.filter((node) => node.getName() === concept.scene.selectionTarget);
      const anchor = nodes.filter((node) => node.getName() === concept.scene.labelAnchor);
      for (const [name, matches] of [[concept.scene.selectionTarget, target], [concept.scene.labelAnchor, anchor]] as const) {
        if (matches.length !== 1) errors.push(`${url}: scene binding "${name}" must name exactly one active node; found ${matches.length}.`);
      }
      if (target.length === 1 && anchor.length === 1) {
        const descendants: Node[] = [];
        target[0].traverse((node) => descendants.push(node));
        if (!descendants.some((node) => node.getMesh())) errors.push(`${url}: selection target "${concept.scene.selectionTarget}" has no selectable geometry.`);
        if (!descendants.includes(anchor[0]) || anchor[0].getMesh()) errors.push(`${url}: label anchor must be an empty descendant of its selection target.`);
        bindings.push({ target: target[0], anchor: anchor[0] });
      }
    }
    if (bindings.length === 2) {
      for (const key of ["target", "anchor"] as const) {
        const a = bindings[0][key].getWorldMatrix();
        const b = bindings[1][key].getWorldMatrix();
        if (a.some((value, index) => Math.abs(value - b[index]) > 0.001)) {
          errors.push(`${concept.slug}: ${key} transform differs between district and detailed GLBs.`);
        }
      }
    }
  }

  const district = assets.find((asset) => asset.url === districtURL);
  const transfer = { opening: (district?.bytes ?? 0) + (base?.bytes ?? 0) + textureBytes, desktopPack: packBytes };
  if (district) {
    if (transfer.opening > modelBudgets.openingBytes) {
      errors.push(`Opening transfer (district GLB, base environment map and ground textures): ${transfer.opening} bytes exceeds ${modelBudgets.openingBytes} bytes.`);
    }
    scenarios.push({ name: "opening", triangles: district.triangles, drawCalls: district.drawCalls });
    for (const concept of collection) {
      const detail = assets.find((asset) => asset.url === concept.scene.detailedModel);
      if (detail) scenarios.push({
        name: `selected ${concept.slug}`,
        triangles: district.triangles + detail.triangles,
        drawCalls: district.drawCalls + detail.drawCalls,
      });
    }
    for (const scenario of scenarios) {
      for (const tier of ["mobile", "desktop"] as const) {
        const budget = modelBudgets[tier];
        const limit = scenario.name === "opening" ? budget.openingTriangles : budget.selectedTriangles;
        if (scenario.triangles > limit) errors.push(`${scenario.name} (${tier}): ${scenario.triangles} triangles exceeds ${limit}.`);
        if (scenario.drawCalls > budget.drawCalls) errors.push(`${scenario.name} (${tier}): ${scenario.drawCalls} draw calls exceeds ${budget.drawCalls}.`);
      }
    }
  }
  return { assets, environments, textures, transfer, scenarios, errors };
}

if (import.meta.main) {
  try {
    const report = await validateModels();
    console.table(report.assets);
    console.table(report.environments);
    console.table(report.textures);
    console.table(report.scenarios);
    console.log(`Opening transfer: ${report.transfer.opening} bytes. Desktop pack: ${report.transfer.desktopPack} bytes.`);
    if (report.errors.length) {
      console.error(report.errors.join("\n"));
      process.exitCode = 1;
    } else {
      console.log(`Validated ${report.assets.length} runtime GLBs, ${report.environments.length} environment maps and ${report.textures.length} ground textures; bindings and budgets pass.`);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
