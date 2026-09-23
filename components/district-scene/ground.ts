import {
  Color, Mesh, MeshStandardMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, Vector2, Vector4,
  type Material, type Object3D, type Texture, type WebGLProgramParametersWithUniforms,
} from "three";

/**
 * The textured ground. The landscape's ground, lanes, paths and bench tops
 * carry per-vertex weights for four tiling layers (`_LAYERS` in the GLB:
 * grass, earth, rock, gravel). The scene blends the layers' maps by those
 * weights over the vertex colours, which keep the district's palette, and
 * fades them out under the haze, where the vertex colours alone remain.
 */
export type GroundLayer = {
  name: "grass" | "earth" | "rock" | "gravel";
  /** The DESIGN.md token the colour map is tinted to, and so its mean colour. */
  token: `scene-terrain-${string}`;
  hex: string;
  /** Metres one repeat of the maps covers. */
  tile: number;
  /** Base colour, sRGB. */
  color: string;
  /** Normal X and Y (OpenGL convention) in red and green, roughness in blue. Linear. */
  surface: string;
};

export const groundLayers: readonly GroundLayer[] = [
  { name: "grass", token: "scene-terrain-grass", hex: "#A5AE95", tile: 7, color: "/textures/ground/grass-color.jpg", surface: "/textures/ground/grass-surface.jpg" },
  { name: "earth", token: "scene-terrain-dry", hex: "#B4B094", tile: 9, color: "/textures/ground/earth-color.jpg", surface: "/textures/ground/earth-surface.jpg" },
  { name: "rock", token: "scene-terrain-rock", hex: "#B8B1A3", tile: 8, color: "/textures/ground/rock-color.jpg", surface: "/textures/ground/rock-surface.jpg" },
  { name: "gravel", token: "scene-terrain-lane", hex: "#CFC7B6", tile: 3.5, color: "/textures/ground/gravel-color.jpg", surface: "/textures/ground/gravel-surface.jpg" },
];

/** Every ground map, in the opening transfer on every tier. */
export const groundTextures: readonly string[] = groundLayers.flatMap(({ color, surface }) => [color, surface]);

/** The glTF attribute holding the layer weights, and the name three.js gives it. */
export const layerAttribute = { gltf: "_LAYERS", three: "_layers" } as const;

/** Texture detail fades out between these distances from the camera, in metres, well inside the haze. */
export const detailFade = { start: 700, end: 1000 } as const;

/** The largest anisotropic filtering the ground asks for; it is seen at grazing angles. */
export const maxAnisotropy = 8;

const shared = {
  groundTone: { value: groundLayers.map(({ hex }) => new Color(hex)) },
  groundTile: { value: new Vector4(...groundLayers.map(({ tile }) => tile)) },
  groundFade: { value: new Vector2(detailFade.start, detailFade.end) },
};

const vertexHead = /* glsl */ `
attribute vec4 groundLayers;
varying vec4 vGroundLayers;
varying vec3 vGroundPosition;
`;

const vertexBody = /* glsl */ `
vGroundLayers = groundLayers;
vGroundPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;

const fragmentHead = /* glsl */ `
uniform sampler2D groundColor0;
uniform sampler2D groundColor1;
uniform sampler2D groundColor2;
uniform sampler2D groundColor3;
uniform sampler2D groundSurface0;
uniform sampler2D groundSurface1;
uniform sampler2D groundSurface2;
uniform sampler2D groundSurface3;
uniform vec3 groundTone[4];
uniform vec4 groundTile;
uniform vec2 groundFade;
varying vec4 vGroundLayers;
varying vec3 vGroundPosition;

// A layer's colour relative to its tone, and its luminance, which stands in
// for height where layers meet. Two repeats, the second larger and turned,
// so neither's tiling shows; their average loses contrast, which is restored.
vec4 groundDetail(sampler2D map, vec3 tone, float tile, vec2 xz, vec2 dx, vec2 dy) {
  const mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
  float near = 1.0 / tile;
  float far = 1.0 / (tile * 2.71);
  vec3 a = textureGrad(map, xz * near, dx * near, dy * near).rgb;
  vec3 b = textureGrad(map, turn * xz * far + vec2(0.37, 0.61), turn * dx * far, turn * dy * far).rgb;
  vec3 detail = 1.0 + ((a + b) * 0.5 / tone - 1.0) * 1.6;
  return vec4(detail, dot(detail, vec3(0.2126, 0.7152, 0.0722)));
}

vec3 groundSurfaceAt(sampler2D map, float tile, vec2 xz, vec2 dx, vec2 dy) {
  return textureGrad(map, xz / tile, dx / tile, dy / tile).rgb;
}
`;

// After the vertex colour: the layers' detail multiplies it, so the palette holds.
const colorBody = /* glsl */ `
vec3 groundNormal = vec3(0.0);
float groundRoughness = 0.0;
float groundAmount = 0.0;
{
  float near = 1.0 - smoothstep(groundFade.x, groundFade.y, distance(vGroundPosition, cameraPosition));
  vec4 weight = vGroundLayers * near;
  float total = weight.x + weight.y + weight.z + weight.w;
  if (total > 0.004) {
    // +u east, +v north. Gradients come from outside the branches below.
    vec2 xz = vec2(vGroundPosition.x, -vGroundPosition.z);
    vec2 dx = dFdx(xz);
    vec2 dy = dFdy(xz);
    vec4 d0 = vec4(1.0), d1 = vec4(1.0), d2 = vec4(1.0), d3 = vec4(1.0);
    if (weight.x > 0.004) d0 = groundDetail(groundColor0, groundTone[0], groundTile.x, xz, dx, dy);
    if (weight.y > 0.004) d1 = groundDetail(groundColor1, groundTone[1], groundTile.y, xz, dx, dy);
    if (weight.z > 0.004) d2 = groundDetail(groundColor2, groundTone[2], groundTile.z, xz, dx, dy);
    if (weight.w > 0.004) d3 = groundDetail(groundColor3, groundTone[3], groundTile.w, xz, dx, dy);
    // Where layers meet, the higher (brighter) one shows through the other.
    vec4 blend = weight * pow(max(vec4(d0.a, d1.a, d2.a, d3.a), 0.05), vec4(6.0));
    blend *= total / max(blend.x + blend.y + blend.z + blend.w, 1e-4);
    diffuseColor.rgb *= blend.x * d0.rgb + blend.y * d1.rgb + blend.z * d2.rgb + blend.w * d3.rgb + (1.0 - total);
    vec3 surface = vec3(0.0);
    if (weight.x > 0.004) surface += blend.x * groundSurfaceAt(groundSurface0, groundTile.x, xz, dx, dy);
    if (weight.y > 0.004) surface += blend.y * groundSurfaceAt(groundSurface1, groundTile.y, xz, dx, dy);
    if (weight.z > 0.004) surface += blend.z * groundSurfaceAt(groundSurface2, groundTile.z, xz, dx, dy);
    if (weight.w > 0.004) surface += blend.w * groundSurfaceAt(groundSurface3, groundTile.w, xz, dx, dy);
    groundNormal = vec3(surface.xy * 2.0 - total, 0.0) * 0.85;
    groundRoughness = surface.z / total;
    groundAmount = total;
  }
}
`;

const roughnessBody = /* glsl */ `
roughnessFactor = mix(roughnessFactor, max(groundRoughness, 0.72), groundAmount);
`;

// The maps' tangent frame is world +X (u) and −Z (v), laid on the surface.
const normalBody = /* glsl */ `
if (groundAmount > 0.0) {
  vec3 up = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 east = normalize(vec3(1.0, 0.0, 0.0) - up * up.x);
  vec3 north = normalize(vec3(0.0, 0.0, -1.0) + up * up.z);
  normal = normalize((viewMatrix * vec4(normalize(up + groundNormal.x * east + groundNormal.y * north), 0.0)).xyz);
}
`;

/** Where each part of the patch goes in three.js's standard material shader. */
export const shaderMarkers = {
  vertexHead: "#include <common>",
  vertexBody: "#include <fog_vertex>",
  fragmentHead: "#include <common>",
  color: "#include <color_fragment>",
  roughness: "#include <roughnessmap_fragment>",
  normal: "#include <normal_fragment_maps>",
} as const;

function after(source: string, marker: string, code: string) {
  if (!source.includes(marker)) throw new Error(`The ground shader expects "${marker}" in three.js's standard material.`);
  return source.replace(marker, `${marker}\n${code}`);
}

/** Adds the ground layers to a standard material's shader, drawing from `maps`. */
export function patchGroundShader(shader: Pick<WebGLProgramParametersWithUniforms, "vertexShader" | "fragmentShader" | "uniforms">, maps: GroundMaps) {
  Object.assign(shader.uniforms, shared);
  maps.color.forEach((map, i) => { shader.uniforms[`groundColor${i}`] = { value: map }; });
  maps.surface.forEach((map, i) => { shader.uniforms[`groundSurface${i}`] = { value: map }; });
  shader.vertexShader = after(after(shader.vertexShader, shaderMarkers.vertexHead, vertexHead), shaderMarkers.vertexBody, vertexBody);
  let fragment = after(shader.fragmentShader, shaderMarkers.fragmentHead, fragmentHead);
  fragment = after(fragment, shaderMarkers.color, colorBody);
  fragment = after(fragment, shaderMarkers.roughness, roughnessBody);
  shader.fragmentShader = after(fragment, shaderMarkers.normal, normalBody);
}

/** The layers' maps, in `groundLayers` order. */
export type GroundMaps = { color: Texture[]; surface: Texture[] };

/** Splits the loaded textures, in `groundTextures` order, and prepares them to tile. */
export function groundMaps(textures: Texture[], anisotropy: number): GroundMaps {
  const maps: GroundMaps = { color: [], surface: [] };
  textures.forEach((texture, i) => {
    const color = i % 2 === 0;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.colorSpace = color ? SRGBColorSpace : NoColorSpace;
    texture.anisotropy = Math.min(anisotropy, maxAnisotropy);
    texture.needsUpdate = true;
    (color ? maps.color : maps.surface).push(texture);
  });
  return maps;
}

const patched = new WeakSet<Material>();

/**
 * Draws every mesh that carries layer weights with the ground layers. Their
 * materials belong to the ground alone, so patching them touches nothing
 * else. Returns the materials patched.
 */
export function layerGround(model: Object3D, maps: GroundMaps): Material[] {
  const materials = new Set<Material>();
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const { geometry } = object;
    const weights = geometry.getAttribute(layerAttribute.three) ?? geometry.getAttribute("groundLayers");
    if (!weights) return;
    // GLSL reserves nothing for a leading underscore, but a plain name reads better.
    if (!geometry.getAttribute("groundLayers")) {
      geometry.setAttribute("groundLayers", weights);
      geometry.deleteAttribute(layerAttribute.three);
    }
    if (!(object.material instanceof MeshStandardMaterial)) throw new Error(`${object.name}: layered ground needs a standard material.`);
    materials.add(object.material);
  });
  for (const material of materials) {
    if (patched.has(material)) continue;
    patched.add(material);
    material.onBeforeCompile = (shader) => patchGroundShader(shader, maps);
    material.customProgramCacheKey = () => "habitta-ground-layers";
    material.needsUpdate = true;
  }
  return [...materials];
}
