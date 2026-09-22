"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { BuildingIndex } from "@/components/building-index";
import { BuildingOverview } from "@/components/building-overview";
import { DistrictScene } from "@/components/district-scene";
import { ResidenceStory } from "@/components/residence-story";
import { Button } from "@/components/ui/button";
import { useJourney } from "@/components/use-journey";
import { getConcept, type ConceptSlug } from "@/lib/collection";
import { districtStage, journeyPath, selectedSlug, type JourneyStage } from "@/lib/journey";
import { cn, isPlainClick } from "@/lib/utils";

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
  const openResidenceRef = useRef<HTMLAnchorElement>(null);
  const storyHeadingRef = useRef<HTMLHeadingElement>(null);
  // The control that last selected a building, where focus returns when that
  // building's overview closes.
  const selectionTriggerRef = useRef<{ slug: ConceptSlug; control: HTMLElement } | null>(null);
  // Continue exploring leaves the story for the building index.
  const continueToIndexRef = useRef(false);
  // How far the district page was scrolled when a story replaced it.
  const districtScrollRef = useRef(0);

  const stage = journey.stage;
  const overviewConcept = stage.name === "building" ? getConcept(stage.slug) : undefined;
  const storyConcept = stage.name === "residence" ? getConcept(stage.slug) : undefined;

  // A direct link to a story doesn't load the district scene until the visitor
  // heads for the district. Once loaded, it stays mounted behind later stories.
  const [sceneWanted, setSceneWanted] = useState(stage.name !== "residence");
  if (!sceneWanted && stage.name !== "residence") setSceneWanted(true);

  useEffect(() => {
    if (!indexOpen) return;
    const heading = indexHeadingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }, [indexOpen]);

  // Focus follows the visible journey, whether an intent or back/forward moved
  // it: to the story heading when a story opens, into the overview when a
  // building opens, and back to the triggering control when a panel or story
  // closes and takes focus with it.
  const previousStage = useRef(stage);
  useEffect(() => {
    const previous = previousStage.current;
    if (journeyPath(previous) === journeyPath(stage)) return;
    previousStage.current = stage;

    if (stage.name === "residence") {
      if (previous.name !== "residence") districtScrollRef.current = window.scrollY;
      window.scrollTo(0, 0);
      storyHeadingRef.current?.focus({ preventScroll: true });
      return;
    }
    if (previous.name === "residence") window.scrollTo(0, districtScrollRef.current);

    if (stage.name === "building") {
      // Back from a story lands on the action that opened it.
      const backFromStory = previous.name === "residence" && previous.slug === stage.slug;
      (backFromStory ? openResidenceRef : overviewHeadingRef).current?.focus({
        preventScroll: true,
      });
      return;
    }

    if (continueToIndexRef.current) {
      continueToIndexRef.current = false;
      const heading = indexHeadingRef.current;
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: "start" });
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

  function openResidence(event: MouseEvent<HTMLAnchorElement>) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    dispatch({ type: "openResidence" });
  }

  function continueExploring() {
    continueToIndexRef.current = true;
    setIndexOpen(true);
    dispatch({ type: "continueExploring" });
  }

  function returnHome(event: MouseEvent<HTMLAnchorElement>) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    dispatch({ type: "resetView" });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-10 md:py-6">
        <Link href="/" className="type-wordmark" onClick={returnHome}>
          Habitta
        </Link>
        {storyConcept ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => dispatch({ type: "backToBuilding" })}>
              <ArrowLeft data-icon="inline-start" strokeWidth={1.5} />
              Back to {storyConcept.building.name}
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: "returnToDistrict" })}>
              Return to district
            </Button>
          </div>
        ) : (
          <Button
            ref={indexToggleRef}
            variant="outline"
            aria-expanded={indexOpen}
            aria-controls={indexId}
            onClick={() => setIndexOpen((open) => !open)}>
            Building index
          </Button>
        )}
      </header>

      {/* On narrow screens the overview is a bottom sheet; keep the page end reachable above it. */}
      <main className={cn("flex-1", overviewConcept && "max-md:pb-[60dvh]")}>
        {/* A story replaces the district view, which keeps its scene and index state behind it. */}
        <div hidden={storyConcept !== undefined}>
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

          {sceneWanted ? <DistrictScene /> : null}

          {overviewConcept ? (
            <BuildingOverview
              key={overviewConcept.slug}
              concept={overviewConcept}
              headingRef={overviewHeadingRef}
              openResidenceRef={openResidenceRef}
              onOpenResidence={openResidence}
              onClose={() => dispatch({ type: "returnToDistrict" })}
            />
          ) : null}

          <BuildingIndex
            id={indexId}
            hidden={!indexOpen}
            headingRef={indexHeadingRef}
            onClose={closeIndex}
            selectedSlug={selectedSlug(stage)}
            onSelect={selectBuilding}
          />
        </div>

        {storyConcept ? (
          <ResidenceStory
            key={storyConcept.slug}
            concept={storyConcept}
            headingRef={storyHeadingRef}
            onContinueExploring={continueExploring}
          />
        ) : null}
      </main>
    </div>
  );
}
