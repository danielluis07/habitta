"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, type ReactNode, type Ref } from "react";
import type { ConceptSlug } from "@/lib/collection";
import type { JourneyStage, SimpleViewReason, Viewpoint } from "@/lib/journey";
import { cn } from "@/lib/utils";

export type SceneHandle = {
  getViewpoint: () => Viewpoint;
};

export type SceneProps = {
  stage: JourneyStage;
  savedViewpoint: Viewpoint | null;
  viewpointRef: Ref<SceneHandle>;
  onSelect: (slug: ConceptSlug, trigger: HTMLElement) => void;
  /** Whether the district may move. With motion off, camera changes are instant and the scene is still. */
  motion: boolean;
  /** Reports that the scene can't be used, switching the page to simple view. */
  onSimpleView: (reason: Exclude<SimpleViewReason, "manual">) => void;
};

export function SceneLoading() {
  return (
    <p role="status" className="pointer-events-none absolute inset-x-4 top-4 z-1 bg-paper-raised p-3 type-body-sm text-ink-muted">
      Loading the district… You can explore through the Building index while you wait.
    </p>
  );
}

const LazyScene = dynamic<SceneProps>(
  () => import("@/components/district-scene/scene"),
  { ssr: false, loading: SceneLoading },
);

// Covers both a failed lazy import and errors propagated from the R3F root.
class SceneBoundary extends Component<{
  children: ReactNode;
  onSimpleView: SceneProps["onSimpleView"];
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onSimpleView("assetFailed");
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function DistrictScene(props: SceneProps) {
  const region = useRef<HTMLElement>(null);
  const buildingOpen = props.stage.name === "building";
  useEffect(() => {
    // Keep the label above the fixed bottom sheet, including on direct links.
    if (buildingOpen) region.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [buildingOpen]);

  return (
    <section
      ref={region}
      aria-label="District overview"
      className={cn(
        "relative h-[65svh] min-h-80 overflow-hidden md:h-[calc(100svh-9rem)] md:scroll-mt-24",
        buildingOpen && "max-md:h-[36svh] max-md:min-h-0 md:mr-[420px]",
      )}>
      <SceneBoundary onSimpleView={props.onSimpleView}>
        <LazyScene {...props} />
      </SceneBoundary>
    </section>
  );
}
