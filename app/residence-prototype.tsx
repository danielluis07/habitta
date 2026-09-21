"use client";

// Three residence-story variants on the existing / route via ?variant=A|B|C.
// Compare order, depth, and image roles; all content and diagrams are provisional.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildings } from "@/app/discovery-prototype-data";
import { residenceDrafts, storyVariants, type ResidenceDraft, type SceneKind, type StoryVariant } from "@/app/residence-prototype-data";
import ResidenceSketch from "@/app/residence-prototype-media";

type Props = { buildingIndex: number; variant: StoryVariant; onBack: () => void; onDistrict: () => void };
type ContentProps = { draft: ResidenceDraft; buildingIndex: number };

function ImageFrame({ kind, buildingIndex, caption }: { kind: SceneKind; buildingIndex: number; caption: string }) {
  return <figure className="residence-image"><ResidenceSketch kind={kind} buildingIndex={buildingIndex} /><figcaption><span>{caption}</span><small>Schematic image study</small></figcaption></figure>;
}

function Facts({ draft }: { draft: ResidenceDraft }) {
  return <div className="residence-facts"><dl>{draft.facts.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><p>Illustrative concept dimensions.</p></div>;
}

function Plan({ draft, selected, onSelect }: { draft: ResidenceDraft; selected?: number; onSelect?: (index: number) => void }) {
  const names = [draft.rooms[0].name, draft.rooms[1].name, draft.rooms[2].name];
  return <figure className="residence-plan"><div className="plan-drawing" data-duplex={draft.slug === "vale"}>
    {names.map((name, i) => onSelect ? <button key={name} className={`plan-space plan-space-${i}`} aria-pressed={selected === i} onClick={() => onSelect(i)}><span>{name}</span><small>{i === 2 && draft.slug === "vale" ? "Upper level" : "Explore this space"}</small></button> : <div key={name} className={`plan-space plan-space-${i}`}><span>{name}</span>{i === 2 && draft.slug === "vale" ? <small>Upper level</small> : null}</div>)}
    <div className="plan-core">{draft.slug === "vale" ? "Stair" : draft.slug === "serra" ? "Core" : "Passage"}</div>
  </div><figcaption>Spatial relationships only · Not a measured floor plan</figcaption></figure>;
}

function BuildingContext({ draft, buildingIndex }: ContentProps) {
  const building = buildings[buildingIndex];
  return <section className="residence-building"><ImageFrame kind="building" buildingIndex={buildingIndex} caption={`${building.name} / Building study`} /><div><p className="residence-kicker">A home within {building.name}</p><h2>Part of a larger idea.</h2><p>{draft.position}</p><p>{building.material}. One featured residence offers a closer look at the building’s approach to living.</p></div></section>;
}

function Contact({ residence }: { residence: string }) {
  return <section className="residence-contact"><div><p>Continue the conversation</p><h2>What would home<br />look like for you?</h2></div><details><summary>Contact Habitta</summary><p>A conversation about a residential design, with “{residence}” as a reference.</p><p className="contact-prototype-note">Contact placement preview. No message is sent; the studio and contact channel are fictional.</p></details></section>;
}

export function VariantA({ draft, buildingIndex }: ContentProps) {
  return <div className="editorial-story">
    <div className="editorial-opening"><div><p className="residence-lead">{draft.hook}</p><p>{draft.idea}</p></div><div><p className="residence-kicker">How the home is arranged</p><p>{draft.arrangement}</p></div></div>
    <ImageFrame kind="living" buildingIndex={buildingIndex} caption={draft.rooms[0].title} />
    <div className="editorial-sequence">{draft.rooms.slice(1).map(room => <section key={room.kind}><ImageFrame kind={room.kind} buildingIndex={buildingIndex} caption={room.name} /><div><h2>{room.title}</h2><p>{room.text}</p></div></section>)}</div>
    <section className="editorial-plan"><div><h2>Materials throughout the home.</h2><p>{draft.materials.join(", ")}. These surfaces recur across the home and its exterior.</p><details><summary>Dimensions & diagram</summary><Facts draft={draft} /><Plan draft={draft} /></details></div><ImageFrame kind="material" buildingIndex={buildingIndex} caption="Material relationships" /></section>
    <BuildingContext draft={draft} buildingIndex={buildingIndex} />
    <Contact residence={buildings[buildingIndex].residence} />
  </div>;
}

export function VariantB({ draft, buildingIndex }: ContentProps) {
  const [image, setImage] = useState(0);
  const frames = [...draft.rooms.map(room => ({ kind: room.kind, title: room.title, text: room.text, name: room.name })), { kind: "building" as const, title: `At home in ${buildings[buildingIndex].name}.`, text: draft.position, name: "Building" }, { kind: "material" as const, title: "A palette carried through.", text: draft.materials.join(", "), name: "Materials" }];
  const frame = frames[image];
  return <div className="gallery-story"><div className="gallery-stage"><ImageFrame kind={frame.kind} buildingIndex={buildingIndex} caption={frame.name} /><div className="gallery-controls"><Button variant="outline" onClick={() => setImage((image + frames.length - 1) % frames.length)} aria-label="Previous image">Previous</Button><span aria-live="polite">{image + 1} / {frames.length}</span><Button variant="outline" onClick={() => setImage((image + 1) % frames.length)} aria-label="Next image">Next</Button></div></div>
    <aside className="gallery-reading"><p className="residence-kicker">{draft.hook}</p><section aria-live="polite"><h2>{frame.title}</h2><p>{frame.text}</p></section><details><summary>The design idea</summary><p>{draft.idea}</p></details><details><summary>Arrangement & dimensions</summary><Facts draft={draft} /><p>{draft.arrangement}</p><Plan draft={draft} /></details><details><summary>Within {buildings[buildingIndex].name}</summary><p>{draft.position}</p><p>{buildings[buildingIndex].material}</p></details><Contact residence={buildings[buildingIndex].residence} /></aside>
    <output className="story-local-state">Viewing image {image + 1}: {frame.name}</output>
  </div>;
}

export function VariantC({ draft, buildingIndex }: ContentProps) {
  const [room, setRoom] = useState(0);
  const space = draft.rooms[room];
  return <div className="spatial-story"><div className="spatial-workspace"><aside><p className="residence-lead">{draft.hook}</p><p>{draft.idea}</p><Plan draft={draft} selected={room} onSelect={setRoom} /><Facts draft={draft} /></aside><section className="spatial-selected" aria-live="polite"><ImageFrame kind={space.kind} buildingIndex={buildingIndex} caption={space.name} /><h2>{space.title}</h2><p>{space.text}</p></section></div><div className="spatial-details"><p>{draft.arrangement}</p><details><summary>Materials throughout the home</summary><p>{draft.materials.join(", ")}.</p><ImageFrame kind="material" buildingIndex={buildingIndex} caption="Material relationships" /></details></div><BuildingContext draft={draft} buildingIndex={buildingIndex} /><Contact residence={buildings[buildingIndex].residence} /><output className="story-local-state">Selected space: {space.name}</output></div>;
}

export default function ResidencePrototype({ buildingIndex, variant, onBack, onDistrict }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const building = buildings[buildingIndex];
  const draft = residenceDrafts[buildingIndex];
  useEffect(() => { scroller.current?.scrollTo(0, 0); heading.current?.focus({ preventScroll: true }); }, [variant, buildingIndex]);
  return <article ref={scroller} className="residence-prototype" data-story-variant={variant} aria-label={`${building.residence} story`}>
    <header className="residence-header"><span className="habitta-wordmark">habitta</span><span>Residential concepts</span><Button variant="outline" onClick={onBack}>Back to {building.name}</Button></header>
    <div className="residence-body"><div className="residence-title"><p>{building.name} / Featured residence</p><h1 tabIndex={-1} ref={heading}>{building.residence}</h1><p>An imagined home by Habitta. A fictional architecture studio.</p></div>
      {variant === "A" ? <VariantA draft={draft} buildingIndex={buildingIndex} /> : variant === "B" ? <VariantB draft={draft} buildingIndex={buildingIndex} /> : <VariantC draft={draft} buildingIndex={buildingIndex} />}
      <footer className="residence-end"><p>There’s more to explore in the district.</p><Button onClick={onDistrict}>Return to the district</Button></footer>
      {process.env.NODE_ENV !== "production" ? <details className="story-review-notes"><summary>Prototype notes & image briefs</summary><p>{storyVariants.find(item => item.key === variant)?.hypothesis}</p><p>State: {variant} / {building.name} / {building.residence}. Discovery remains Open district. Names, measurements, diagrams, and copy are provisional. Contact is a local preview.</p><p>Proposed image set: one building context, living space, outdoor space, quiet room, and material study, plus a schematic plan. In the editorial variant, the opening image also serves as the living-space view.</p><ul>{draft.rooms.map(room => <li key={room.kind}><strong>{room.name}:</strong> {room.brief}</li>)}</ul><p>Building image: preserve the exterior silhouette, terrace arrangement, and material palette seen in the district. Material image: close-up of the same junctions and surfaces used in the room views.</p></details> : null}
    </div>
  </article>;
}
