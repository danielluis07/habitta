import type { Ref } from "react";
import { ConceptStill } from "@/components/concept-still";
import { Button } from "@/components/ui/button";
import { collection } from "@/lib/collection";

type BuildingIndexProps = {
  id: string;
  hidden: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
};

export function BuildingIndex({ id, hidden, headingRef, onClose }: BuildingIndexProps) {
  const headingId = `${id}-heading`;

  return (
    <section
      id={id}
      hidden={hidden}
      aria-labelledby={headingId}
      className="px-4 pb-24 md:px-10">
      <div className="flex max-w-6xl items-center justify-between gap-4 border-b border-hairline pb-4">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="scroll-mt-6 type-heading">
          Building index
        </h2>
        <Button variant="ghost" aria-label="Close building index" onClick={onClose}>
          Close
        </Button>
      </div>
      <ol className="max-w-6xl">
        {collection.map((concept) => {
          const nameId = `${concept.slug}-name`;

          return (
            <li key={concept.slug} className="border-b border-hairline">
              <article
                aria-labelledby={nameId}
                className="grid gap-4 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-10 md:py-6">
                <ConceptStill
                  image={concept.building.exteriorStill}
                  sizes="(min-width: 640px) 40vw, 100vw"
                />
                <div className="flex flex-col gap-2">
                  <p className="type-eyebrow text-ink-muted">{concept.building.role}</p>
                  <h3 id={nameId} className="type-display-lg">
                    {concept.building.name}
                  </h3>
                  <p className="max-w-[52ch] type-body-sm text-pretty">
                    {concept.building.description}
                  </p>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="type-eyebrow text-ink-muted">Featured residence</span>
                    <span className="font-display text-[1.375rem] leading-snug">
                      {concept.featuredResidence.name}
                    </span>
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
