import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import type { Concept } from "@/lib/collection";

type BuildingOverviewProps = {
  concept: Concept;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
};

const headingId = "building-overview-heading";

// A side panel on wide screens and a bottom sheet on narrow ones. The visitor
// stays in the district while it is open.
export function BuildingOverview({ concept, headingRef, onClose }: BuildingOverviewProps) {
  const { building, featuredResidence } = concept;

  return (
    <section
      aria-labelledby={headingId}
      className="fixed inset-x-0 bottom-0 z-10 max-h-[60dvh] overflow-y-auto border-t border-border-control bg-paper-raised p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 md:top-24 md:right-10 md:bottom-auto md:left-auto md:max-h-[calc(100dvh-8rem)] md:w-[380px] md:rounded-sm md:border">
      <p className="type-eyebrow text-ink-muted">Imagined concept · {building.role}</p>
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="mt-3 type-display-lg">
        {building.name}
      </h2>
      <p className="mt-3 type-body-sm text-pretty">{building.description}</p>
      <div className="mt-6 border-t border-hairline pt-4">
        <p className="type-eyebrow text-ink-muted">Featured residence</p>
        <p className="mt-1 font-display text-[1.375rem] leading-snug">
          {featuredResidence.name}
        </p>
        <p className="mt-1 type-body-sm text-ink-muted">{featuredResidence.position}</p>
      </div>
      <Button variant="outline" className="mt-6" onClick={onClose}>
        Return to district
      </Button>
    </section>
  );
}
