// Throwaway concepts: names, dimensions, and residences are not collection decisions.
export const buildings = [
  { name: "Vale", type: "Terraced residences", residence: "The garden duplex", description: "Deep terraces step toward the landscape. A home arranged around an open-air garden, with living spaces that follow the afternoon light.", material: "Pale stone / planted terraces", position: [-18, 0, 3] as const, height: 13, floors: 5, color: "#d7d2c3" },
  { name: "Serra", type: "Vertical residences", residence: "The sky residence", description: "A slender frame above the district. A home with long views, sheltered balconies, and a quiet sequence of rooms around a central core.", material: "Concrete / bronze / glass", position: [0, 0, -14] as const, height: 24, floors: 10, color: "#dedbd2" },
  { name: "Pátio", type: "Courtyard residences", residence: "The courtyard home", description: "Low volumes gather around a shared green. A home where an intimate courtyard brings daylight into the heart of everyday life.", material: "Earth-toned stone / timber", position: [18, 0, 7] as const, height: 9, floors: 3, color: "#bbaa98" },
];

export const variants = [
  { key: "A", name: "Guided arrival", hypothesis: "An intentional arrival gives the district a sense of place before exploration." },
  { key: "B", name: "Open district", hypothesis: "Immediate control and visible building names make exploration self-explanatory." },
  { key: "C", name: "Collection index", hypothesis: "A persistent index makes choosing architecture easier while preserving the spatial context." },
] as const;
export type Variant = (typeof variants)[number]["key"];
