// The exploration journey: where the visitor is (district, a building, or its
// featured residence) and the intents that move them. It is plain state with no
// rendering or 3D. The page renders from it, the district scene will read it as
// input, and the URL mirrors its stage. Camera viewpoint and preferences never
// reach the URL.

import { getConcept, type ConceptSlug } from "@/lib/collection";

export type JourneyStage =
  | { name: "district" }
  | { name: "building"; slug: ConceptSlug }
  | { name: "residence"; slug: ConceptSlug };

/** A camera pose in district space, captured and restored by the scene. */
export type Viewpoint = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
};

export type JourneyState = {
  stage: JourneyStage;
  /**
   * The district viewpoint saved when a building was selected from the
   * district. In `district` it is where the camera returns to; `null` means the
   * default district overview.
   */
  savedViewpoint: Viewpoint | null;
};

export type JourneyIntent =
  | {
      type: "selectBuilding";
      slug: ConceptSlug;
      /** The scene's current viewpoint, saved only when selecting from the district. */
      viewpoint?: Viewpoint;
    }
  | { type: "returnToDistrict" }
  | { type: "resetView" }
  /** The URL changed underneath the journey, e.g. through browser back/forward. */
  | { type: "followUrl"; path: string };

export const districtStage: JourneyStage = { name: "district" };

export function initialJourney(stage: JourneyStage = districtStage): JourneyState {
  return { stage, savedViewpoint: null };
}

export function journeyReducer(state: JourneyState, intent: JourneyIntent): JourneyState {
  switch (intent.type) {
    case "selectBuilding": {
      const stage: JourneyStage = { name: "building", slug: intent.slug };
      if (state.stage.name !== "district") return { ...state, stage };
      return { stage, savedViewpoint: intent.viewpoint ?? null };
    }
    case "returnToDistrict":
      return { ...state, stage: districtStage };
    case "resetView":
      return initialJourney();
    case "followUrl": {
      const stage = parseJourneyPath(intent.path);
      return stage ? { ...state, stage } : state;
    }
  }
}

export function journeyPath(stage: JourneyStage): string {
  switch (stage.name) {
    case "district":
      return "/";
    case "building":
      return `/buildings/${stage.slug}`;
    case "residence":
      return `/buildings/${stage.slug}/residence`;
  }
}

/** The stage a path represents, or `undefined` when it isn't a journey URL. */
export function parseJourneyPath(path: string): JourneyStage | undefined {
  const segments = path.split(/[?#]/)[0].split("/").filter(Boolean);
  if (segments.length === 0) return districtStage;
  if (segments[0] !== "buildings") return undefined;

  const slug = getConcept(segments[1] ?? "")?.slug;
  if (!slug) return undefined;
  if (segments.length === 2) return { name: "building", slug };
  if (segments.length === 3 && segments[2] === "residence") return { name: "residence", slug };
  return undefined;
}

/** The selected building, in any stage that has one. */
export function selectedSlug(stage: JourneyStage): ConceptSlug | undefined {
  return stage.name === "district" ? undefined : stage.slug;
}
