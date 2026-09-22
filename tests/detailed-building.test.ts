import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { resolve } from "node:path";
import { BufferGeometry, Mesh } from "three";
import { useDetailedBuilding } from "@/components/district-scene/models";
import type { ConceptSlug } from "@/lib/collection";

// The detailed model lifecycle behind the district scene, without WebGL:
// requests go to the committed GLBs, and nothing is rendered.
const publicDirectory = resolve(import.meta.dir, "../public");
const requests: string[] = [];
const originalFetch = globalThis.fetch;

function serveModels({ failing }: { failing?: string } = {}) {
  globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    requests.push(path);
    init?.signal?.throwIfAborted();
    if (path === failing) return new Response(null, { status: 404 });
    return new Response(await Bun.file(`${publicDirectory}${path}`).arrayBuffer());
  }) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  requests.length = 0;
});

function renderDetail(slug: ConceptSlug | undefined) {
  const onFailed = mock();
  const hook = renderHook(({ slug }) => useDetailedBuilding(slug, onFailed), {
    initialProps: { slug },
  });
  return { ...hook, onFailed };
}

describe("detailed building model", () => {
  test("loads nothing while no building is selected", () => {
    serveModels();
    const { result } = renderDetail(undefined);
    expect(result.current).toBeNull();
    expect(requests).toEqual([]);
  });

  test.each(["crest", "contour", "grove"] as const)(
    "selecting %s fetches only its detailed model, with both bindings",
    async (slug) => {
      serveModels();
      const { result } = renderDetail(slug);
      expect(result.current).toBeNull();

      await waitFor(() => expect(result.current).not.toBeNull());
      expect(requests).toEqual([`/models/building-${slug}.glb`]);
      expect(result.current!.slug).toBe(slug);
      expect(result.current!.target.name).toBe(`${slug}_selection_target`);
      expect(result.current!.anchor.name).toBe(`${slug}_label_anchor`);
    },
  );

  test("switching buildings frees the previous detail before the next one is in", async () => {
    serveModels();
    const { result, rerender } = renderDetail("crest");
    await waitFor(() => expect(result.current?.slug).toBe("crest"));
    const crest = result.current!.model;
    const geometries: BufferGeometry[] = [];
    crest.traverse((object) => {
      if (object instanceof Mesh) geometries.push(object.geometry);
    });
    const disposed = geometries.map((geometry) => spyOn(geometry, "dispose"));

    rerender({ slug: "grove" });
    expect(result.current).toBeNull();
    expect(disposed.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);

    await waitFor(() => expect(result.current?.slug).toBe("grove"));
    expect(requests).toEqual(["/models/building-crest.glb", "/models/building-grove.glb"]);
  });

  test("a detail that arrives after deselection never appears", async () => {
    serveModels();
    const { result, rerender, onFailed } = renderDetail("contour");
    rerender({ slug: undefined });
    await new Promise((settle) => setTimeout(settle, 50));
    expect(result.current).toBeNull();
    expect(onFailed).not.toHaveBeenCalled();

    // Reselecting starts a fresh load instead of reviving the stale one.
    rerender({ slug: "contour" });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current?.slug).toBe("contour"));
    expect(requests).toEqual(["/models/building-contour.glb", "/models/building-contour.glb"]);
  });

  test("a failed detailed model is reported, leaving the low-detail building", async () => {
    serveModels({ failing: "/models/building-grove.glb" });
    const { result, onFailed } = renderDetail("grove");
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });
});
