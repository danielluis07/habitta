// The single source of concept content. The building index, the building
// overview, the residence story and the district scene all read from here.
//
// Copy below is production copy for Crest, Contour and Grove, written to the
// accepted architectural brief and comparison board reviewed at commit
// 0148994. Revision 1 editorial images are described in docs/IMAGE_GENERATION.md.

import {
  getProvenanceEntry,
  type AcceptedProvenanceId,
  type ConceptSlug,
  type VisualizationRole,
} from "@/lib/provenance";

export type { ConceptSlug, VisualizationRole } from "@/lib/provenance";
export { visualizationRoles } from "@/lib/provenance";

export type ConceptImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** A development stand-in. It is marked as a placeholder wherever it renders and never ships as a concept visualization. */
  placeholder: boolean;
};

export type ConceptVisualization = ConceptImage & {
  role: VisualizationRole;
  caption?: string;
  /** The accepted provenance manifest entry this image was published from. */
  provenanceId: AcceptedProvenanceId;
};

export type ResidenceMaterial = {
  name: string;
  /** Where the material is seen in the home. */
  location: string;
};

/** Numerical facts for the details disclosure. All are approximate design targets. */
export type DisclosureFacts = {
  approximate: true;
  interiorAreaM2: number;
  outdoorAreaM2: number;
  /** What the outdoor area is, e.g. "loggia". */
  outdoorSpace: string;
  bedrooms: number;
  storeys: number;
  heightM: number;
};

/** How the building is found in the runtime GLBs. Node names are stable across exports. */
export type SceneBinding = {
  /** Node that receives pointer selection in both the low-detail and detailed models. */
  selectionTarget: string;
  /** Node whose world position places the building's DOM name label. */
  labelAnchor: string;
  /** The detailed model, lazy-loaded when the building is selected. */
  detailedModel: string;
};

export type Concept = {
  slug: ConceptSlug;
  building: {
    name: string;
    role: string;
    /** Form, materials and position in the district. */
    description: string;
    /** The index still. It is the concept's own building-context visualization. */
    exteriorStill: ConceptVisualization;
  };
  featuredResidence: {
    name: string;
    /** Level and position within the building. */
    position: string;
    designIdea: string;
    /** How the home is arranged, in plain language. */
    arrangement: string;
    materials: readonly ResidenceMaterial[];
    roomStories: {
      living: string;
      outdoor: string;
      quietRoom: string;
    };
    /** Where the home sits in its building. */
    buildingRelationship: string;
  };
  facts: DisclosureFacts;
  /** The schematic arrangement diagram. Schematic, not to scale. */
  diagram: ConceptImage;
  visualizations: Readonly<Record<VisualizationRole, ConceptVisualization>>;
  scene: SceneBinding;
};

// Resolves an image through its manifest entry, so the collection can only
// publish accepted images and the file reference never drifts from its record.
function visualization(
  provenanceId: AcceptedProvenanceId,
  alt: string,
  caption?: string,
): ConceptVisualization {
  const entry = getProvenanceEntry(provenanceId);
  if (entry?.status !== "accepted") {
    throw new Error(`Concept visualization "${provenanceId}" has no accepted provenance entry.`);
  }

  return {
    role: entry.role,
    src: entry.file,
    width: entry.width,
    height: entry.height,
    alt,
    caption,
    placeholder: entry.placeholder,
    provenanceId,
  };
}

function sceneBinding(slug: ConceptSlug): SceneBinding {
  return {
    selectionTarget: `${slug}_selection_target`,
    labelAnchor: `${slug}_label_anchor`,
    detailedModel: `/models/building-${slug}.glb`,
  };
}

const crestContext = visualization(
  "crest-building-context-r1",
  "Crest from the southwest: a slender twelve-storey tower of pale vertical piers and recessed loggias on a stone plinth along the northwest ridge.",
  "The Horizon residence sits behind the level-10 loggia in the southwest bay.",
);

const contourContext = visualization(
  "contour-building-context-r1",
  "Contour from downhill to the southwest: four long concrete terraces stepping up the eastern hillside above a stone retaining base.",
  "The Terrace residence is the western home on the second step.",
);

const groveContext = visualization(
  "grove-building-context-r1",
  "Grove from above the southwest: a two-storey ring of lime render and buff brick around an open planted court on the lower bench.",
  "The Garden residence occupies the northeast ground-floor corner of the court.",
);

export const collection: readonly Concept[] = [
  {
    slug: "crest",
    building: {
      name: "Crest",
      role: "Ridge tower",
      description:
        "A slender twelve-storey tower on the northwest ridge, about 42 m tall. Pale vertical piers frame recessed south loggias, finished in limestone, oak, plaster and bronze.",
      exteriorStill: crestContext,
    },
    featuredResidence: {
      name: "Horizon",
      position: "Level 10, south half",
      designIdea:
        "Height felt through an ordinary, sheltered room. The long horizon is held at the close depth of a recessed loggia.",
      arrangement:
        "You enter from the building core into a short hall. Kitchen and dining sit to the northwest and open into the living room in the southwest corner, which steps out to the loggia. The main bedroom takes the southeast corner and the second bedroom faces east. Bathrooms, laundry and storage line the internal north wall, and each bedroom is reached from the hall.",
      materials: [
        { name: "Pale oak", location: "Floors and cabinetry" },
        { name: "Chalk mineral plaster", location: "Walls and ceilings" },
        { name: "Warm grey limestone", location: "Kitchen worktop and loggia paving" },
        { name: "Dark bronze", location: "Window frames and the loggia rail" },
      ],
      roomStories: {
        living:
          "A three-panel bronze opening fills the south wall. Beyond the loggia, the valley and its clouds sit level with the room.",
        outdoor:
          "The loggia is cut into the tower rather than hung from it. A solid parapet and the floor above make an outdoor room that feels safe at height.",
        quietRoom:
          "The main bedroom looks south through one broad pane. Its facade is flush, so the view is framed without a balcony between bed and horizon.",
      },
      buildingRelationship:
        "The home is on level 10, the third floor down from the roof, in the south half of the tower. Its loggia is one of the recessed bays that stack up the southwest corner.",
    },
    facts: {
      approximate: true,
      interiorAreaM2: 140,
      outdoorAreaM2: 22,
      outdoorSpace: "loggia",
      bedrooms: 2,
      storeys: 12,
      heightM: 42,
    },
    diagram: {
      src: "/concepts/crest/crest-diagram-r1.svg",
      width: 1200,
      height: 800,
      alt: "Schematic arrangement of the Horizon residence, north up. Kitchen and dining are northwest, living is southwest beside the south loggia, services and hall are central, bedroom 2 is northeast, and the main bedroom is southeast.",
      placeholder: false,
    },
    visualizations: {
      living: visualization(
        "crest-living-r1",
        "The Horizon living room looking southwest across oak floors and the kitchen edge, through a three-panel bronze opening to the recessed loggia and the valley beyond.",
      ),
      outdoor: visualization(
        "crest-outdoor-r1",
        "The Horizon loggia seen from its east end: limestone paving, a solid pale parapet with a bronze rail, the slab above, and a glimpse back into the living room.",
      ),
      quietRoom: visualization(
        "crest-quiet-room-r1",
        "The Horizon main bedroom from its doorway, looking toward the southeast corner and a broad south window over the valley.",
      ),
      materialStudy: visualization(
        "crest-material-study-r1",
        "Close detail of the Horizon living-to-loggia sill, where pale oak meets limestone paving at a bronze track beside the concrete reveal.",
      ),
      buildingContext: crestContext,
    },
    scene: sceneBinding("crest"),
  },
  {
    slug: "contour",
    building: {
      name: "Contour",
      role: "Stepped hillside",
      description:
        "Four residential levels step north into the eastern hillside, each opening onto a deep terrace on the roof below. Textured concrete and stone outside, terrazzo and timber within.",
      exteriorStill: contourContext,
    },
    featuredResidence: {
      name: "Terrace",
      position: "Level 2, western end",
      designIdea:
        "A home that borrows its outdoor room from the slope. Daily life stretches sideways along a deep terrace that follows the hill.",
      arrangement:
        "A north hall receives you from the shared stair. Kitchen, dining and living run along the south front, with the living room in the southwest corner opening onto the terrace. The main bedroom sits southeast with its own door to the same terrace. Two smaller bedrooms face west, and bathrooms, laundry and storage gather on the north side.",
      materials: [
        { name: "Sand-toned terrazzo", location: "Living spaces and hall" },
        { name: "Light oak", location: "Bedroom floors and kitchen fronts" },
        { name: "Textured stone", location: "Terrace paving" },
        { name: "Board-textured concrete", location: "Floor edge above the terrace" },
        { name: "Oiled timber", location: "Terrace privacy screen" },
      ],
      roomStories: {
        living:
          "A four-panel sliding wall opens the living room onto the terrace, so the dining table can move outside for most of the year.",
        outdoor:
          "The terrace sits on the roof of the level below. A dining zone by the living room, a planted edge toward the valley and a screened corner by the bedroom make it three rooms in one.",
        quietRoom:
          "The main bedroom has its own south opening onto a quiet, screened part of the terrace, away from the dining zone.",
      },
      buildingRelationship:
        "The home is the western end of the second step. Being at the end gives it west light a middle home can't have, and its terrace is the roof of the step below.",
    },
    facts: {
      approximate: true,
      interiorAreaM2: 155,
      outdoorAreaM2: 48,
      outdoorSpace: "south terrace",
      bedrooms: 3,
      storeys: 4,
      heightM: 14,
    },
    diagram: {
      src: "/concepts/contour/contour-diagram-r1.svg",
      width: 1200,
      height: 800,
      alt: "Schematic arrangement of the Terrace residence, north up. Two smaller bedrooms occupy the west side, services are north of the central hall, kitchen and dining are northeast, living is southwest, and the main bedroom is southeast. A deep terrace runs across the south side.",
      placeholder: false,
    },
    visualizations: {
      living: visualization(
        "contour-living-r1",
        "The Terrace living and dining space looking southeast along terrazzo floors and a four-panel glass wall, onto the deep terrace and the valley.",
      ),
      outdoor: visualization(
        "contour-outdoor-r1",
        "The Terrace residence terrace from its southwest corner, looking back to the living and bedroom openings past a planted edge, a timber screen and the stepped floor above.",
      ),
      quietRoom: visualization(
        "contour-quiet-room-r1",
        "The Terrace main bedroom from its doorway, oak floor leading to a south opening onto a screened corner of the terrace.",
      ),
      materialStudy: visualization(
        "contour-material-study-r1",
        "Close detail of the Terrace living threshold: terrazzo inside meets textured stone paving at a bronze sill, beside the timber screen, under board-textured concrete.",
      ),
      buildingContext: contourContext,
    },
    scene: sceneBinding("contour"),
  },
  {
    slug: "grove",
    building: {
      name: "Grove",
      role: "Courtyard building",
      description:
        "A low two-storey ring around a planted court on the lower southwestern bench. Lime render over a buff brick plinth, with clay and oak inside.",
      exteriorStill: groveContext,
    },
    featuredResidence: {
      name: "Garden",
      position: "Ground floor, northeast corner",
      designIdea:
        "A quiet home between a shared garden and a private green edge. Living turns inward to the court; bedrooms turn outward to planting.",
      arrangement:
        "You enter from the court-side path into a small vestibule and central hall. The living and dining room lies to the west and opens onto a private patio, with the kitchen just north of dining. Both bedrooms face the outer east garden and are reached from the hall. Bathrooms, laundry and storage sit on the north service edge.",
      materials: [
        { name: "Light clay tile", location: "Living, kitchen and patio" },
        { name: "Pale oak", location: "Bedroom floors and joinery" },
        { name: "Lime render", location: "Deep window reveals and outer walls" },
        { name: "Buff brick", location: "Plinth and patio wall" },
        { name: "Timber", location: "Window frames, shutters and patio gate" },
      ],
      roomStories: {
        living:
          "A two-panel timber opening sits deep in the rendered wall. Through it, the private patio and then the shared court garden.",
        outdoor:
          "The patio belongs only to this home. A low brick wall, a timber gate and planting keep it apart from the shared path, and it stays open to the sky.",
        quietRoom:
          "The main bedroom looks east through one deep window with a timber shutter, onto the quiet planting at the edge of the plot.",
      },
      buildingRelationship:
        "The home is in the northeast corner of the ground floor, on the court's edge. Living faces the shared court; the bedrooms face away from it to the outer garden.",
    },
    facts: {
      approximate: true,
      interiorAreaM2: 110,
      outdoorAreaM2: 20,
      outdoorSpace: "private court-facing patio",
      bedrooms: 2,
      storeys: 2,
      heightM: 7,
    },
    diagram: {
      src: "/concepts/grove/grove-diagram-r1.svg",
      width: 1200,
      height: 800,
      alt: "Schematic arrangement of the Garden residence, north up. The private patio is west of living and dining, with kitchen northwest, services north, and a central hall. Bedroom 2 is northeast and the main bedroom southeast.",
      placeholder: false,
    },
    visualizations: {
      living: visualization(
        "grove-living-r1",
        "The Garden living room looking west across a clay tile floor, through a two-panel timber opening to the private patio and the shared court garden beyond.",
      ),
      outdoor: visualization(
        "grove-outdoor-r1",
        "The Garden residence private patio from its west edge, looking back into the living room past a low brick wall and a timber gate to the shared path.",
      ),
      quietRoom: visualization(
        "grove-quiet-room-r1",
        "The Garden main bedroom from its doorway, looking east to a deep window with a timber shutter and the planted outer garden.",
      ),
      materialStudy: visualization(
        "grove-material-study-r1",
        "Close detail of the Garden living-to-patio threshold: clay tile, a timber frame set in a lime render reveal, and the buff brick patio wall beside it.",
      ),
      buildingContext: groveContext,
    },
    scene: sceneBinding("grove"),
  },
];

export function getConcept(slug: string): Concept | undefined {
  return collection.find((concept) => concept.slug === slug);
}
