import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { collection, visualizationRoles, type ConceptImage } from "@/lib/collection";
import { provenanceManifest, type ProvenanceEntry } from "@/lib/provenance";

// Seam 2: collection integrity. Incomplete or contradictory concept content
// fails here before it can ship.

const requiredProvenanceFields = [
  "id",
  "conceptSlug",
  "role",
  "file",
  "dccRevision",
  "glbRevisions",
  "referenceHashes",
  "provider",
  "model",
  "promptTemplateRevision",
  "parameters",
  "reviewer",
  "timestamp",
  "postProcessing",
  "status",
  "statusReason",
] as const satisfies readonly (keyof ProvenanceEntry)[];

function isFilled(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0 && value.every(isFilled);
  if (value && typeof value === "object") {
    const values = Object.values(value);
    return values.length > 0 && values.every(isFilled);
  }
  return value !== undefined && value !== null;
}

function imagesOf(concept: (typeof collection)[number]): ConceptImage[] {
  return [concept.building.exteriorStill, concept.diagram, ...Object.values(concept.visualizations)];
}

function publicFile(src: string) {
  return readFileSync(join(import.meta.dir, "..", "public", src), "utf8");
}

test("holds exactly the three accepted concepts, with unique slugs", () => {
  const slugs = collection.map((concept) => concept.slug);

  expect(slugs).toEqual(["crest", "contour", "grove"]);
  expect(new Set(slugs).size).toBe(slugs.length);
});

describe.each(collection.map((concept) => [concept.slug, concept] as const))("%s", (_, concept) => {
  test("has all five visualization roles, a diagram, and non-empty alt text", () => {
    expect(Object.keys(concept.visualizations).sort()).toEqual([...visualizationRoles].sort());
    for (const role of visualizationRoles) {
      expect(concept.visualizations[role].role).toBe(role);
    }

    expect(concept.diagram.src).not.toBe("");
    for (const image of imagesOf(concept)) {
      expect(image.alt.trim()).not.toBe("");
    }
  });

  test("uses its own building-context visualization as the index exterior still", () => {
    expect(concept.building.exteriorStill).toBe(concept.visualizations.buildingContext);
  });

  test("has a complete featured residence and approximate disclosure facts", () => {
    const residence = concept.featuredResidence;
    expect(isFilled(residence)).toBe(true);
    expect(residence.materials.length).toBeGreaterThan(0);

    expect(concept.facts.approximate).toBe(true);
    for (const fact of ["interiorAreaM2", "outdoorAreaM2", "bedrooms", "storeys", "heightM"] as const) {
      expect(concept.facts[fact]).toBeGreaterThan(0);
    }
  });

  test("scene binding names a selection target, a label anchor and its detailed model", () => {
    expect(concept.scene.selectionTarget.trim()).not.toBe("");
    expect(concept.scene.labelAnchor.trim()).not.toBe("");
    expect(concept.scene.selectionTarget).not.toBe(concept.scene.labelAnchor);
    expect(concept.scene.detailedModel).toBe(`/models/building-${concept.slug}.glb`);
  });

  test("every visualization has an accepted, complete provenance entry for its slug and role", () => {
    for (const image of Object.values(concept.visualizations)) {
      const entries = provenanceManifest.filter((entry) => entry.id === image.provenanceId);
      expect(entries).toHaveLength(1);
      const [entry] = entries;

      expect(entry.status).toBe("accepted");
      for (const field of requiredProvenanceFields) {
        expect({ field, filled: isFilled(entry[field]) }).toEqual({ field, filled: true });
      }
      expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
      expect(entry.conceptSlug).toBe(concept.slug);
      expect(entry.role).toBe(image.role);
      expect(entry.file).toBe(image.src);
      expect(entry.placeholder).toBe(image.placeholder);
    }
  });
});

test("no image or diagram is shared across concepts", () => {
  const owners = new Map<string, Set<string>>();
  for (const concept of collection) {
    for (const image of imagesOf(concept)) {
      owners.set(image.src, (owners.get(image.src) ?? new Set()).add(concept.slug));
    }
  }

  const shared = [...owners].filter(([, slugs]) => slugs.size > 1).map(([src]) => src);
  expect(shared).toEqual([]);
});

test("the collection never references a rejected manifest entry or file", () => {
  const referenced = collection.flatMap((concept) => imagesOf(concept).map((image) => image.src));
  const rejected = provenanceManifest.filter((entry) => entry.status === "rejected");

  expect(rejected.length).toBeGreaterThan(0);
  for (const entry of rejected) {
    expect(entry.statusReason.trim()).not.toBe("");
    expect(referenced).not.toContain(entry.file);
  }
});

test("manifest ids are unique", () => {
  const ids = provenanceManifest.map((entry) => entry.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("placeholder images and manifest entries are clearly marked as placeholders", () => {
  for (const concept of collection) {
    for (const image of imagesOf(concept)) {
      if (!image.placeholder) continue;

      expect(image.src).toContain("-placeholder.");
      expect(publicFile(image.src)).toContain("PLACEHOLDER");
    }
  }

  for (const entry of provenanceManifest.filter((entry) => entry.placeholder)) {
    expect(entry.provider).toBe("placeholder");
    expect(entry.statusReason).toMatch(/placeholder/i);
  }
});

test("every referenced image exists in public/", () => {
  for (const concept of collection) {
    for (const image of imagesOf(concept)) {
      expect(() => publicFile(image.src)).not.toThrow();
    }
  }
});

test("published concept images and diagrams have replaced the development placeholders", () => {
  for (const concept of collection) {
    for (const image of imagesOf(concept)) {
      expect(image.placeholder).toBe(false);
    }
  }
});
