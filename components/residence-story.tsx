import { ChevronDown } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { ConceptFigure } from "@/components/concept-figure";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { collection, type Concept } from "@/lib/collection";
import { cn } from "@/lib/utils";

type ResidenceStoryProps = {
  concept: Concept;
  headingRef: Ref<HTMLHeadingElement>;
  onContinueExploring: () => void;
};

const headingId = "residence-story-heading";

// Story images step out wider than the text column, up to about 1040px.
const figureSizes = "(min-width: 1120px) 1040px, 100vw";

// The featured residence as a scrolling editorial story. The reading order is
// fixed (#16): identification with the living visualization as the opening
// image, the idea and arrangement, the rooms, materials with the collapsed
// details, the home within its building, then the way on through the district.
export function ResidenceStory({ concept, headingRef, onContinueExploring }: ResidenceStoryProps) {
  const { building, featuredResidence: residence, facts, diagram, visualizations } = concept;
  const neighbours = collection
    .filter((other) => other.slug !== concept.slug)
    .map((other) => other.building.name);

  return (
    <article aria-labelledby={headingId} className="pb-24">
      <header className="px-4 pt-8 pb-10 md:px-10 md:pt-12 md:pb-14">
        <p className="type-eyebrow text-ink-muted">Imagined Habitta concept · Featured residence</p>
        <h1 id={headingId} ref={headingRef} tabIndex={-1} className="mt-4 type-display-xl">
          {residence.name}
        </h1>
        <p className="mt-4 font-display text-[1.375rem] leading-snug">
          {building.name} <span className="text-ink-muted">· {building.role}</span>
        </p>
        <p className="mt-1 type-body-sm text-ink-muted">{residence.position}</p>
        <p className="mt-6 max-w-[64ch] type-body-sm text-pretty">
          Habitta is a fictional studio, and this home is a proposal rather than a built place.
          Its images are concept visualizations of the design, not photographs.
        </p>
      </header>

      {/* The one full-bleed image. It keeps its own proportions until it has
          art-directed crops, because an automatic crop could cut the design. */}
      <ConceptFigure
        image={visualizations.living}
        sizes="100vw"
        eager
        captionClassName="px-4 md:px-10"
        caption={
          <VisualizationCaption label="Living space">
            {residence.roomStories.living}
          </VisualizationCaption>
        }
      />

      <div className="px-4 md:px-10">
        <StorySection id="residence-idea" title="The idea" className="max-w-[64ch]">
          <p className="mt-4 type-pull text-pretty">{residence.designIdea}</p>
        </StorySection>

        <StorySection id="residence-arrangement" title="The arrangement" className="max-w-[64ch]">
          <p className="mt-4 text-pretty">{residence.arrangement}</p>
        </StorySection>

        <StorySection id="residence-rooms" title="Room by room">
          <div className="mt-8 flex max-w-[1040px] flex-col gap-16">
            <ConceptFigure
              image={visualizations.outdoor}
              sizes={figureSizes}
              imageClassName="aspect-3/2 object-cover"
              caption={
                <VisualizationCaption label="Outdoor space">
                  {residence.roomStories.outdoor}
                </VisualizationCaption>
              }
            />
            <ConceptFigure
              image={visualizations.quietRoom}
              sizes={figureSizes}
              imageClassName="aspect-3/2 object-cover"
              caption={
                <VisualizationCaption label="Quiet room">
                  {residence.roomStories.quietRoom}
                </VisualizationCaption>
              }
            />
          </div>
        </StorySection>

        <StorySection id="residence-materials" title="Materials">
          <div className="mt-6 grid max-w-[1040px] gap-10 md:grid-cols-2 md:items-start">
            <dl className="border-t border-hairline">
              {residence.materials.map((material) => (
                <div key={material.name} className="border-b border-hairline py-3">
                  <dt className="type-label">{material.name}</dt>
                  <dd className="mt-1 type-body-sm text-ink-muted">{material.location}</dd>
                </div>
              ))}
            </dl>
            <ConceptFigure
              image={visualizations.materialStudy}
              sizes="(min-width: 1120px) 500px, (min-width: 768px) 45vw, 100vw"
              imageClassName="aspect-square object-cover"
              caption={
                <VisualizationCaption label="Material study">
                  {visualizations.materialStudy.caption}
                </VisualizationCaption>
              }
            />
          </div>

          <Collapsible className="mt-12 max-w-[1040px] border-y border-hairline">
            <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-4 py-4 text-left type-label">
              Dimensions and diagram
              <ChevronDown
                strokeWidth={1.5}
                className="size-5 shrink-0 group-data-panel-open:rotate-180"
              />
            </CollapsibleTrigger>
            {/* Kept in the page while collapsed, so crawlers and find-in-page reach it. */}
            <CollapsibleContent hiddenUntilFound>
              {/* A collapsed until-found panel keeps its box, so its padding lives inside. */}
              <div className="pb-8">
                <p className="type-body-sm text-ink-muted text-pretty">
                  Approximate design targets for an imagined home, not measurements.
                </p>
                <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
                  <Fact label="Interior area">Approx. {facts.interiorAreaM2} m²</Fact>
                  <Fact label="Outdoor area">
                    Approx. {facts.outdoorAreaM2} m²
                    <span className="block type-body-sm font-normal text-ink-muted first-letter:uppercase">
                      {facts.outdoorSpace}
                    </span>
                  </Fact>
                  <Fact label="Bedrooms">{facts.bedrooms}</Fact>
                  <Fact label="Building storeys">{facts.storeys}</Fact>
                  <Fact label="Building height">Approx. {facts.heightM} m</Fact>
                </dl>
                <ConceptFigure
                  image={diagram}
                  sizes="(min-width: 880px) 800px, 100vw"
                  className="mt-10 max-w-[800px]"
                  caption={
                    <>
                      <span className="block type-eyebrow text-ink-muted">Schematic, not to scale</span>
                      <span className="mt-1 block max-w-[64ch] type-caption text-ink-muted text-pretty">
                        How the rooms of {residence.name} relate to each other and to the outdoors. It
                        is a relationship drawing, not a measured floor plan.
                      </span>
                    </>
                  }
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </StorySection>

        <StorySection id="residence-building" title={`Within ${building.name}`}>
          <ConceptFigure
            image={visualizations.buildingContext}
            sizes={figureSizes}
            imageClassName="aspect-3/2 object-cover"
            className="mt-8 max-w-[1040px]"
            caption={
              <VisualizationCaption label="Building context">
                {visualizations.buildingContext.caption}
              </VisualizationCaption>
            }
          />
          <p className="mt-8 max-w-[64ch] text-pretty">{residence.buildingRelationship}</p>
        </StorySection>

        <StorySection
          id="residence-continue"
          title="More in the district"
          className="max-w-[1040px] border-t border-hairline pt-10">
          <p className="mt-4 max-w-[64ch] text-pretty">
            {new Intl.ListFormat("en").format(neighbours)} share the district with {building.name},
            each with a featured residence of its own.
          </p>
          <Button variant="outline" className="mt-6" onClick={onContinueExploring}>
            Continue exploring
          </Button>
        </StorySection>
      </div>
    </article>
  );
}

function StorySection({
  id,
  title,
  className,
  children,
}: {
  id: string;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("mt-16 md:mt-24", className)}>
      <h2 id={id} className="type-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

function VisualizationCaption({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <>
      <span className="block type-eyebrow text-ink-muted">Concept visualization · {label}</span>
      {children ? (
        <span className="mt-1 block max-w-[64ch] type-caption text-ink-muted text-pretty">
          {children}
        </span>
      ) : null}
    </>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="type-eyebrow text-ink-muted">{label}</dt>
      <dd className="mt-1 type-fact-value">{children}</dd>
    </div>
  );
}
