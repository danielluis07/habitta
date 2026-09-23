import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "http://localhost:3000/" });

// GLTFLoader reads a GLB's embedded images through blob: URLs and
// createImageBitmap, neither of which happy-dom supports. Tests need a
// model's textures to exist, not their pixels, so each loads as a 1 × 1
// stand-in.
const pageFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  String(input).startsWith("blob:") ? Promise.resolve(new Response(new Blob())) : pageFetch(input, init)) as typeof fetch;
globalThis.createImageBitmap = (async () => ({ width: 1, height: 1, close() {} })) as unknown as typeof createImageBitmap;
