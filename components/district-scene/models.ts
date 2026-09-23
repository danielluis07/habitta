"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { DoubleSide, Mesh, MeshStandardMaterial, Texture, type Material, type Object3D, type WebGLProgramParametersWithUniforms } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { getConcept, type ConceptSlug } from "@/lib/collection";

export function configureLoader(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

/** A building's selection target and label anchor, resolved in one model. */
export type BuildingBinding = {
  slug: ConceptSlug;
  target: Object3D;
  anchor: Object3D;
};

/** The selected building's detailed export, ready to replace its low-detail version. */
export type DetailedBuilding = BuildingBinding & { model: Object3D };

export function bindBuilding(slug: ConceptSlug, model: Object3D): BuildingBinding {
  const { scene } = getConcept(slug)!;
  const target = model.getObjectByName(scene.selectionTarget);
  const anchor = model.getObjectByName(scene.labelAnchor);
  if (!target || !anchor) throw new Error(`Missing scene binding for ${slug}`);
  return { slug, target, anchor };
}

/** Glass and metal: glossy or metallic finishes, which reflect the environment map. */
export function reflective(material: Material): material is MeshStandardMaterial {
  return material instanceof MeshStandardMaterial && (material.roughness <= 0.2 || material.metalness >= 0.5);
}

/** Leaf cards: alpha-tested, and seen from both sides. */
export function foliage(material: Material): material is MeshStandardMaterial {
  return material instanceof MeshStandardMaterial && material.alphaTest > 0 && material.side === DoubleSide;
}

/** Where the foliage patch goes in three.js's standard material shader. */
export const foliageMarker = "#include <normal_fragment_begin>";

/**
 * three.js turns a double-sided surface's normal around on its back face. A
 * leaf card's normals lean outward from its crown instead, the same on both
 * faces, so the crown lights as one mass whichever side of a card shows.
 */
export function patchFoliageShader(shader: Pick<WebGLProgramParametersWithUniforms, "fragmentShader">) {
  if (!shader.fragmentShader.includes(foliageMarker)) throw new Error(`The foliage shader expects "${foliageMarker}" in three.js's standard material.`);
  shader.fragmentShader = shader.fragmentShader.replace(foliageMarker, `#undef DOUBLE_SIDED\n${foliageMarker}`);
}

/**
 * Prepares a model for the scene's light: glass and metal reflect the
 * environment map, leaf cards keep their normals on both faces, everything
 * receives the sun's shadow, and everything but blended overlays, such as
 * contact shades, casts it; leaf cards cast their cut-out. Shadows only
 * appear where the tier draws them.
 */
export function shade(model: Object3D, environment: Texture) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    object.receiveShadow = true;
    object.castShadow = materials.every((material) => !material.transparent);
    for (const material of materials) {
      if (foliage(material) && material.onBeforeCompile !== patchFoliageShader) {
        material.onBeforeCompile = patchFoliageShader;
        material.customProgramCacheKey = () => "habitta-foliage";
        material.needsUpdate = true;
      }
      if (!reflective(material) || material.envMap === environment) continue;
      // Swapping one map for another needs no new shader; adding the first does.
      if (!material.envMap) material.needsUpdate = true;
      material.envMap = environment;
    }
  });
}

// Frees the GPU copies of a model's geometry, materials and textures. The
// environment map is the scene's, shared by every model, and stays.
export function disposeModel(model: Object3D) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const [key, value] of Object.entries(material)) {
        if (value instanceof Texture && key !== "envMap") value.dispose();
      }
      material.dispose();
    }
  });
}

/**
 * Loads the detailed GLB of the selected building, and only that one. The
 * result is `null` until it is ready, so the low-detail building stays in
 * view meanwhile. Deselecting or switching cancels a pending download and
 * frees the previous detail, keeping at most one detailed building in memory.
 */
export function useDetailedBuilding(
  slug: ConceptSlug | undefined,
  onFailed: (error: unknown) => void,
): DetailedBuilding | null {
  const [loaded, setLoaded] = useState<DetailedBuilding | null>(null);
  const reportFailure = useEffectEvent(onFailed);

  useEffect(() => {
    if (!slug) return;
    const request = new AbortController();
    let building: DetailedBuilding | null = null;

    (async () => {
      const response = await fetch(getConcept(slug)!.scene.detailedModel, { signal: request.signal });
      if (!response.ok) throw new Error(`${response.status} loading the ${slug} detailed model`);
      const data = await response.arrayBuffer();
      const loader = new GLTFLoader();
      configureLoader(loader);
      const { scene } = await loader.parseAsync(data, "");
      if (request.signal.aborted) return disposeModel(scene);
      building = { ...bindBuilding(slug, scene), model: scene };
      setLoaded(building);
    })().catch((error: unknown) => {
      if (!request.signal.aborted) reportFailure(error);
    });

    return () => {
      request.abort();
      if (building) disposeModel(building.model);
      setLoaded(null);
    };
  }, [slug]);

  // A render for a new selection precedes the cleanup above, so the previous
  // detail leaves the scene before it is freed.
  return loaded?.slug === slug ? loaded : null;
}
