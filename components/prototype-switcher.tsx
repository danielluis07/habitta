"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { variants, type Variant } from "@/app/discovery-prototype-data";

export default function PrototypeSwitcher({ current }: { current: Variant }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const index = variants.findIndex(variant => variant.key === current);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], [role=slider], [role=tablist]")) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next = (index + (event.key === "ArrowRight" ? 1 : -1) + variants.length) % variants.length;
      const params = new URLSearchParams(searchParams.toString()); params.set("variant", variants[next].key);
      router.replace(`/?${params.toString()}`, { scroll: false });
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [index, router, searchParams]);

  if (process.env.NODE_ENV === "production") return null;
  function cycle(direction: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", variants[(index + direction + variants.length) % variants.length].key);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }
  return <nav className="prototype-switcher" aria-label="Prototype variants">
    <Button variant="ghost" size="icon" onClick={() => cycle(-1)} aria-label="Previous prototype variant">←</Button>
    <div><small>Discovery prototype</small><strong>{current} / {variants[index].name}</strong></div>
    <Button variant="ghost" size="icon" onClick={() => cycle(1)} aria-label="Next prototype variant">→</Button>
  </nav>;
}
