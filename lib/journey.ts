// The exploration journey: where the visitor is (district, a building, or its
// featured residence), how they prefer to see it, and the intents that move
// them. It is plain state with no rendering or 3D. The page renders from it,
// the district scene will read it as input, and the URL mirrors its stage.
// Camera viewpoint and preferences never reach the URL.

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

/** Whether the district is shown as the 3D scene or as simple view. */
export type ViewMode = "scene" | "simple";

/**
 * Why the page switched to simple view: the visitor asked (`manual`), or the
 * 3D scene couldn't be used.
 */
export type SimpleViewReason = "unsupported" | "contextLost" | "assetFailed" | "slow" | "manual";

export type JourneyState = {
  stage: JourneyStage;
  /**
   * The district viewpoint saved when a building was selected from the
   * district. In `district` it is where the camera returns to; `null` means the
   * default district overview.
   */
  savedViewpoint: Viewpoint | null;
  /**
   * Whether the visitor turned motion on or off in the page. `null` until they
   * do, while the system reduced-motion preference decides.
   */
  motionChoice: boolean | null;
  viewMode: ViewMode;
  /** Why the page switched to simple view, while its brief notice shows. */
  simpleViewReason: SimpleViewReason | null;
};

export type JourneyIntent =
  | {
      type: "selectBuilding";
      slug: ConceptSlug;
      /** The scene's current viewpoint, saved only when selecting from the district. */
      viewpoint?: Viewpoint;
    }
  | { type: "returnToDistrict" }
  /** Opens the selected building's featured residence. Only a building overview offers it. */
  | { type: "openResidence" }
  | { type: "backToBuilding" }
  /** Leaves the end of a residence story for the district, to pick the next concept. */
  | { type: "continueExploring" }
  /** The wordmark: the district overview, from anywhere in the journey. */
  | { type: "returnHome" }
  /** The URL changed underneath the journey, e.g. through browser back/forward. */
  | { type: "followUrl"; path: string; viewpoint?: Viewpoint }
  | { type: "setMotion"; enabled: boolean }
  /** The visitor's simple view control and the scene's failures both switch through here. */
  | { type: "switchToSimpleView"; reason: SimpleViewReason }
  | { type: "switchToScene" }
  | { type: "dismissSimpleViewNotice" };

export const districtStage: JourneyStage = { name: "district" };

export function initialJourney(stage: JourneyStage = districtStage): JourneyState {
  return {
    stage,
    savedViewpoint: null,
    motionChoice: null,
    viewMode: "scene",
    simpleViewReason: null,
  };
}

export function journeyReducer(state: JourneyState, intent: JourneyIntent): JourneyState {
  switch (intent.type) {
    case "selectBuilding": {
      const stage: JourneyStage = { name: "building", slug: intent.slug };
      if (state.stage.name !== "district") return { ...state, stage };
      return { ...state, stage, savedViewpoint: intent.viewpoint ?? null };
    }
    case "returnToDistrict":
      return { ...state, stage: districtStage };
    case "openResidence":
      if (state.stage.name !== "building") return state;
      return { ...state, stage: { name: "residence", slug: state.stage.slug } };
    case "backToBuilding":
      if (state.stage.name !== "residence") return state;
      return { ...state, stage: { name: "building", slug: state.stage.slug } };
    case "continueExploring":
      if (state.stage.name !== "residence") return state;
      return { ...state, stage: districtStage };
    case "returnHome":
      // The default district overview, with the visitor's preferences kept.
      return { ...state, stage: districtStage, savedViewpoint: null };
    case "followUrl": {
      const stage = parseJourneyPath(intent.path);
      if (!stage) return state;
      const leavingDistrict = state.stage.name === "district" && stage.name !== "district";
      return {
        ...state,
        stage,
        savedViewpoint: leavingDistrict ? intent.viewpoint ?? null : state.savedViewpoint,
      };
    }
    // Preferences never change the stage or selection.
    case "setMotion":
      return state.motionChoice === intent.enabled
        ? state
        : { ...state, motionChoice: intent.enabled };
    case "switchToSimpleView":
      if (state.viewMode === "simple") return state;
      return { ...state, viewMode: "simple", simpleViewReason: intent.reason };
    case "switchToScene":
      if (state.viewMode === "scene") return state;
      return { ...state, viewMode: "scene", simpleViewReason: null };
    case "dismissSimpleViewNotice":
      return state.simpleViewReason === null ? state : { ...state, simpleViewReason: null };
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
