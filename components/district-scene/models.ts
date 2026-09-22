"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Mesh, Texture, type Material, type Object3D } from "three";
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

// Frees the GPU copies of a model's geometry, materials and textures.
export function disposeModel(model: Object3D) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof Texture) value.dispose();
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
