"use client";

import dynamic from "next/dynamic";

export const DistrictScene = dynamic(
  () => import("@/components/district-scene/scene"),
  { ssr: false },
);
