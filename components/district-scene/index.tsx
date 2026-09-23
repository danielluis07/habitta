"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import type { Clearance } from "@/components/district-scene/framing";
import type { ConceptSlug } from "@/lib/collection";
import type { JourneyStage, SimpleViewReason, Viewpoint } from "@/lib/journey";

export type SceneHandle = {
  getViewpoint: () => Viewpoint;
};

export type SceneProps = {
  stage: JourneyStage;
  savedViewpoint: Viewpoint | null;
  viewpointRef: Ref<SceneHandle>;
  onSelect: (slug: ConceptSlug, trigger: HTMLElement) => void;
  /** Whether the camera flies between views. With motion off, camera changes are instant. Nothing else moves. */
  motion: boolean;
  /** Reports that the scene can't be used, switching the page to simple view. */
  onSimpleView: (reason: Exclude<SimpleViewReason, "manual">) => void;
  /** How far the page's layers cover the canvas edges; the camera frames the buildings clear of them. */
  clearance: Clearance;
};

export function SceneLoading() {
  return (
    <p role="status" className="pointer-events-none absolute inset-x-4 bottom-4 z-1 bg-paper-raised p-3 type-body-sm text-ink-muted md:right-auto md:left-10 md:max-w-xl">
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

type DistrictSceneProps = Omit<SceneProps, "clearance"> & {
  /** Height of the page header, laid over the top of the district. */
  headerHeight: number;
  /** The arrival copy, laid over the sky below the header. */
  children: ReactNode;
};

// The building overview: a 380px side panel inset 40px from the right on wide
// screens, and a bottom sheet up to 60% of the height on narrow ones.
const wide = 768;
const overviewPanel = 380 + 40;
const overviewSheet = 0.6;

/** The canvas size, and how far the header and arrival copy reach down over it. */
type Layout = { width: number; height: number; header: number; copy: number };

function clearanceFor(stage: SceneProps["stage"], layout: Layout): Clearance {
  // The arrival copy steps aside while a building is open.
  if (stage.name !== "building") return { top: layout.copy, right: 0, bottom: 0, left: 0 };
  return layout.width >= wide
    ? { top: layout.header, right: overviewPanel, bottom: 0, left: 0 }
    : { top: layout.header, right: 0, bottom: layout.height * overviewSheet, left: 0 };
}

// The district fills the viewport, and the arrival copy sits over its sky.
// Where the viewport is too short for that, the copy sits above the district.
export function DistrictScene({ headerHeight, children, ...props }: DistrictSceneProps) {
  const region = useRef<HTMLElement>(null);
  const canvasBox = useRef<HTMLDivElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ width: 0, height: 0, header: 0, copy: 0 });
  const buildingOpen = props.stage.name === "building";

  useEffect(() => {
    const section = region.current!;
    const box = canvasBox.current!;
    const overlay = copy.current!;
    function measure() {
      const canvas = box.getBoundingClientRect();
      const top = canvas.top - section.getBoundingClientRect().top;
      const next = {
        width: canvas.width,
        height: canvas.height,
        header: Math.max(headerHeight - top, 0),
        copy: Math.max(overlay.getBoundingClientRect().bottom - canvas.top, 0),
      };
      setLayout((current) =>
        (Object.keys(next) as (keyof Layout)[]).every((key) => current[key] === next[key]) ? current : next);
    }
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [section, box, overlay]) observer.observe(element);
    return () => observer.disconnect();
  }, [headerHeight]);

  useEffect(() => {
    // Keep the label above the fixed bottom sheet, including on direct links.
    if (buildingOpen) canvasBox.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [buildingOpen]);

  return (
    <section
      ref={region}
      aria-label="District overview"
      className="grid min-h-svh grid-rows-[auto_1fr]">
      <div
        ref={canvasBox}
        className="relative col-start-1 row-span-2 row-start-1 overflow-hidden arrival-stacked:row-span-1 arrival-stacked:row-start-2 arrival-stacked:min-h-svh">
        <SceneBoundary onSimpleView={props.onSimpleView}>
          <LazyScene {...props} clearance={clearanceFor(props.stage, layout)} />
        </SceneBoundary>
      </div>
      {/* Clear of the header, estimated until it's measured. Clicks beside the copy reach the district. */}
      <div
        ref={copy}
        className="pointer-events-none relative col-start-1 row-start-1 pt-42 *:pointer-events-auto md:pt-26"
        style={{ paddingTop: headerHeight || undefined }}>
        {children}
      </div>
    </section>
  );
}
