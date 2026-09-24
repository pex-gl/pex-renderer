/**
 * Light types in the order they are packed into the shared buffer. The ranges
 * struct and the renderer's concatenation are both built from this list, so the
 * two cannot disagree about what a range refers to.
 */
export const LIGHT_TYPES = [
  "ambient",
  "directional",
  "point",
  "spot",
  "area",
] as const;

export type LightType = (typeof LIGHT_TYPES)[number];

/**
 * One struct for every light type, and one buffer for every light.
 *
 * Per-type arrays would be the natural shape, but a binding only exists when
 * the scene has a light to put in it — so a scene gaining its first spot light
 * would regenerate the WGSL of every lit material and recompile it, mid-frame
 * and synchronously. Five arrays is also more dynamic storage buffers than the
 * default `maxDynamicStorageBuffersPerPipelineLayout` of 4 allows once the
 * reflection probe's coefficients are counted, so declaring them all
 * unconditionally is not an option either.
 *
 * With one buffer the shader is independent of what the scene contains: lights
 * are concatenated in `LIGHT_TYPES` order and each type reads the range it was
 * given. Adding, removing or retyping a light is a buffer write.
 *
 * The cost is the union: an ambient light carries a shadow projection it will
 * never use. Member order is chosen so it packs to exactly 256 bytes with no
 * padding, which at any plausible light count is not worth a second thought.
 */
export const LIGHT_STRUCTS = /* wgsl */ `struct SceneLight {
  position: vec3f,
  invSqrFalloff: f32,
  direction: vec3f,
  // Bulb radius, for the penumbra of a point light's shadow.
  radius: f32,
  // rgb authored in sRGB, w the luminance the light was metered at.
  color: vec4f,
  // Area light orientation and half-extents.
  rotation: vec4f,
  size: vec2f,
  innerConeAngle: f32,
  outerConeAngle: f32,
  disk: u32,
  doubleSided: u32,
  castShadows: u32,
  // Which shadow map binding, and which layer of it.
  shadowBucket: u32,
  shadowLayer: u32,
  depthBiasNormalized: f32,
  near: f32,
  far: f32,
  radiusUV: vec2f,
  shadowMapSize: vec2f,
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
}

struct LightRange {
  offset: u32,
  count: u32,
}

// @align(16) is not decoration: implementations disagree on what a struct
// member that is itself a struct aligns to in the uniform address space —
// Dawn packs LightRange at its natural 8, the std140-style reading of the
// spec says 16, and pex-gpu's reflection computes 16. Stating it leaves
// nothing to infer, and a mismatch here is silent: every range reads as the
// neighbouring one and the scene loses every light but its ambient.
struct LightRanges {
${LIGHT_TYPES.map((type) => `  @align(16) ${type}: LightRange,`).join("\n")}
}`;
