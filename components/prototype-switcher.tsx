"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { variants, type Variant } from "@/app/discovery-prototype-data";

export default function PrototypeSwitcher({ current, options = variants, label = "Discovery prototype" }: { current: Variant; options?: readonly { key: Variant; name: string }[]; label?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const index = options.findIndex(variant => variant.key === current);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable], [role=slider], [role=tablist]")) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next = (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
      const params = new URLSearchParams(searchParams.toString()); params.set("variant", options[next].key);
      router.replace(`/?${params.toString()}`, { scroll: false });
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [index, router, searchParams, options]);

  if (process.env.NODE_ENV === "production") return null;
  function cycle(direction: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", options[(index + direction + options.length) % options.length].key);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }
  return <nav className="prototype-switcher" aria-label="Prototype variants">
    <Button variant="ghost" size="icon" onClick={() => cycle(-1)} aria-label="Previous prototype variant">←</Button>
    <div><small>{label}</small><strong>{current} / {options[index].name}</strong></div>
    <Button variant="ghost" size="icon" onClick={() => cycle(1)} aria-label="Next prototype variant">→</Button>
  </nav>;
}
