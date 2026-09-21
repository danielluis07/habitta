"use client";

// Three structurally different discovery journeys on /?variant=A|B|C.
// This branch answers an interaction question; all concepts and detail copy are placeholders.
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import PrototypeSwitcher from "@/components/prototype-switcher";
import { buildings, variants, type Variant } from "@/app/discovery-prototype-data";
import type { SceneHandle } from "@/app/discovery-prototype-scene";

const PrototypeScene = dynamic(() => import("@/app/discovery-prototype-scene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Opening the district…</div>,
});

export default function DiscoveryPrototype() {
  const searchParams = useSearchParams();
  const value = searchParams.get("variant");
  const variant: Variant = value === "B" || value === "C" ? value : "A";
  return <><Journey key={variant} variant={variant} /><PrototypeSwitcher current={variant} /></>;
}

function Journey({ variant }: { variant: Variant }) {
  const [entered, setEntered] = useState(variant !== "A");
  const [selected, setSelected] = useState<number | null>(null);
  const [story, setStory] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const api = useRef<SceneHandle | null>(null);
  const storyHeading = useRef<HTMLHeadingElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const openStoryButton = useRef<HTMLButtonElement>(null);
  const building = selected === null ? null : buildings[selected];
  const onReady = useCallback((motion: boolean) => { setReady(true); setReduced(motion); }, []);

  function select(index: number) {
    lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(index); setStory(false); setIndexOpen(false); api.current?.select(index);
  }
  function returnToDistrict() {
    setSelected(null); setStory(false); api.current?.select(null);
    requestAnimationFrame(() => lastTrigger.current?.isConnected && lastTrigger.current.focus());
  }
  function closeStory() {
    setStory(false);
    requestAnimationFrame(() => openStoryButton.current?.focus());
  }
  useEffect(() => { if (story) storyHeading.current?.focus(); }, [story]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (story) { setStory(false); requestAnimationFrame(() => openStoryButton.current?.focus()); }
      else if (indexOpen) setIndexOpen(false);
      else if (selected !== null) { setSelected(null); api.current?.select(null); requestAnimationFrame(() => lastTrigger.current?.isConnected && lastTrigger.current.focus()); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [story, indexOpen, selected]);

  function enter(immediate = false) { setEntered(true); api.current?.arrive(immediate); }
  const index = <div className="building-index">
    {buildings.map((item, i) => <button key={item.name} onClick={() => select(i)} aria-pressed={selected === i} className="building-row">
      <span className={`building-silhouette silhouette-${i}`} aria-hidden="true" />
      <span><strong>{item.name}</strong><small>{item.type}</small></span><span aria-hidden="true">↗</span>
    </button>)}
  </div>;

  return <main className="discovery-prototype" data-variant={variant} data-story={story} data-entered={entered}>
    <div className="journey-surface" inert={story} aria-hidden={story || undefined}>
      <header className="discovery-header">
        <a className="habitta-wordmark" href={`/?variant=${variant}`} aria-label="Habitta, restart this journey">habitta<span>®</span></a>
        <span className="studio-description">Imagined architecture.<br />A place to explore.</span>
        {entered ? <Button variant="outline" onClick={() => setIndexOpen(!indexOpen)} aria-expanded={indexOpen}>Building index <span aria-hidden="true">{indexOpen ? "−" : "+"}</span></Button> : <span className="header-note">Residential concepts</span>}
      </header>

      <div className="scene-frame">
        <PrototypeScene variant={variant} entered={entered} selected={selected} onSelect={select} onReady={onReady} apiRef={api} />
        <div className="horizon-wash" />
      </div>

      {variant === "A" && !entered ? <section className="arrival-copy">
        <p>A district above the clouds</p><h1>Room<br />to imagine.</h1>
        <p>Three ways of living.<br />One continuous landscape.</p>
        <div className="arrival-actions"><Button size="lg" disabled={!ready} onClick={() => enter()}>Explore the district <span aria-hidden="true">↗</span></Button><Button variant="ghost" disabled={!ready} onClick={() => enter(true)}>Skip arrival</Button></div>
      </section> : null}

      {variant === "B" && selected === null ? <section className="district-title"><h1>The highland<br />district.</h1><p>Choose a building. Find a different way to live.</p></section> : null}

      {variant === "C" ? <aside className="collection-panel"><p>Habitta / Residential concepts</p><h1>In good<br />company.</h1><p>Distinct buildings.<br />A shared horizon.</p>{index}<small>Each concept opens one featured residence.</small></aside> : null}

      {indexOpen ? <aside className="index-popover" aria-label="Building index"><div className="index-heading"><h2>Explore the collection</h2><Button variant="ghost" size="icon" onClick={() => setIndexOpen(false)} aria-label="Close building index">×</Button></div>{index}</aside> : null}

      {entered && building ? <section className="building-preview" aria-label={`${building.name} overview`}>
        <div className="preview-meta"><span>{building.type}</span><Button variant="ghost" size="icon" onClick={returnToDistrict} aria-label="Return to district">×</Button></div>
        <h2>{building.name}</h2><p>{building.material}</p>
        <div className="residence-teaser"><small>Featured residence</small><h3>{building.residence}</h3></div>
        <Button ref={openStoryButton} size="lg" onClick={() => setStory(true)}>Discover this home <span aria-hidden="true">↗</span></Button>
        <Button variant="ghost" onClick={returnToDistrict}>Back to the district</Button>
      </section> : null}

      {entered ? <footer className="exploration-footer">
        <div><p>{selected === null ? "A shared horizon. Three distinct perspectives." : `You’re exploring ${building?.name}.`}</p><small>Drag to orbit · Scroll or pinch to zoom · Select a building</small></div>
        <div className="scene-actions"><Button variant="outline" onClick={() => { setSelected(null); api.current?.reset(); }}>Reset view</Button><Button variant="outline" aria-pressed={reduced} onClick={() => { setReduced(!reduced); api.current?.motion(!reduced); }}>Motion {reduced ? "off" : "on"}</Button></div>
      </footer> : <p className="arrival-footnote">Habitta is a fictional architecture studio.</p>}
    </div>

    {story && building ? <article className="prototype-story">
      <header><span className="habitta-wordmark">habitta</span><Button variant="outline" onClick={closeStory}>Back to {building.name}</Button></header>
      <div className="story-content"><p>{building.name} / Featured residence</p><h1 ref={storyHeading} tabIndex={-1}>{building.residence}</h1><p>{building.description}</p><div className="story-placeholder"><span className={`building-silhouette silhouette-${selected}`} aria-hidden="true" /><p>Residence imagery and the detailed story<br />will be explored in the next prototype.</p></div><p className="fiction-note">An imagined residential concept by Habitta.</p><Button onClick={returnToDistrict}>Return to the district</Button></div>
    </article> : null}

    {process.env.NODE_ENV !== "production" ? <details className="prototype-inspector"><summary>Prototype notes & state</summary><p>{variants.find(item => item.key === variant)?.hypothesis}</p><p>Draft geometry, names, and content. The question is arrival → discovery → building → residence → return.</p><output>Variant: {variant}<br />Stage: {story ? "residence" : selected !== null ? "building" : entered ? "district" : "arrival"}<br />Selected: {building?.name ?? "none"}<br />Motion: {reduced ? "off" : "on"}<br />Index: {indexOpen ? "open" : "closed"}<br />Scene: {ready ? "ready or fallback" : "loading"}</output></details> : null}
  </main>;
}
