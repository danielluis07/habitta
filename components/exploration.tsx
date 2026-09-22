"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BuildingIndex } from "@/components/building-index";
import { DistrictScene } from "@/components/district-scene";
import { Button } from "@/components/ui/button";

const indexId = "building-index";

export function Exploration() {
  const [indexOpen, setIndexOpen] = useState(false);
  const indexToggleRef = useRef<HTMLButtonElement>(null);
  const indexHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!indexOpen) return;
    const heading = indexHeadingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
  }, [indexOpen]);

  function closeIndex() {
    setIndexOpen(false);
    indexToggleRef.current?.focus();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-4 md:px-10 md:py-6">
        <Link href="/" className="type-wordmark">
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

      <main className="flex-1">
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

        <BuildingIndex
          id={indexId}
          hidden={!indexOpen}
          headingRef={indexHeadingRef}
          onClose={closeIndex}
        />
      </main>
    </div>
  );
}
