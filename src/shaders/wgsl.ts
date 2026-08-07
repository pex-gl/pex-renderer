// Binding primitives

/** A material texture's `@group(2)` uniform binding slot (texture + sampler). */
export interface MaterialTextureBinding {
  texture: number;
  sampler: number;
}

/** Sequential `@binding` counter for a single bind group. */
export interface BindingAllocator {
  next: () => number;
  nextTextureSampler: () => MaterialTextureBinding;
}

/**
 * Curries a pipeline shader's `options.texCoords` (per-texture-slot texCoord
 * set) into a `tc(key)` lookup, defaulting to set 0 when a slot isn't assigned
 * — shared so every generator's texCoord-set expressions read the same options
 * shape the same way.
 */
export function getTexCoordGetter(
  texCoords: Record<string, number>,
): (key: string) => number {
  return (key) => texCoords[key] ?? 0;
}

/**
 * Turns a whole `DEFINE`-style map (e.g. `shaders/standard.ts`'s
 * `MATERIAL_DEFINE`/`VERTEX_DEFINE`) into a flags object of the same shape, one
 * `defines.has(...)` check per key — the read-side counterpart to
 * `getFeatureFlags`'s write-side walk, replacing one hand-written `const useX =
 * defines.has(DEFINE.x)` per define with a single call.
 */
export function getDefineFlags<T extends Record<string, string>>(
  defineMap: T,
  defines: Set<string>,
): { [K in keyof T]: boolean } {
  return Object.fromEntries(
    Object.entries(defineMap).map(([key, value]) => [key, defines.has(value)]),
  ) as { [K in keyof T]: boolean };
}

/**
 * Curries a bind group's binding counter into a closure (not a class — matches
 * the getTexCoordGetter/getDefineFlags factory idiom and keeps the module
 * tree-shakeable). Material groups reserve binding 0 for the uMaterial struct,
 * so start at 1; the light group has no reserved slot, so start at 0.
 */
export function createBindingAllocator(start = 0): BindingAllocator {
  let next = start;
  return {
    next: () => next++,
    nextTextureSampler: () => ({ texture: next++, sampler: next++ }),
  };
}

/**
 * A single `@group @binding var` declaration line — the primitive every other
 * binding declaration here is built from. `addressSpace` (e.g. `"uniform"`) is
 * omitted for handle types (textures/samplers), which take none in WGSL.
 */
export function bindingDeclaration(
  group: number,
  binding: number,
  name: string,
  type: string,
  addressSpace = "",
): string {
  const qualifier = addressSpace ? `<${addressSpace}>` : "";
  return `@group(${group}) @binding(${binding}) var${qualifier} ${name}: ${type};`;
}

// Uniform naming conventions. These are the single source shared by both the
// decl side (textureSamplerDeclaration / textureMatrixField here) and the
// runtime uniform-write side (getFeatureFlags in systems/renderer/base.ts, and
// the light writes in systems/renderer/standard.ts), so a shader can never
// declare a name the renderer writes under a different one.

/**
 * Property/feature key → its `u`-prefixed uniform var name:
 * `"baseColorTexture"` → `"uBaseColorTexture"`, `"directionalShadowMap0"` →
 * `"uDirectionalShadowMap0"`. The `u`+capitalize convention for every uniform
 * (textures, light arrays, shadow maps) lives here.
 */
export function uniformName(key: string): string {
  return `u${key[0]!.toUpperCase()}${key.slice(1)}`;
}

/**
 * Texture/shadow-map var name → its paired sampler var name:
 * `"uBaseColorTexture"` → `"uBaseColorTextureSampler"`.
 */
export function samplerName(varName: string): string {
  return `${varName}Sampler`;
}

/**
 * Material-feature key → its KHR_texture_transform matrix name:
 * `"baseColorTexture"` → `"baseColorTextureMatrix"`.
 */
export function textureMatrixName(key: string): string {
  return `${key}Matrix`;
}

// Declaration builders

/**
 * One texture+sampler binding-pair declaration, or "" when the pair is unused.
 * Shared by material textures (non-comparison sampler) and shadow maps (depth
 * texture + comparison sampler) — they differ only by group, texture kind and
 * sampler kind.
 */
export function textureSamplerDeclaration(
  group: number,
  binding: MaterialTextureBinding | null,
  varName: string,
  kind = "texture_2d<f32>",
  samplerKind = "sampler",
): string {
  return binding
    ? `${bindingDeclaration(group, binding.texture, varName, kind)}\n${bindingDeclaration(group, binding.sampler, samplerName(varName), samplerKind)}`
    : "";
}

/**
 * KHR_texture_transform struct field for a texture, or "" when absent. `key` is
 * the full material-feature key (e.g. `"baseColorTexture"`), emitting
 * `baseColorTextureMatrix: mat3x3f,`.
 */
export function textureMatrixField(
  key: string,
  binding: MaterialTextureBinding | null,
): string {
  return binding ? `${textureMatrixName(key)}: mat3x3f,` : "";
}

/**
 * A fixed-size light-array uniform declaration, or "" when the count is 0
 * (consuming no binding in that case, so the counter only advances for arrays
 * that are actually declared).
 */
export function lightArrayDeclaration(
  group: number,
  alloc: BindingAllocator,
  name: string,
  structName: string,
  count: number,
): string {
  return count === 0
    ? ""
    : bindingDeclaration(
        group,
        alloc.next(),
        name,
        `array<${structName}, ${count}>`,
        "uniform",
      );
}

// Uniform struct builders

/** Options for {@link frameStruct}. */
export interface FrameStructOptions {
  /**
   * Extra trailing struct members, appended verbatim (e.g. depth-pass's `"far:
   * f32,"` for omni shadows).
   */
  extraFields?: string;
}

/** The `@group(0)` per-frame uniform block, shared by every pass. */
export function frameStruct({
  extraFields = "",
}: FrameStructOptions = {}): string {
  return `struct Frame {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  inverseViewMatrix: mat4x4f,
  cameraPosition: vec3f,
  viewportSize: vec2f,
  ${extraFields}
}
${bindingDeclaration(0, 0, "uFrame", "Frame", "uniform")}`;
}

/** Options for {@link modelStruct}. */
export interface ModelStructOptions {
  /**
   * Declare the displacement texture (bindings 2/3) and its `displacement`
   * struct field.
   */
  displacementTexture?: boolean;
  /** Declare the skin joint-matrix array (binding 1). */
  skin?: boolean;
  /** Skin joint-matrix array length. */
  maxJoints?: number;
}

/**
 * The `@group(3)` per-model uniform block plus its optional skin joint-matrix
 * (binding 1) and displacement texture (bindings 2/3) decls — the same layout
 * in every pass.
 */
export function modelStruct({
  displacementTexture = false,
  skin = false,
  maxJoints = 256,
}: ModelStructOptions = {}): string {
  return `struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat3x3f,
  ${displacementTexture ? "displacement: f32," : ""}
}
${bindingDeclaration(3, 0, "uModel", "Model", "uniform")}
${skin ? bindingDeclaration(3, 1, "uJointMatrices", `array<mat4x4f, ${maxJoints}>`, "uniform") : ""}
${displacementTexture ? textureSamplerDeclaration(3, { texture: 2, sampler: 3 }, "uDisplacementTexture") : ""}`;
}

// Vertex stage: input struct and the transform body it feeds.

/** Geometry/instancing attributes gated into a pass's `VertexInput`. */
export interface VertexInputFlags {
  normal?: boolean;
  tangent?: boolean;
  texCoord0?: boolean;
  texCoord1?: boolean;
  vertexColor?: boolean;
  instancedOffset?: boolean;
  instancedScale?: boolean;
  instancedRotation?: boolean;
  instancedColor?: boolean;
  skin?: boolean;
}

// Canonical @location convention shared by every pass's VertexInput: position
// (0) is always present, the rest are gated by the caller's flags. A pass that
// never reads an attribute simply leaves its flag unset.
const VERTEX_ATTRIBUTES: readonly [keyof VertexInputFlags, string][] = [
  ["normal", "@location(1) normal: vec3f,"],
  ["tangent", "@location(2) tangent: vec4f,"],
  ["texCoord0", "@location(3) texCoord0: vec2f,"],
  ["texCoord1", "@location(4) texCoord1: vec2f,"],
  ["vertexColor", "@location(5) vertexColor: vec4f,"],
  ["instancedOffset", "@location(6) offset: vec3f,"],
  ["instancedScale", "@location(7) scale: vec3f,"],
  ["instancedRotation", "@location(8) rotation: vec4f,"],
  ["instancedColor", "@location(9) instanceColor: vec4f,"],
  ["skin", "@location(10) joint: vec4f,\n  @location(11) weight: vec4f,"],
];

export function vertexInputStruct(flags: VertexInputFlags): string {
  const attributes = ["@location(0) position: vec3f,"];
  for (const [key, decl] of VERTEX_ATTRIBUTES) {
    if (flags[key]) attributes.push(decl);
  }
  return `struct VertexInput {
  ${attributes.join("\n  ")}
}`;
}

/**
 * Vertex-stage transform flags: which instancing attributes are active and
 * whether the pass needs the normal/tangent carried through the transform.
 */
export interface VertexTransformFlags {
  useSkin?: boolean;
  instancedScale?: boolean;
  instancedRotation?: boolean;
  instancedOffset?: boolean;
  /**
   * Transform the normal into view space and write `output.normalView`. The
   * depth-only pass, which needs position alone, leaves this off.
   */
  transformNormal?: boolean;
  /**
   * Pre-transform the tangent by the skin matrix (standard's normal-mapping
   * path only; unused by both depth passes).
   */
  transformTangent?: boolean;
}

const SKIN_MATRIX = `let skinMat =
    input.weight.x * uJointMatrices[u32(input.joint.x)] +
    input.weight.y * uJointMatrices[u32(input.joint.y)] +
    input.weight.z * uJointMatrices[u32(input.joint.z)] +
    input.weight.w * uJointMatrices[u32(input.joint.w)];`;

/**
 * The shared vertex-stage transform: declares `positionWorld` and applies skin
 * (or model-matrix) plus instanced scale/rotation/offset, optionally carrying
 * the normal (and skinned tangent) through. Emits `output.normalView` when
 * `transformNormal` is set. Assumes `position`/`normal`/`tangent`/`output` are
 * already in scope (matching each pass's vertexMain).
 */
export function vertexTransform({
  useSkin = false,
  instancedScale = false,
  instancedRotation = false,
  instancedOffset = false,
  transformNormal = false,
  transformTangent = false,
}: VertexTransformFlags): string {
  const rotate = (target: string) =>
    `let rotationMat = quatToMat4(input.rotation);\n  ${target} = rotationMat * ${target};${transformNormal ? "\n  normal = (rotationMat * vec4f(normal, 0.0)).xyz;" : ""}`;

  const branch = useSkin
    ? [
        SKIN_MATRIX,
        transformNormal && "normal = (skinMat * vec4f(normal, 0.0)).xyz;",
        "positionWorld = skinMat * position;",
        instancedScale &&
          "positionWorld = vec4f(positionWorld.xyz * input.scale, positionWorld.w);",
        instancedRotation && rotate("positionWorld"),
        instancedOffset &&
          "positionWorld = vec4f(positionWorld.xyz + input.offset, positionWorld.w);",
        transformTangent && "tangent = skinMat * vec4f(tangent.xyz, 0.0);",
        transformNormal &&
          "output.normalView = (uFrame.viewMatrix * vec4f(normal, 0.0)).xyz;",
      ]
    : [
        instancedScale &&
          "position = vec4f(position.xyz * input.scale, position.w);",
        instancedRotation && rotate("position"),
        instancedOffset &&
          "position = vec4f(position.xyz + input.offset, position.w);",
        "positionWorld = uModel.modelMatrix * position;",
        transformNormal && "output.normalView = uModel.normalMatrix * normal;",
      ];

  return `var positionWorld: vec4f;
  ${branch.filter(Boolean).join("\n\n  ")}`;
}

// Fragment stage

/**
 * Optional G-buffer fragment outputs beyond the always-present color
 * (`@location(0)`), keyed by their runtime attachment `@location`. A negative
 * location omits the output (matching each pass's `useDrawBuffers && location
 *
 * > = 0` gate).
 */
export interface FragmentOutputFlags {
  normal?: number;
  emissive?: number;
}

/**
 * The fragment stage's `FragmentOutput` struct: the color target plus the
 * optional deferred normal/emissive targets at their runtime locations. Shared
 * by the basic/standard passes; called with no args it's the color-only form
 * the depth pre-pass uses.
 */
export function fragmentOutputStruct({
  normal = -1,
  emissive = -1,
}: FragmentOutputFlags = {}): string {
  const outputs = ["@location(0) color: vec4f,"];
  if (normal >= 0) outputs.push(`@location(${normal}) normal: vec4f,`);
  if (emissive >= 0) outputs.push(`@location(${emissive}) emissive: vec4f,`);
  return `struct FragmentOutput {
  ${outputs.join("\n  ")}
}`;
}
