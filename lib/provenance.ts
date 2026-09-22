// The provenance manifest: one entry per produced concept visualization,
// accepted or rejected. The concept collection references images only through
// accepted entries, so every published image can be audited back to the
// canonical design it was made from. Rejected entries stay listed with their
// reason so the same output is never reused.
//
// Revision 0 entries preserve the development-placeholder history. Revision 1
// contains editorial images generated from the accepted text briefs. Their
// geometry still needs checking against a final canonical DCC scene.

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

const placeholderEntries = [
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

const generatedFields = {
  width: 1536,
  height: 1024,
  dccRevision: "not yet available; placeholder scene r0",
  glbRevisions: { district: "placeholder-district-low-r0", building: "placeholder-building-r0" },
  provider: "OpenAI built-in image_gen",
  model: "model version not exposed by built-in tool",
  promptTemplateRevision: "docs/IMAGE_GENERATION.md#r1",
  parameters: { aspectRatio: "3:2", source: "accepted architectural text brief" },
  reviewer: "Codex visual review against text brief",
  timestamp: "2026-09-22T22:07:53Z",
  postProcessing: ["Sharp WebP, quality 86"],
  placeholder: false,
  status: "accepted",
  statusReason:
    "Accepted for this fictional editorial portfolio after visual review. Exact geometry and room relationships need a final canonical DCC reference pack for production validation.",
} as const;

const generatedSpecs = [
  { id: "crest-living-r1", conceptSlug: "crest", role: "living" },
  { id: "crest-outdoor-r1", conceptSlug: "crest", role: "outdoor" },
  { id: "crest-quiet-room-r1", conceptSlug: "crest", role: "quietRoom" },
  { id: "crest-material-study-r1", conceptSlug: "crest", role: "materialStudy" },
  { id: "crest-building-context-r1", conceptSlug: "crest", role: "buildingContext" },
  { id: "contour-living-r1", conceptSlug: "contour", role: "living" },
  { id: "contour-outdoor-r1", conceptSlug: "contour", role: "outdoor" },
  { id: "contour-quiet-room-r1", conceptSlug: "contour", role: "quietRoom" },
  { id: "contour-material-study-r1", conceptSlug: "contour", role: "materialStudy" },
  { id: "contour-building-context-r1", conceptSlug: "contour", role: "buildingContext" },
  { id: "grove-living-r1", conceptSlug: "grove", role: "living" },
  { id: "grove-outdoor-r1", conceptSlug: "grove", role: "outdoor" },
  { id: "grove-quiet-room-r1", conceptSlug: "grove", role: "quietRoom" },
  { id: "grove-material-study-r1", conceptSlug: "grove", role: "materialStudy" },
  { id: "grove-building-context-r1", conceptSlug: "grove", role: "buildingContext" },
] as const;

const referenceHashBySlug = {
  crest: "sha256:99591d6f51c819e3757b39f4db9001648865e48ccdd3bba2d6d8bb70f61b7654",
  contour: "sha256:108cfca6804f19aad27a3dd9c7d0b7a40193e6b50f145a6fa8b3dac0f672e6f7",
  grove: "sha256:43e25b70a145fbd84e80e8a1396e8fdd7f90903220e4d64389b400bb7aeb8bc6",
} as const;

const entries = [
  ...placeholderEntries,
  ...generatedSpecs.map((spec) => ({
    ...generatedFields,
    ...spec,
    file: `/concepts/${spec.conceptSlug}/${spec.id}.webp`,
    referenceHashes:
      spec.role === "buildingContext"
        ? ["No image reference; generated from text brief"]
        : [referenceHashBySlug[spec.conceptSlug]],
  })),
  {
    ...generatedFields,
    id: "crest-building-context-r1-rejected",
    conceptSlug: "crest",
    role: "buildingContext",
    file: "/concepts/crest/crest-building-context-r1-rejected.png",
    referenceHashes: ["No image reference; generated from text brief"],
    postProcessing: ["none"],
    status: "rejected",
    statusReason: "Discarded first exterior variant: the tower's visible floor rhythm was too short for the twelve-storey brief.",
  },
  {
    ...generatedFields,
    id: "crest-living-r1-rejected",
    conceptSlug: "crest",
    role: "living",
    file: "/concepts/crest/crest-living-r1-rejected.png",
    referenceHashes: [referenceHashBySlug.crest],
    postProcessing: ["none"],
    status: "rejected",
    statusReason: "Discarded first living variant: it showed a glass balcony edge instead of the required solid loggia parapet.",
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
