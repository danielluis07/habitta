"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { BuildingIndex } from "@/components/building-index";
import { BuildingOverview } from "@/components/building-overview";
import { DistrictScene } from "@/components/district-scene";
import { Button } from "@/components/ui/button";
import { useJourney } from "@/components/use-journey";
import { getConcept, type ConceptSlug } from "@/lib/collection";
import { districtStage, journeyPath, selectedSlug, type JourneyStage } from "@/lib/journey";
import { cn } from "@/lib/utils";

const indexId = "building-index";

type ExplorationProps = {
  /** The stage the URL asked for. Later stages are reached in place. */
  initialStage?: JourneyStage;
};

export function Exploration({ initialStage = districtStage }: ExplorationProps) {
  const [journey, dispatch] = useJourney(initialStage);
  const [indexOpen, setIndexOpen] = useState(false);
  const indexToggleRef = useRef<HTMLButtonElement>(null);
  const indexHeadingRef = useRef<HTMLHeadingElement>(null);
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  // The control that last selected a building, where focus returns when that
  // building's overview closes.
  const selectionTriggerRef = useRef<{ slug: ConceptSlug; control: HTMLElement } | null>(null);

  const overviewConcept =
    journey.stage.name === "building" ? getConcept(journey.stage.slug) : undefined;

  useEffect(() => {
    if (!indexOpen) return;
    const heading = indexHeadingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }, [indexOpen]);

  // Focus follows the visible journey, whether an intent or back/forward moved
  // it: into the overview when a building opens, and back to the triggering
  // control when the overview closes and takes focus with it.
  const stage = journey.stage;
  const previousStage = useRef(stage);
  useEffect(() => {
    const previous = previousStage.current;
    if (journeyPath(previous) === journeyPath(stage)) return;
    previousStage.current = stage;

    if (stage.name === "building") {
      overviewHeadingRef.current?.focus({ preventScroll: true });
      return;
    }

    const focused = document.activeElement;
    if (focused && focused !== document.body && focused.isConnected) return;
    const trigger = selectionTriggerRef.current;
    const returnToTrigger =
      trigger !== null &&
      trigger.slug === selectedSlug(previous) &&
      trigger.control.isConnected &&
      !trigger.control.closest("[hidden]");
    (returnToTrigger ? trigger.control : indexToggleRef.current)?.focus();
  }, [stage]);

  function closeIndex() {
    setIndexOpen(false);
    indexToggleRef.current?.focus();
  }

  function selectBuilding(slug: ConceptSlug, trigger: HTMLElement) {
    selectionTriggerRef.current = { slug, control: trigger };
    dispatch({ type: "selectBuilding", slug });
  }

  function returnHome(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    dispatch({ type: "resetView" });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-4 md:px-10 md:py-6">
        <Link href="/" className="type-wordmark" onClick={returnHome}>
          Habitta
        </Link>
        <Button
          ref={indexToggleRef}
          variant="outline"
          aria-expanded={indexOpen}
          aria-controls={indexId}
          onClick={() => setIndexOpen((open) => !open)}>
          Building index
        </Button>
      </header>

      {/* On narrow screens the overview is a bottom sheet; keep the page end reachable above it. */}
      <main className={cn("flex-1", overviewConcept && "max-md:pb-[60dvh]")}>
        <section
          aria-labelledby="arrival-heading"
          className="px-4 pt-16 pb-16 md:px-10 md:pt-24 md:pb-24">
          <p className="type-eyebrow text-ink-muted">Architecture studio</p>
          <h1 id="arrival-heading" className="mt-4 max-w-[18ch] type-display-xl text-balance">
            Imagined homes for a district above the clouds
          </h1>
          <p className="mt-6 max-w-[56ch] text-pretty">
            Habitta is an architecture studio showing imagined residential concepts. Every
            building here, and the home featured in each, is a proposal for one invented
            district, not a real development or listing.
          </p>
        </section>

        <DistrictScene />

        {overviewConcept ? (
          <BuildingOverview
            key={overviewConcept.slug}
            concept={overviewConcept}
            headingRef={overviewHeadingRef}
            onClose={() => dispatch({ type: "returnToDistrict" })}
          />
        ) : null}

        <BuildingIndex
          id={indexId}
          hidden={!indexOpen}
          headingRef={indexHeadingRef}
          onClose={closeIndex}
          selectedSlug={selectedSlug(journey.stage)}
          onSelect={selectBuilding}
        />
      </main>
    </div>
  );
}
