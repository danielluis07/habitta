import { beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { Mesh, MeshStandardMaterial, ShaderLib, Texture, type Material, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  groundLayers, groundMaps, groundTextures, layerAttribute, layerGround, maxAnisotropy, patchGroundShader, shaderMarkers,
} from "@/components/district-scene/ground";
import { configureLoader } from "@/components/district-scene/models";
import { modelIO } from "@/scripts/model-io";
import { groundSources, groundTextureSize } from "@/scripts/generate-ground-textures";

// The textured ground (#49): its maps, their palette and sources, the layer
// weights in the district, and the scene's shader patch, without WebGL.

const root = resolve(import.meta.dir, "..");
const toLinear = (value: number) => (value /= 255) <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toSRGB = (value: number) => 255 * (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055);
const channels = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));

describe("ground maps", () => {
  test("each layer is tinted to its scene-terrain token, as DESIGN.md and the stylesheet define it", async () => {
    const [design, css] = await Promise.all([readFile(resolve(root, "DESIGN.md"), "utf8"), readFile(resolve(root, "app/globals.css"), "utf8")]);
    expect(groundLayers.map(({ name }) => name)).toEqual(["grass", "earth", "rock", "gravel"]);
    for (const { token, hex } of groundLayers) {
      expect(design).toContain(`${token}: "${hex}"`);
      expect(css).toContain(`--color-${token}: ${hex.toLowerCase()};`);
    }
  });

  test.each(groundLayers.map((layer) => [layer.name, layer] as const))("the %s colour map keeps to its token", async (_, { color, hex }) => {
    const { data, info } = await sharp(resolve(root, "public", color.slice(1))).raw().toBuffer({ resolveWithObject: true });
    const texels = info.width * info.height;
    const token = channels(hex).map(toLinear);
    const tokenChroma = token.map((value) => value / (token[0] + token[1] + token[2]));
    const mean = [0, 0, 0];
    let stray = 0;
    for (let i = 0; i < texels; i++) {
      const texel = [0, 1, 2].map((c) => toLinear(data[i * info.channels + c]));
      texel.forEach((value, c) => { mean[c] += value / texels; });
      const sum = texel[0] + texel[1] + texel[2] || 1;
      if (texel.some((value, c) => Math.abs(value / sum - tokenChroma[c]) > 0.05)) stray++;
    }
    // Its mean is the token, so the blended ground keeps the vertex colours' palette…
    mean.forEach((value, c) => expect(Math.abs(toSRGB(value) - channels(hex)[c])).toBeLessThanOrEqual(2));
    // …and its hues stay close to the token's; only brightness varies freely.
    expect(stray / texels).toBeLessThan(0.01);
  });

  test("the maps are square, 512 px and tile without a seam", async () => {
    for (const url of groundTextures) {
      const { data, info } = await sharp(resolve(root, "public", url.slice(1))).raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([groundTextureSize, groundTextureSize]);
      // Opposite edges continue each other about as closely as neighbouring rows do.
      const row = (y: number) => data.subarray(y * info.width * info.channels, (y + 1) * info.width * info.channels);
      const difference = (a: Uint8Array, b: Uint8Array) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
      const inside = (difference(row(100), row(101)) + difference(row(300), row(301))) / 2;
      expect(difference(row(info.height - 1), row(0))).toBeLessThan(inside * 1.6);
    }
  });

  test("every source is CC0, with its author and page recorded here and in the asset contract", async () => {
    const contract = await readFile(resolve(root, "docs/runtime-assets.md"), "utf8");
    for (const { name } of groundLayers) {
      const source = groundSources[name];
      expect(source.licence).toBe("CC0 1.0");
      expect(source.authors.length).toBeGreaterThan(0);
      expect(source.page).toBe(`https://polyhaven.com/a/${source.asset}`);
      for (const map of Object.values(source.maps)) expect(map.md5).toMatch(/^[0-9a-f]{32}$/);
      expect(contract).toContain(source.page);
      for (const author of source.authors) expect(contract).toContain(author.replace(/ \(.*\)$/, ""));
    }
    expect(contract).toContain("CC0");
  });
});

describe("layer weights in the district", () => {
  let district: Object3D;

  beforeAll(async () => {
    const data = await Bun.file(resolve(root, "public/models/district-low.glb")).arrayBuffer();
    const loader = new GLTFLoader();
    configureLoader(loader);
    district = (await loader.parseAsync(data, "")).scene;
  });

  const weights = (name: string) => {
    const mesh = district.getObjectByName(name) as Mesh;
    const attribute = mesh.geometry.getAttribute(layerAttribute.three) ?? mesh.geometry.getAttribute("groundLayers");
    expect(attribute).toBeTruthy();
    return Array.from({ length: attribute.count }, (_, i) => [attribute.getX(i), attribute.getY(i), attribute.getZ(i), attribute.getW(i)]);
  };
  const share = (all: number[][], layer: number, above = 0.5) => all.filter((w) => w[layer] > above).length / all.length;

  test("the terrain is wholly grass, earth and rock, and rock follows the steep ground", () => {
    const all = weights("terrain_highland_to_horizon");
    for (const w of all) {
      expect(w[0] + w[1] + w[2] + w[3]).toBeCloseTo(1, 1);
      expect(w[3]).toBe(0);
    }
    // All three layers appear, grass the most.
    for (const layer of [0, 1, 2]) expect(share(all, layer)).toBeGreaterThan(0.05);
    expect(share(all, 0)).toBeGreaterThan(share(all, 1));
  });

  test("the lane and paths are gravel between stone kerbs", async () => {
    const io = await modelIO();
    const document = await io.read(resolve(root, "public/models/district-low.glb"));
    const primitive = document.getRoot().listMeshes().find((mesh) => mesh.getName() === "connecting_lane_and_paths")!.listPrimitives()[0];
    const [position, layers] = [primitive.getAttribute("POSITION")!, primitive.getAttribute(layerAttribute.gltf)!];
    const [gravel, kerb] = [[] as number[], [] as number[]];
    for (let i = 0; i < position.getCount(); i++) {
      const [, , rock, surface] = layers.getElement(i, [0, 0, 0, 0]);
      const height = position.getElement(i, [0, 0, 0])[1];
      if (surface > 0.99) gravel.push(height);
      if (rock > 0.99) kerb.push(height);
    }
    expect(gravel.length).toBeGreaterThan(100);
    expect(kerb.length).toBeGreaterThan(100);
  });

  test("bench tops are gravel by the building and grass at their edges; their walls take no layers", () => {
    const all = weights("separate_plot_benches");
    expect(share(all, 3)).toBeGreaterThan(0.05);
    expect(share(all, 0)).toBeGreaterThan(0.05);
    expect(all.some((w) => w.every((value) => value === 0))).toBe(true);
  });

  test("the layered materials belong to layered meshes alone, and the scene patches just those", () => {
    const maps = groundMaps(groundTextures.map(() => new Texture()), 16);
    const patched = layerGround(district, maps);
    expect(patched.map((material) => material.name).sort()).toEqual(["Highland ground", "Lane paving and kerbs", "Plot ground and retaining walls"]);
    const users = new Map<Material, Mesh[]>();
    district.traverse((object) => {
      if (object instanceof Mesh) users.set(object.material, [...(users.get(object.material) ?? []), object]);
    });
    for (const material of patched) {
      expect(material).toBeInstanceOf(MeshStandardMaterial);
      expect(material.customProgramCacheKey()).toBe("habitta-ground-layers");
      for (const mesh of users.get(material)!) {
        expect(mesh.geometry.getAttribute("groundLayers")).toBeTruthy();
        expect(mesh.geometry.getAttribute(layerAttribute.three)).toBeUndefined();
      }
    }
    // Patching again changes nothing.
    expect(layerGround(district, maps)).toHaveLength(3);
  });
});

describe("the ground shader", () => {
  test("tiles each map with its colour space and bounded anisotropy", () => {
    const maps = groundMaps(groundTextures.map(() => new Texture()), 16);
    expect(maps.color).toHaveLength(4);
    expect(maps.surface).toHaveLength(4);
    for (const map of maps.color) expect(map.colorSpace).toBe("srgb");
    for (const map of [...maps.color, ...maps.surface]) expect(map.anisotropy).toBe(maxAnisotropy);
    for (const map of maps.surface) expect(map.colorSpace).toBe("");
  });

  test("patches three.js's standard material at every marker", () => {
    const shader = { vertexShader: ShaderLib.physical.vertexShader, fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} as Record<string, { value: unknown }> };
    const maps = groundMaps(groundTextures.map(() => new Texture()), 4);
    patchGroundShader(shader, maps);
    expect(shader.vertexShader).toContain("attribute vec4 groundLayers;");
    expect(shader.vertexShader.indexOf("vGroundPosition =")).toBeGreaterThan(shader.vertexShader.indexOf(shaderMarkers.vertexBody));
    const fragment = shader.fragmentShader;
    const order = [shaderMarkers.color, "diffuseColor.rgb *= blend.x", shaderMarkers.roughness, "roughnessFactor = mix", shaderMarkers.normal, "normal = normalize((viewMatrix"];
    order.reduce((previous, marker) => {
      const at = fragment.indexOf(marker);
      expect(at).toBeGreaterThan(previous);
      return at;
    }, -1);
    for (let i = 0; i < 4; i++) {
      expect(shader.uniforms[`groundColor${i}`].value).toBe(maps.color[i]);
      expect(shader.uniforms[`groundSurface${i}`].value).toBe(maps.surface[i]);
    }
  });

  test("fails loudly if three.js moves a marker", () => {
    const maps = groundMaps(groundTextures.map(() => new Texture()), 4);
    const shader = { vertexShader: ShaderLib.physical.vertexShader.replace(shaderMarkers.vertexBody, ""), fragmentShader: ShaderLib.physical.fragmentShader, uniforms: {} };
    expect(() => patchGroundShader(shader, maps)).toThrow(shaderMarkers.vertexBody);
  });
});
