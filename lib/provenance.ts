// The provenance manifest: one entry per produced concept visualization,
// accepted or rejected. The concept collection references images only through
// accepted entries, so every published image can be audited back to the
// canonical design it was made from. Rejected entries stay listed with their
// reason so the same output is never reused.
//
// Every entry below is a development placeholder. Final entries replace them
// through the production workflow in docs/research/concept-visualization-production-workflow.md.

export type ConceptSlug = "crest" | "contour" | "grove";

export const visualizationRoles = [
  "living",
  "outdoor",
  "quietRoom",
  "materialStudy",
  "buildingContext",
] as const;

export type VisualizationRole = (typeof visualizationRoles)[number];

export type ProvenanceEntry = {
  id: string;
  conceptSlug: ConceptSlug;
  role: VisualizationRole;
  /** Public path of the delivered image, named `{concept}-{role}-r{revision}`. */
  file: string;
  width: number;
  height: number;
  /** Revision of the canonical DCC source scene the references were rendered from. */
  dccRevision: string;
  glbRevisions: { district: string; building: string };
  /** Hashes of the reference renders passed to the generator. */
  referenceHashes: readonly string[];
  provider: string;
  model: string;
  promptTemplateRevision: string;
  parameters: Readonly<Record<string, string | number>>;
  reviewer: string;
  /** ISO 8601 review timestamp. */
  timestamp: string;
  postProcessing: readonly string[];
  /** A development stand-in that must never ship as a concept visualization. */
  placeholder: boolean;
  status: "accepted" | "rejected";
  statusReason: string;
};

const placeholderFields = {
  dccRevision: "placeholder-dcc-r0",
  glbRevisions: { district: "placeholder-district-low-r0", building: "placeholder-building-r0" },
  referenceHashes: ["placeholder-no-reference-renders"],
  provider: "placeholder",
  model: "hand-drawn-svg",
  promptTemplateRevision: "placeholder-no-prompt",
  parameters: { source: "development placeholder" },
  reviewer: "placeholder",
  timestamp: "2026-09-22T00:00:00Z",
  postProcessing: ["none"],
  placeholder: true,
  width: 1200,
  height: 800,
} as const;

const acceptedPlaceholder = {
  ...placeholderFields,
  status: "accepted",
  statusReason:
    "Placeholder accepted for development only. Replace with a reviewed concept visualization before release.",
} as const;

const entries = [
  // Crest
  {
    ...acceptedPlaceholder,
    id: "crest-living-r0",
    conceptSlug: "crest",
    role: "living",
    file: "/concepts/crest/crest-living-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "crest-outdoor-r0",
    conceptSlug: "crest",
    role: "outdoor",
    file: "/concepts/crest/crest-outdoor-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "crest-quiet-room-r0",
    conceptSlug: "crest",
    role: "quietRoom",
    file: "/concepts/crest/crest-quiet-room-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "crest-material-study-r0",
    conceptSlug: "crest",
    role: "materialStudy",
    file: "/concepts/crest/crest-material-study-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "crest-building-context-r0",
    conceptSlug: "crest",
    role: "buildingContext",
    file: "/concepts/crest/crest-building-context-r0-placeholder.svg",
  },
  // Contour
  {
    ...acceptedPlaceholder,
    id: "contour-living-r0",
    conceptSlug: "contour",
    role: "living",
    file: "/concepts/contour/contour-living-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "contour-outdoor-r0",
    conceptSlug: "contour",
    role: "outdoor",
    file: "/concepts/contour/contour-outdoor-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "contour-quiet-room-r0",
    conceptSlug: "contour",
    role: "quietRoom",
    file: "/concepts/contour/contour-quiet-room-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "contour-material-study-r0",
    conceptSlug: "contour",
    role: "materialStudy",
    file: "/concepts/contour/contour-material-study-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "contour-building-context-r0",
    conceptSlug: "contour",
    role: "buildingContext",
    file: "/concepts/contour/contour-building-context-r0-placeholder.svg",
  },
  // Grove
  {
    ...acceptedPlaceholder,
    id: "grove-living-r0",
    conceptSlug: "grove",
    role: "living",
    file: "/concepts/grove/grove-living-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "grove-outdoor-r0",
    conceptSlug: "grove",
    role: "outdoor",
    file: "/concepts/grove/grove-outdoor-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "grove-quiet-room-r0",
    conceptSlug: "grove",
    role: "quietRoom",
    file: "/concepts/grove/grove-quiet-room-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "grove-material-study-r0",
    conceptSlug: "grove",
    role: "materialStudy",
    file: "/concepts/grove/grove-material-study-r0-placeholder.svg",
  },
  {
    ...acceptedPlaceholder,
    id: "grove-building-context-r0",
    conceptSlug: "grove",
    role: "buildingContext",
    file: "/concepts/grove/grove-building-context-r0-placeholder.svg",
  },
  // Rejected outputs stay listed so they are never reused. This placeholder
  // shows the shape of a rejection; its file is intentionally not published.
  {
    ...placeholderFields,
    id: "crest-outdoor-r0-rejected-example",
    conceptSlug: "crest",
    role: "outdoor",
    file: "/concepts/crest/crest-outdoor-r0-rejected-example.svg",
    status: "rejected",
    statusReason:
      "Placeholder rejection example: shows a projecting glass balcony instead of the recessed loggia with a solid parapet.",
  },
] as const satisfies readonly ProvenanceEntry[];

/** Ids of accepted entries: the only ones the concept collection may reference. */
export type AcceptedProvenanceId = Extract<
  (typeof entries)[number],
  { status: "accepted" }
>["id"];

export const provenanceManifest: readonly ProvenanceEntry[] = entries;

export function getProvenanceEntry(id: string): ProvenanceEntry | undefined {
  return provenanceManifest.find((entry) => entry.id === id);
}
