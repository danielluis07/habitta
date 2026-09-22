"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  initialJourney,
  journeyPath,
  journeyReducer,
  type JourneyIntent,
  type JourneyStage,
  type Viewpoint,
} from "@/lib/journey";

// Runs the exploration journey in the browser. Each intent that changes the
// stage adds a history entry, and back/forward feed the URL back in as an
// intent, so the address bar and the journey never disagree. Native history
// calls keep the district mounted: Next.js syncs them into its router without
// a navigation.
export function useJourney(initialStage: JourneyStage, readViewpoint?: () => Viewpoint | null) {
  const [state, setState] = useState(() => initialJourney(initialStage));
  const stateRef = useRef(state);

  const dispatch = useCallback((intent: JourneyIntent) => {
    // Capture before any selection changes the camera, regardless of whether
    // it came from a scene label, the index, or browser back/forward.
    if (
      stateRef.current.stage.name === "district" &&
      (intent.type === "selectBuilding" || intent.type === "followUrl")
    ) {
      intent = { ...intent, viewpoint: intent.viewpoint ?? readViewpoint?.() ?? undefined };
    }
    const next = journeyReducer(stateRef.current, intent);
    if (next === stateRef.current) return;
    stateRef.current = next;

    const path = journeyPath(next.stage);
    if (intent.type !== "followUrl" && path !== window.location.pathname) {
      window.history.pushState(null, "", path);
    }
    setState(next);
  }, [readViewpoint]);

  useEffect(() => {
    function onPopState() {
      dispatch({ type: "followUrl", path: window.location.pathname });
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dispatch]);

  return [state, dispatch] as const;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// Whether the district may move: the visitor's in-page choice, or until they
// make one, the system reduced-motion preference. The server can't know that
// preference, so it renders motion on and hydration settles the real value.
export function useMotion(choice: boolean | null) {
  const systemReducesMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
  return choice ?? !systemReducesMotion;
}
