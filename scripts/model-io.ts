import { NodeIO } from "@gltf-transform/core";
import {
  EXTMeshGPUInstancing,
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

/** The extensions supported by the runtime asset contract. No network resources. */
export async function modelIO() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  return new NodeIO()
    .registerExtensions([EXTMeshoptCompression, EXTMeshGPUInstancing, KHRMeshQuantization])
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });
}
