// The single source of concept content. The building index, and later the
// building overview, residence story and district scene, all read from here.

export type ConceptSlug = "crest" | "contour" | "grove";

export type ConceptImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** A development stand-in. It is marked as a placeholder wherever it renders and never ships as a concept visualization. */
  placeholder: boolean;
};

export type Concept = {
  slug: ConceptSlug;
  building: {
    name: string;
    role: string;
    /** Form, materials and position in the district. */
    description: string;
    exteriorStill: ConceptImage;
  };
  featuredResidence: {
    name: string;
  };
};

export const collection: readonly Concept[] = [
  {
    slug: "crest",
    building: {
      name: "Crest",
      role: "Ridge tower",
      description:
        "A slender twelve-storey tower on the northwest ridge, about 42 m tall. Pale vertical piers frame recessed south loggias, finished in limestone, oak, plaster and bronze.",
      exteriorStill: {
        src: "/concepts/crest/exterior-placeholder.svg",
        width: 1200,
        height: 800,
        alt: "Crest from the southwest: a slender twelve-storey tower of pale vertical piers and recessed loggias on a stone plinth along the northwest ridge.",
        placeholder: true,
      },
    },
    featuredResidence: { name: "Horizon" },
  },
  {
    slug: "contour",
    building: {
      name: "Contour",
      role: "Stepped hillside",
      description:
        "Four residential levels step north into the eastern hillside, each opening onto a deep terrace on the roof below. Textured concrete and stone outside, terrazzo and timber within.",
      exteriorStill: {
        src: "/concepts/contour/exterior-placeholder.svg",
        width: 1200,
        height: 800,
        alt: "Contour from downhill to the southwest: four long concrete terraces stepping up the eastern hillside above a stone retaining base.",
        placeholder: true,
      },
    },
    featuredResidence: { name: "Terrace" },
  },
  {
    slug: "grove",
    building: {
      name: "Grove",
      role: "Courtyard building",
      description:
        "A low two-storey ring around a planted court on the lower southwestern bench. Lime render over a buff brick plinth, with clay and oak inside.",
      exteriorStill: {
        src: "/concepts/grove/exterior-placeholder.svg",
        width: 1200,
        height: 800,
        alt: "Grove from above the southwest: a two-storey ring of lime render and buff brick around an open planted court on the lower bench.",
        placeholder: true,
      },
    },
    featuredResidence: { name: "Garden" },
  },
];

export function getConcept(slug: string): Concept | undefined {
  return collection.find((concept) => concept.slug === slug);
}
