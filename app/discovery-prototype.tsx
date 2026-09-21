"use client";

// Accepted Open district journey hosts three throwaway residence-story variants.
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import PrototypeSwitcher from "@/components/prototype-switcher";
import { buildings, variants, type Variant } from "@/app/discovery-prototype-data";
import type { SceneHandle } from "@/app/discovery-prototype-scene";
import ResidencePrototype from "@/app/residence-prototype";
import { residenceDrafts, storyVariants, type StoryVariant } from "@/app/residence-prototype-data";

const PrototypeScene = dynamic(() => import("@/app/discovery-prototype-scene"), {
  ssr: false,
  loading: () => <div className="scene-loading">Opening the district…</div>,
});

export default function DiscoveryPrototype() {
  const searchParams = useSearchParams();
  const value = searchParams.get("variant");
  const variant: StoryVariant = value === "B" || value === "C" ? value : "A";
  const initialResidence = residenceDrafts.findIndex(item => item.slug === searchParams.get("residence"));
  return <Journey variant="B" storyVariant={variant} initialResidence={initialResidence} />;
}

function Journey({ variant, storyVariant, initialResidence }: { variant: Variant; storyVariant: StoryVariant; initialResidence: number }) {
  const [entered, setEntered] = useState(variant !== "A");
  const [selected, setSelected] = useState<number | null>(initialResidence < 0 ? null : initialResidence);
  const [story, setStory] = useState(initialResidence >= 0);
  const wasStory = useRef(story);
  const [indexOpen, setIndexOpen] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const api = useRef<SceneHandle | null>(null);
  const initialSelection = useRef(initialResidence);
  const selectionInitialized = useRef(false);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const openStoryButton = useRef<HTMLButtonElement>(null);
  const building = selected === null ? null : buildings[selected];
  const onReady = useCallback((motion: boolean) => {
    setReady(true); setReduced(motion);
    if (!selectionInitialized.current && initialSelection.current >= 0) api.current?.select(initialSelection.current);
    selectionInitialized.current = true;
  }, []);

  function updateStoryUrl(index: number | null) {
    const url = new URL(window.location.href);
    if (index === null) url.searchParams.delete("residence");
    else url.searchParams.set("residence", residenceDrafts[index].slug);
    window.history.replaceState(null, "", url);
  }

  function select(index: number) {
    lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelected(index); setStory(false); setIndexOpen(false); api.current?.select(index);
  }
  function returnToDistrict() {
    setSelected(null); setStory(false); api.current?.select(null);
    updateStoryUrl(null);
    requestAnimationFrame(() => lastTrigger.current?.isConnected && lastTrigger.current.focus());
  }
  function closeStory() {
    setStory(false);
    updateStoryUrl(null);
  }
  useEffect(() => {
    if (wasStory.current && !story) {
      if (selected !== null) openStoryButton.current?.focus();
      else if (lastTrigger.current?.isConnected) lastTrigger.current.focus();
    }
    wasStory.current = story;
  }, [story, selected]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (story) { setStory(false); updateStoryUrl(null); }
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
        <a className="habitta-wordmark" href={`/?variant=${storyVariant}`} aria-label="Habitta, restart this journey">habitta<span>®</span></a>
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
        <Button ref={openStoryButton} size="lg" onClick={() => { setStory(true); updateStoryUrl(selected); }}>Discover this home <span aria-hidden="true">↗</span></Button>
        <Button variant="ghost" onClick={returnToDistrict}>Back to the district</Button>
      </section> : null}

      {entered ? <footer className="exploration-footer">
        <div><p>{selected === null ? "A shared horizon. Three distinct perspectives." : `You’re exploring ${building?.name}.`}</p><small>Drag to orbit · Scroll or pinch to zoom · Select a building</small></div>
        <div className="scene-actions"><Button variant="outline" onClick={() => { setSelected(null); api.current?.reset(); }}>Reset view</Button><Button variant="outline" aria-pressed={reduced} onClick={() => { setReduced(!reduced); api.current?.motion(!reduced); }}>Motion {reduced ? "off" : "on"}</Button></div>
      </footer> : <p className="arrival-footnote">Habitta is a fictional architecture studio.</p>}
    </div>

    {story && selected !== null ? <ResidencePrototype key={selected} buildingIndex={selected} variant={storyVariant} onBack={closeStory} onDistrict={returnToDistrict} /> : null}
    <PrototypeSwitcher current={storyVariant} options={storyVariants} label="Residence story prototype" />

    {process.env.NODE_ENV !== "production" && !story ? <details className="prototype-inspector"><summary>Prototype notes & state</summary><p>{variants.find(item => item.key === variant)?.hypothesis}</p><p>Select a building and discover its home to compare residence stories.</p><output>Story variant: {storyVariant}<br />Stage: {selected !== null ? "building" : "district"}<br />Selected: {building?.name ?? "none"}<br />Motion: {reduced ? "off" : "on"}<br />Index: {indexOpen ? "open" : "closed"}<br />Scene: {ready ? "ready or fallback" : "loading"}</output></details> : null}
  </main>;
}
