"use client";

import dynamic from "next/dynamic";
import type { SimpleViewReason } from "@/lib/journey";

export type SceneProps = {
  /** Whether the district may move. With motion off, camera changes are instant and the scene is still. */
  motion: boolean;
  /** Reports that the scene can't be used, switching the page to simple view. */
  onSimpleView: (reason: Exclude<SimpleViewReason, "manual">) => void;
};

export const DistrictScene = dynamic<SceneProps>(
  () => import("@/components/district-scene/scene"),
  { ssr: false },
);
