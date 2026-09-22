import type { MouseEvent, Ref } from "react";
import { ConceptFigure } from "@/components/concept-figure";
import { Button } from "@/components/ui/button";
import { collection, type ConceptSlug } from "@/lib/collection";
import { journeyPath } from "@/lib/journey";
import { isPlainClick } from "@/lib/utils";

type BuildingIndexProps = {
  id: string;
  hidden: boolean;
  headingRef: Ref<HTMLHeadingElement>;
  /** Closes the index. Absent in simple view, where the index is the page. */
  onClose?: () => void;
  selectedSlug: ConceptSlug | undefined;
  /** Selects a building in place. `trigger` is the entry's link, for returning focus. */
  onSelect: (slug: ConceptSlug, trigger: HTMLElement) => void;
};

export function BuildingIndex({
  id,
  hidden,
  headingRef,
  onClose,
  selectedSlug,
  onSelect,
}: BuildingIndexProps) {
  const headingId = `${id}-heading`;

  function select(event: MouseEvent<HTMLAnchorElement>, slug: ConceptSlug) {
    // Modified clicks still open the building's own URL in a new tab or window.
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onSelect(slug, event.currentTarget);
  }

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
        {onClose ? (
          <Button variant="ghost" aria-label="Close building index" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
      <ol className="max-w-6xl">
        {collection.map((concept) => {
          const nameId = `${concept.slug}-name`;

          return (
            <li key={concept.slug} className="border-b border-hairline">
              <article
                aria-labelledby={nameId}
                className="relative grid gap-4 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-10 md:py-6">
                <ConceptFigure
                  image={concept.building.exteriorStill}
                  sizes="(min-width: 640px) 40vw, 100vw"
                  imageClassName="aspect-3/2 object-cover"
                />
                <div className="flex flex-col gap-2">
                  <p className="type-eyebrow text-ink-muted">{concept.building.role}</p>
                  <h3 id={nameId} className="type-display-lg">
                    {/* The link covers the whole entry, and so does its focus outline. */}
                    <a
                      href={journeyPath({ name: "building", slug: concept.slug })}
                      aria-current={concept.slug === selectedSlug ? "page" : undefined}
                      onClick={(event) => select(event, concept.slug)}
                      className="underline-offset-6 after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ink aria-[current=page]:underline">
                      {concept.building.name}
                    </a>
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
