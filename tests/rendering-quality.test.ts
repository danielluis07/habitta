import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { DataTexture, Mesh, ShaderLib, type Material, type MeshStandardMaterial, type Object3D } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { configureLoader, disposeModel, foliage, foliageMarker, patchFoliageShader, reflective, shade } from "@/components/district-scene/models";
import {
  environmentMaps,
  FrameRateMonitor,
  initialTier,
  lowerTier,
  qualityTiers,
  readDevice,
  rendererName,
  stepDown,
  type Device,
} from "@/components/district-scene/quality";

// Rendering tiers, their selection and step-down, without WebGL.
describe("quality tiers", () => {
  test("the base tier draws at pixel ratio 1, with no shadow map and no post-processing", () => {
    expect(qualityTiers.base).toEqual({
      maxPixelRatio: 1, shadows: false, postProcessing: false, environmentMap: environmentMaps.base,
    });
  });

  test("the high tier adds the sun's shadow, SSAO and SMAA, a pixel ratio up to 2 and the upgraded map", () => {
    expect(qualityTiers.high).toEqual({
      maxPixelRatio: 2, shadows: true, postProcessing: true, environmentMap: environmentMaps.high,
    });
  });

  test("the high tier steps down to base, and nothing lies below base yet", () => {
    expect(lowerTier("high")).toBe("base");
    expect(lowerTier("base")).toBeUndefined();
  });
});

describe("tier selection at startup", () => {
  const desktop: Device = { desktop: true, cores: 8, renderer: "ANGLE (NVIDIA GeForce RTX 3060)" };

  test("a capable desktop gets the high tier", () => {
    expect(initialTier(desktop)).toBe("high");
    // Browsers that don't report cores or a GPU aren't held back for it.
    expect(initialTier({ desktop: true })).toBe("high");
  });

  test("phones, tablets and narrow windows get the base tier", () => {
    expect(initialTier({ ...desktop, desktop: false })).toBe("base");
  });

  test.each(["Google SwiftShader", "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))", "llvmpipe (LLVM 15.0.7, 256 bits)", "Microsoft Basic Render Driver"])(
    "a software renderer gets the base tier: %s",
    (renderer) => expect(initialTier({ ...desktop, renderer })).toBe("base"),
  );

  test("few cores or a data-saving browser get the base tier", () => {
    expect(initialTier({ ...desktop, cores: 2 })).toBe("base");
    expect(initialTier({ ...desktop, saveData: true })).toBe("base");
  });

  test("?quality= forces a tier for manual testing", () => {
    expect(initialTier({ ...desktop, requested: "base" })).toBe("base");
    expect(initialTier({ desktop: false, renderer: "SwiftShader", requested: "high" })).toBe("high");
  });

  test("the device is read from media queries, the navigator and the URL", () => {
    const browser = (queries: string[], search = "", navigator = {}) => ({
      matchMedia: (query: string) => ({ matches: queries.includes(query) }) as MediaQueryList,
      location: { search } as Location,
      navigator: { hardwareConcurrency: 8, ...navigator },
    });
    const fine = ["(hover: hover) and (pointer: fine)", "(min-width: 768px)"];
    expect(readDevice(browser(fine))).toEqual({ desktop: true, cores: 8, saveData: undefined, requested: undefined });
    expect(readDevice(browser(fine.slice(0, 1))).desktop).toBe(false);
    expect(readDevice(browser(fine.slice(1))).desktop).toBe(false);
    expect(readDevice(browser([], "?quality=high")).requested).toBe("high");
    expect(readDevice(browser([], "?quality=ultra")).requested).toBeUndefined();
    expect(readDevice(browser(fine, "", { hardwareConcurrency: 0, connection: { saveData: true } })))
      .toEqual({ desktop: true, cores: undefined, saveData: true, requested: undefined });
  });

  test("the renderer's GPU is unmasked only where the browser names itself", () => {
    const context = (renderer: string) => {
      const requested: string[] = [];
      const gl = {
        RENDERER: 1,
        getParameter: (name: number) => name === 1 ? renderer : "Google SwiftShader",
        getExtension: (name: string) => (requested.push(name), { UNMASKED_RENDERER_WEBGL: 2 }),
      } as unknown as WebGL2RenderingContext;
      return { gl, requested };
    };
    const chrome = context("WebKit WebGL");
    expect(rendererName(chrome.gl)).toBe("Google SwiftShader");
    const firefox = context("NVIDIA GeForce GTX 980, or similar");
    expect(rendererName(firefox.gl)).toBe("NVIDIA GeForce GTX 980, or similar");
    expect(firefox.requested).toEqual([]);
  });
});

describe("step-down on a sustained low frame rate", () => {
  const run = (monitor: FrameRateMonitor, fps: number, seconds: number) => {
    const results: boolean[] = [];
    for (let time = 0; time < seconds; time += 1 / fps) results.push(monitor.sample(1 / fps));
    return results;
  };

  test("a smooth frame rate never steps down", () => {
    expect(run(new FrameRateMonitor(), 60, 30)).not.toContain(true);
    expect(run(new FrameRateMonitor(), stepDown.minFrameRate + 5, 30)).not.toContain(true);
  });

  test("a low frame rate steps down once it has lasted a whole window of motion", () => {
    const results = run(new FrameRateMonitor(), 30, 3);
    const first = results.indexOf(true);
    expect(first).toBeGreaterThan(0);
    // Frame counts, at 30 FPS: the window fills on its 60th frame.
    expect(first).toBe(Math.round(stepDown.window * 30) - 1);
  });

  test("a single hitch, such as a shader compiling, is not a slow device", () => {
    const monitor = new FrameRateMonitor();
    run(monitor, 60, 1);
    expect(monitor.sample(0.4)).toBe(false);
    expect(run(monitor, 60, 5)).not.toContain(true);
  });

  test("one long frame alone never steps down, however long", () => {
    const monitor = new FrameRateMonitor();
    expect(monitor.sample(5)).toBe(false);
    expect(run(monitor, 60, 3)).not.toContain(true);
  });

  test("the frame after a pause, such as a hidden tab, isn't timed", () => {
    const monitor = new FrameRateMonitor();
    run(monitor, 60, 1);
    for (let i = 0; i < 30; i++) {
      monitor.pause();
      expect(monitor.sample(30)).toBe(false);
      monitor.sample(1 / 60);
    }
    expect(monitor.sample(0)).toBe(false);
    expect(run(monitor, 60, 3)).not.toContain(true);
  });

  test("very slow frames still step down once there are enough of them", () => {
    const results = run(new FrameRateMonitor(), 0.5, 30);
    expect(results.indexOf(true)).toBe(stepDown.minFrames - 1);
  });

  test("motion is timed across flights, and a reset starts over", () => {
    const monitor = new FrameRateMonitor();
    // Two 1.4-second flights at 20 FPS.
    expect(run(monitor, 20, 1.4)).not.toContain(true);
    expect(run(monitor, 20, 1.4)).toContain(true);
    monitor.reset();
    expect(run(monitor, 20, 1.4)).not.toContain(true);
  });
});

describe("glass and metal reflect the environment map", () => {
  let district: Object3D;

  beforeAll(async () => {
    const data = await Bun.file(resolve(import.meta.dir, "../public/models/district-low.glb")).arrayBuffer();
    const loader = new GLTFLoader();
    configureLoader(loader);
    district = (await loader.parseAsync(data, "")).scene;
  });

  const meshes = (model: Object3D) => {
    const found: Mesh[] = [];
    model.traverse((object) => { if (object instanceof Mesh) found.push(object); });
    return found;
  };
  const materials = (model: Object3D) =>
    [...new Set(meshes(model).flatMap((mesh): Material[] => [mesh.material].flat()))];

  test("the reflective finishes are the glass and the bronze", () => {
    expect(new Set(materials(district).filter(reflective).map(({ name }) => name))).toEqual(new Set(["Glass", "Dark bronze"]));
  });

  test("shading gives them the map, and a better map replaces it without recompiling", () => {
    const base = new DataTexture();
    const upgrade = new DataTexture();
    shade(district, base);
    for (const material of materials(district)) {
      expect("envMap" in material ? material.envMap : null).toBe(reflective(material) ? base : null);
    }
    const versions = materials(district).map(({ version }) => version);
    shade(district, upgrade);
    expect(materials(district).filter(reflective).every((material) => material.envMap === upgrade)).toBe(true);
    expect(materials(district).map(({ version }) => version)).toEqual(versions);
  });

  test("everything receives the sun's shadow; blended contact shades don't cast one", () => {
    shade(district, new DataTexture());
    for (const mesh of meshes(district)) {
      expect(mesh.receiveShadow).toBe(true);
      expect(mesh.castShadow).toBe(!(mesh.material as Material).transparent);
    }
    expect(meshes(district).some((mesh) => !mesh.castShadow)).toBe(true);
  });

  test("leaf cards cast their cut-out and keep their leaning normals on both faces", () => {
    shade(district, new DataTexture());
    const cards = meshes(district).filter((mesh) => foliage(mesh.material as Material));
    expect(cards.map(({ name }) => name)).toContain("vegetation_olives_instanced");
    for (const mesh of cards) {
      const material = mesh.material as MeshStandardMaterial;
      expect(mesh.castShadow).toBe(true);
      // three.js's shadow pass cuts the same leaves out of the shadow map.
      expect(material.alphaTest).toBe(0.5);
      expect(material.map).not.toBeNull();
      expect(material.onBeforeCompile).toBe(patchFoliageShader);
    }
    const patched = materials(district).filter((material) => material.onBeforeCompile === patchFoliageShader);
    expect(patched).toEqual([...new Set(cards.map((mesh) => mesh.material as Material))]);
    const shader = { fragmentShader: ShaderLib.standard.fragmentShader };
    patchFoliageShader(shader);
    expect(shader.fragmentShader).toContain(`#undef DOUBLE_SIDED\n${foliageMarker}`);
  });

  test("unloading a detailed building keeps the shared map", () => {
    const environment = new DataTexture();
    let disposed = false;
    environment.addEventListener("dispose", () => { disposed = true; });
    const detail = district.clone(true);
    shade(detail, environment);
    disposeModel(detail);
    expect(disposed).toBe(false);
  });
});
