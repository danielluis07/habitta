import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Document, Material, Primitive } from "@gltf-transform/core";
import type { InstancedMesh } from "@gltf-transform/extensions";
import sharp from "sharp";
import { modelIO } from "@/scripts/model-io";
import { nearView } from "@/scripts/placeholder-models/landscape";
import { rockDetail, rockSource } from "@/scripts/placeholder-models/rock";
import { atlasRegions, atlasSize, leafSources } from "@/scripts/placeholder-models/vegetation";

// Believable vegetation and rocks (#50): leaf-card olives, cypresses and
// scrub on real branches, scanned limestone rocks whose normal maps carry
// their detail, full versions only where the fixed views look closest, and
// every source recorded.

const root = resolve(import.meta.dir, "..");
let district: Document;

beforeAll(async () => {
  district = await (await modelIO()).read(resolve(root, "public/models/district-low.glb"));
});

const node = (name: string) => district.getRoot().listNodes().find((candidate) => candidate.getName() === name)!;
const primitive = (name: string) => node(name).getMesh()!.listPrimitives()[0];
const placements = (name: string) => {
  const translation = node(name).getExtension<InstancedMesh>("EXT_mesh_gpu_instancing")!.getAttribute("TRANSLATION")!;
  return Array.from({ length: translation.getCount() }, (_, i) => translation.getElement(i, []));
};

/** How many of a primitive's triangles are mapped inside an atlas region. */
function trianglesIn(mesh: Primitive, [x, y, w, h]: readonly number[]) {
  const uvs = mesh.getAttribute("TEXCOORD_0")!;
  const indices = mesh.getIndices()!.getArray()!;
  let count = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const inside = [0, 1, 2].every((k) => {
      const [u, v] = uvs.getElement(indices[t + k], []).map((value) => value * atlasSize);
      return u >= x && u <= x + w && v >= y && v <= y + h;
    });
    if (inside) count++;
  }
  return count;
}

async function decode(material: Material, slot: "baseColor" | "normal" = "baseColor") {
  const texture = slot === "baseColor" ? material.getBaseColorTexture() : material.getNormalTexture();
  return sharp(Buffer.from(texture!.getImage()!)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

const plants = [
  ["olives", "vegetation_olives_instanced", "vegetation_far_olives_instanced"],
  ["cypresses", "vegetation_cypress_instanced", "vegetation_far_cypress_instanced"],
  ["scrub", "vegetation_scrub_instanced", "vegetation_far_scrub_instanced"],
] as const;

describe("vegetation", () => {
  test.each(plants)("%s, near and far, are leaf cards over the foliage atlas, alpha-tested and seen from both sides", (_, near, far) => {
    for (const name of [near, far]) {
      const mesh = primitive(name);
      const material = mesh.getMaterial()!;
      expect(material.getName()).toBe("Vegetation");
      expect(material.getAlphaMode()).toBe("MASK");
      expect(material.getAlphaCutoff()).toBe(0.5);
      expect(material.getDoubleSided()).toBe(true);
      expect(material.getBaseColorTexture()!.getMimeType()).toBe("image/png");
      const uvs = mesh.getAttribute("TEXCOORD_0")!;
      for (let i = 0; i < uvs.getCount(); i++) for (const value of uvs.getElement(i, [])) expect(value).toBeWithin(0, 1);
    }
  });

  test("near olives and cypresses stand on branches under their foliage; scrub is all foliage", () => {
    const olive = primitive("vegetation_olives_instanced");
    expect(trianglesIn(olive, atlasRegions.bark)).toBeGreaterThanOrEqual(40);
    expect(trianglesIn(olive, atlasRegions.olive)).toBeGreaterThanOrEqual(40);
    const cypress = primitive("vegetation_cypress_instanced");
    expect(trianglesIn(cypress, atlasRegions.bark)).toBeGreaterThanOrEqual(8);
    expect(trianglesIn(cypress, atlasRegions.cypress)).toBeGreaterThanOrEqual(40);
    expect(trianglesIn(primitive("vegetation_scrub_instanced"), atlasRegions.scrub)).toBeGreaterThanOrEqual(12);
  });

  test("far versions are a few cards of a whole plant, crossed, and over the olive's crown", () => {
    const cases = [
      ["vegetation_far_olives_instanced", [atlasRegions.oliveFar, atlasRegions.olive]],
      ["vegetation_far_cypress_instanced", [atlasRegions.cypressFar]],
      ["vegetation_far_scrub_instanced", [atlasRegions.scrub]],
    ] as const;
    for (const [name, regions] of cases) {
      const mesh = primitive(name);
      const triangles = mesh.getIndices()!.getCount() / 3;
      expect(triangles).toBeLessThanOrEqual(8);
      expect(regions.reduce((sum, region) => sum + trianglesIn(mesh, region), 0)).toBe(triangles);
    }
  });

  test("the atlas cuts out leaves, with no card's edge showing, and opaque bark", async () => {
    const { data, info } = await decode(primitive("vegetation_olives_instanced").getMaterial()!);
    expect([info.width, info.height]).toEqual([atlasSize, atlasSize]);
    const alpha = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
    for (const [name, [x0, y0, w, h]] of Object.entries(atlasRegions)) {
      let [covered, edge, edgeCovered, green] = [0, 0, 0, 0];
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const opaque = alpha(x, y) >= 128;
        covered += opaque ? 1 : 0;
        // The scrub's dome and the whole plants stand on their lower edge.
        const border = x === x0 || x === x0 + w - 1 || y === y0 || (y === y0 + h - 1 && !["scrub", "oliveFar", "cypressFar"].includes(name));
        if (border) [edge, edgeCovered] = [edge + 1, edgeCovered + (opaque ? 1 : 0)];
        const i = (y * info.width + x) * info.channels;
        if (opaque && data[i + 1] >= data[i] && data[i + 1] >= data[i + 2]) green++;
      }
      if (name === "bark") {
        expect(covered).toBe(w * h);
        continue;
      }
      expect(covered / (w * h)).toBeWithin(0.2, 0.9);
      expect(edgeCovered / edge).toBeLessThan(0.02);
      // Foliage keeps to greens and grey-greens; bark and twigs are a small share.
      expect(green / covered).toBeGreaterThan(0.8);
    }
  });

  test.each(plants)("near %s stand where the fixed views see them from nearest; lighter ones beyond", (_, near, far) => {
    const [nearby, distant] = [placements(near), placements(far)];
    expect(nearby.length).toBeGreaterThan(1);
    expect(distant.length).toBeGreaterThan(1);
    for (const [x, , z] of nearby) expect(nearView(x, z)).toBe(true);
    for (const [x, , z] of distant) expect(nearView(x, z)).toBe(false);
  });
});

describe("rocks", () => {
  test.each([["near", "rocks_limestone_instanced"], ["far", "rocks_limestone_far_instanced"]] as const)(
    "the %s rock is the decimated scan, its detail in a normal map with its own tangents", (detail, name) => {
      const mesh = primitive(name);
      const material = mesh.getMaterial()!;
      expect(material.getName()).toMatch(/limestone rock/i);
      expect(material.getBaseColorTexture()!.getMimeType()).toBe("image/jpeg");
      expect(material.getNormalTexture()!.getMimeType()).toBe("image/jpeg");
      expect(mesh.getAttribute("TEXCOORD_0")).not.toBeNull();
      expect(mesh.getAttribute("TANGENT")).not.toBeNull();
      expect(mesh.getIndices()!.getCount() / 3).toBeLessThanOrEqual(rockDetail[detail].faces);
      const range = placements(name).map(([x, , z]) => nearView(x, z));
      expect(range.length).toBeGreaterThan(1);
      expect(range.every((near) => near === (detail === "near"))).toBe(true);
    });

  test("the rock's colour map is tinted to the scene's rock token", async () => {
    const { data, info } = await decode(primitive("rocks_limestone_instanced").getMaterial()!);
    const toLinear = (value: number) => (value /= 255) <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    const toSRGB = (value: number) => 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);
    const texels = info.width * info.height;
    const mean = [0, 0, 0];
    for (let i = 0; i < texels; i++) for (let c = 0; c < 3; c++) mean[c] += toLinear(data[i * info.channels + c]) / texels;
    const token = [0xB8, 0xB1, 0xA3];
    mean.forEach((value, c) => expect(Math.abs(toSRGB(value) - token[c])).toBeLessThanOrEqual(4));
  });
});

test("every leaf photograph and the scanned rock are CC0, recorded here and in the asset contract", async () => {
  const contract = await readFile(resolve(root, "docs/runtime-assets.md"), "utf8");
  const sources = [...Object.values(leafSources), rockSource];
  for (const source of sources) {
    expect(source.licence).toBe("CC0 1.0");
    expect(source.authors.length).toBeGreaterThan(0);
    expect(contract).toContain(source.page);
    for (const author of source.authors) expect(contract).toContain(author.replace(/ \(.*\)$/, ""));
  }
  for (const { archive } of Object.values(leafSources)) expect(archive.md5).toMatch(/^[0-9a-f]{32}$/);
  for (const file of Object.values(rockSource.files)) expect(file.md5).toMatch(/^[0-9a-f]{32}$/);
});
