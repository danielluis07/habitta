"use client";

import { useLoader } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { EquirectangularReflectionMapping, type Texture } from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { environmentMaps } from "@/components/district-scene/quality";

/** Loads an equirectangular Radiance HDR, ready for materials to reflect. */
class EnvironmentLoader extends HDRLoader {
  override load(...[url, onLoad, ...rest]: Parameters<HDRLoader["load"]>) {
    return super.load(url, (texture, data) => {
      texture.mapping = EquirectangularReflectionMapping;
      onLoad?.(texture, data);
    }, ...rest);
  }
}

/**
 * The environment map glass and metal reflect. Like the district, the base map
 * suspends until loaded, and a failure reaches the scene's error boundary.
 * Once `upgrade` names another map, that one loads in the background and
 * replaces the base map when ready. It stays after a step down: its cost was
 * the download, not the frames. A failed upgrade keeps the base map.
 */
export function useEnvironment(upgrade: string | null): Texture {
  const base = useLoader(EnvironmentLoader, environmentMaps.base);
  const [requested, setRequested] = useState<string | null>(null);
  const [upgraded, setUpgraded] = useState<Texture | null>(null);
  if (upgrade && !requested) setRequested(upgrade);

  useEffect(() => {
    if (!requested) return;
    let texture: Texture | null = null;
    let cancelled = false;
    new EnvironmentLoader().loadAsync(requested).then((loaded) => {
      if (cancelled) return loaded.dispose();
      texture = loaded;
      setUpgraded(loaded);
    }, (error: unknown) => {
      console.warn(`Keeping the base environment map: ${requested} failed to load.`, error);
    });
    return () => {
      cancelled = true;
      texture?.dispose();
    };
  }, [requested]);

  return upgraded ?? base;
}
