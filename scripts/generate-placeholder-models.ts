import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Document } from "@gltf-transform/core";
import { EXTMeshoptCompression } from "@gltf-transform/extensions";
import { collection } from "@/lib/collection";
import { modelIO } from "@/scripts/model-io";
import { building, placeholder } from "@/scripts/placeholder-models/buildings";
import { materials } from "@/scripts/placeholder-models/gltf";
import { district } from "@/scripts/placeholder-models/landscape";

// The reproducible source of the development placeholders. The district
// carries the landscape and every building at low detail; each detailed
// export carries one building at high detail, drawn from the same design.
export async function generatePlaceholderModels(publicDirectory = resolve(import.meta.dir, "../public")) {
  const io = await modelIO();
  await mkdir(resolve(publicDirectory, "models"), { recursive: true });
  for (const selected of [null, ...collection]) {
    const document = new Document();
    document.getRoot().getAsset().generator = "Habitta PLACEHOLDER massing generator";
    document.getRoot().setExtras({ ...placeholder, units: "metres", north: "-Z", up: "+Y", east: "+X" });
    document.createBuffer();
    const material = materials(document);
    const scene = document.createScene("Habitta PLACEHOLDER district").setExtras(placeholder);
    document.getRoot().setDefaultScene(scene);
    if (!selected) scene.addChild(district(document, material));
    for (const concept of selected ? [selected] : collection) scene.addChild(building(document, material, concept, selected ? "high" : "low"));
    document.createExtension(EXTMeshoptCompression).setRequired(true);
    const url = selected ? selected.scene.detailedModel : "/models/district-low.glb";
    await io.write(resolve(publicDirectory, url.slice(1)), document);
  }
}

if (import.meta.main) {
  await generatePlaceholderModels();
  console.log("Generated four Meshopt-compressed PLACEHOLDER GLBs in public/models/.");
}
