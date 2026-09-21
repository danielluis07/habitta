// Throwaway content for comparing information hierarchy. No collection facts are final.
export const storyVariants = [
  { key: "A", name: "Editorial story", hypothesis: "A short, ordered story connects the home to its building before inviting deeper inspection." },
  { key: "B", name: "Image gallery", hypothesis: "Large images with optional detail let visitors set the pace and depth." },
  { key: "C", name: "Spatial notebook", hypothesis: "A room selector and schematic plan make the arrangement of the home the primary story." },
] as const;
export type StoryVariant = (typeof storyVariants)[number]["key"];
export type SceneKind = "living" | "outdoor" | "bedroom" | "material" | "building";
export const residenceDrafts = [
  {
    slug: "vale", hook: "A garden, one floor above the ground.",
    position: "At the planted edge of Vale, across two stepped levels.",
    idea: "The garden sits beside the everyday rooms. Sliding screens let the living space open to the terrace, while the bedrooms occupy a quieter level above.",
    arrangement: "Living and dining below; two bedrooms above; a planted terrace extending the lower floor.",
    facts: [["Arrangement", "Duplex"], ["Interior", "148 m²"], ["Outdoor space", "36 m²"], ["Bedrooms", "2"]],
    materials: ["Pale limestone", "Oak", "Brushed bronze"],
    rooms: [
      { name: "Living & dining", kind: "living", title: "The garden is part of the room.", text: "A broad opening connects the shared living space to the planted terrace. The kitchen sits behind the oak screen, keeping the garden in view.", brief: "Wide interior looking across the living room toward the terrace; show the deep opening and pale stone threshold." },
      { name: "Garden terrace", kind: "outdoor", title: "A sheltered edge to the landscape.", text: "Planting softens the parapet. A deep overhang shades the threshold and makes the terrace feel like another room.", brief: "Exterior terrace at eye level, facing back toward the home; repeat the same opening, planting, and stone." },
      { name: "Quiet rooms", kind: "bedroom", title: "A quieter level above.", text: "The two bedrooms are set above the shared spaces. Timber screens filter daylight and frame a smaller, more private view.", brief: "One bedroom, looking toward a screened opening; oak and pale stone consistent with the living view." },
    ],
  },
  {
    slug: "serra", hook: "A long view. A sheltered place to pause.",
    position: "On an upper level of Serra, within its slender structural frame.",
    idea: "The rooms gather around a compact central core. A recessed balcony extends the living room toward the horizon without exposing the whole home to it.",
    arrangement: "Living and dining facing the horizon; two bedrooms behind the core; one recessed balcony.",
    facts: [["Arrangement", "Single level"], ["Interior", "126 m²"], ["Outdoor space", "22 m²"], ["Bedrooms", "2"]],
    materials: ["Exposed concrete", "Bronze", "Oak"],
    rooms: [
      { name: "Living & dining", kind: "living", title: "The horizon, framed.", text: "A concrete frame encloses the living room and its recessed balcony. The kitchen shares the view from behind the central core.", brief: "Wide living view framed by concrete, bronze glazing, and the recessed balcony." },
      { name: "Recessed balcony", kind: "outdoor", title: "Outside, within the frame.", text: "The balcony is carved into the building. Deep side walls provide shelter while a long opening connects the home to the district.", brief: "Look back from the balcony toward the same living room; retain the frame and glazing proportions." },
      { name: "Quiet rooms", kind: "bedroom", title: "A smaller frame for the morning.", text: "Bedrooms sit away from the shared living space. Deep reveals and timber surfaces give these rooms a more enclosed character.", brief: "Bedroom with a deep window reveal; carry the same concrete and timber into a quieter composition." },
    ],
  },
  {
    slug: "patio", hook: "A home gathered around open sky.",
    position: "At ground level in Pátio, between the shared green and a private court.",
    idea: "A small courtyard sits between the everyday rooms and the quieter rooms. Openings face inward, making the court a source of light and a private outdoor space.",
    arrangement: "Living and dining on one side of the courtyard; two bedrooms opposite; a covered passage between them.",
    facts: [["Arrangement", "Single level"], ["Interior", "112 m²"], ["Outdoor space", "28 m²"], ["Bedrooms", "2"]],
    materials: ["Earth-toned stone", "Oak", "Lime plaster"],
    rooms: [
      { name: "Living & dining", kind: "living", title: "The court at the heart of the home.", text: "The living room opens inward to a planted court. A covered edge makes a sheltered connection between dining and the outdoors.", brief: "Living room facing the private court; show the low roof, earth-toned stone, and opposing rooms." },
      { name: "Private courtyard", kind: "outdoor", title: "One patch of open sky.", text: "A planted court holds the rooms together. Stone walls and timber screens filter views from the shared landscape outside.", brief: "Courtyard looking back into the living room; retain the low proportions and enclosing walls." },
      { name: "Quiet rooms", kind: "bedroom", title: "Across the court.", text: "Two bedrooms occupy the opposite side of the courtyard, reached along a covered passage. Each has a filtered view toward the planting.", brief: "Bedroom with a view of the same courtyard and planting; no high-rise skyline." },
    ],
  },
] as const;
export type ResidenceDraft = (typeof residenceDrafts)[number];
