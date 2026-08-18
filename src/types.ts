import type { GpuContext, GpuTexture, GpuBuffer, ExternalImageSource } from "pex-gpu";
import type { Vec2, Vec3, Quat, Mat3, Mat4 } from "pex-math";
import type { FrameGraph } from "./frame-graph/index.js";

/** Axis-aligned bounding box as [min, max]. */
export type AABB = number[][];
/** RGB or RGBA color, components in [0, 1]. */
export type Color = number[];

/** UV transform applied to a material texture. */
export interface TextureTransform {
  /** [x, y] */
  offset?: Vec2;
  /** Angle in radians. */
  rotation?: number;
  /** [x, y] */
  scale?: Vec2;
  /** Vertex texCoord set to sample: 0 (texCoord0) or 1 (texCoord1). */
  texCoord?: 0 | 1;
  /**
   * Per-texture sampler override (e.g. from a glTF sampler's wrap/filter
   * settings). Falls back to the renderer's shared default sampler when unset.
   */
  sampler?: GPUSampler;
}

/**
 * A material texture: a GPU texture, its properties optionally decorated
 * directly onto the texture object with a UV transform, texCoord set and/or
 * sampler override. The nested `{ texture, ... }` form is used whenever any of
 * these are set; a bare GpuTexture is used otherwise.
 */
export type MaterialTexture =
  | GpuTexture
  | ({ texture: GpuTexture } & Partial<TextureTransform>);

/**
 * A single vertex/index attribute value on a geometry component: a plain typed
 * array/number array, or a GPU-backed descriptor (e.g. built by the glTF
 * loader to share one buffer across attributes/primitives from the same
 * bufferView).
 */
export type GeometryAttribute =
  | Float32Array
  | Uint16Array
  | Uint32Array
  | number[]
  | {
      buffer: GpuBuffer;
      /** Raw data backing the buffer, e.g. for bounds computation. */
      data?: Float32Array | Uint16Array | Uint32Array | number[];
      /** Byte offset into the buffer. */
      offset?: number;
      /** Byte stride override. */
      stride?: number;
      /** "instance" to step this attribute per instance instead of per vertex. */
      stepMode?: GPUVertexStepMode;
      /** Re-uploads the buffer's data on the next geometry-system update. */
      dirty?: boolean;
    };

// Entity
export interface Entity {
  id: number;
  /** Debug/display label, e.g. set by loaders and helper tools. */
  name?: string;
  ambientLight?: AmbientLightComponentOptions;
  animation?: AnimationComponentOptions;
  /** Multiple named animations (e.g. from a glTF file); systems/animation.ts plays these instead of `animation` when set. */
  animations?: AnimationComponentOptions[];
  areaLight?: AreaLightComponentOptions;
  axesHelper?: AxesHelperComponentOptions;
  boundingBoxHelper?: BoundingBoxHelperComponentOptions;
  skeletonHelper?: SkeletonHelperComponentOptions;
  cameraHelper?: CameraHelperComponentOptions;
  camera?: CameraComponentOptions;
  directionalLight?: DirectionalLightComponentOptions;
  geometry?: GeometryComponentOptions;
  gridHelper?: GridHelperComponentOptions;
  lightHelper?: LightHelperComponentOptions;
  material?: MaterialComponentOptions;
  morph?: MorphComponentOptions;
  orbiter?: OrbiterComponentOptions;
  pointLight?: PointLightComponentOptions;
  postProcessing?: PostProcessingComponentOptions;
  reflectionProbe?: ReflectionProbeComponentOptions;
  skin?: SkinComponentOptions;
  skybox?: SkyboxComponentOptions;
  spotLight?: SpotLightComponentOptions;
  transform?: TransformComponentOptions;
  vertexHelper?: VertexHelperComponentOptions;
  /** Layer name used to filter entities per render view. */
  layer?: string | undefined;
  /** Cached transform state, added by the transform system. */
  _transform?: TransformCache;
  /** Cached geometry GPU resources, added by the geometry system. */
  _geometry?: GeometryCache;
  /** Baked IBL GPU resources, added by the reflection-probe system. */
  _reflectionProbe?: ReflectionProbeCache;
}

/**
 * Baked image-based lighting resources for a reflection probe entity. Field
 * naming follows the glTF `EXT_lights_image_based` vocabulary (specular cubemap
 * + irradiance coefficients) so a future loader maps onto it directly.
 */
export interface ReflectionProbeCache {
  /** Prefiltered specular radiance cubemap (roughness mapped to mip level). */
  specularTexture: GpuTexture;
  /** L2 spherical harmonics diffuse irradiance coefficients (9 × vec4f). */
  irradianceCoefficients: GpuBuffer;
  /** Trilinear sampler for the specular cubemap. */
  sampler: GPUSampler;
  /** Mip levels in specularTexture; drives the shader's roughness-to-lod mapping. */
  roughnessLevels: number;
  /** Rotation applied to the sampled reflection/normal directions. */
  rotation?: Mat3 | undefined;
  /** Multiplier applied to the probe's indirect diffuse + specular output. */
  intensity?: number | undefined;
}

// Components
export interface AmbientLightComponentOptions {
  color?: Color;
  intensity?: number;
}
export interface AnimationComponentOptions {
  name?: string;
  playing?: boolean;
  loop?: boolean;
  time?: number;
  /** Total animation length in seconds; falls back to the last channel's input when unset. */
  duration?: number;
  channels?: unknown[];
}
/** Shadow-mapping internals shared by shadow-casting lights. */
export interface LightShadowInternals {
  _projectionMatrix?: Mat4;
  _viewMatrix?: Mat4;
  _direction?: Vec3;
  _near?: number;
  _far?: number;
  _radiusUV?: Vec2;
  _shadowMap?: GpuTexture;
  _shadowCubemap?: GpuTexture;
  _sceneBboxInLightSpace?: AABB;
  _sceneBbox?: AABB;
}
export interface AreaLightComponentOptions extends LightShadowInternals {
  color?: Color;
  intensity?: number;
  disk?: boolean;
  doubleSided?: boolean;
  /** Shadow-map rasterizer constant depth bias. */
  depthBias?: number;
  /**
   * Shadow-map rasterizer slope-scaled depth bias, the effective term on a
   * float depth map (raise to remove acne).
   */
  depthBiasSlopeScale?: number;
  /**
   * Upper bound on the applied depth bias to limit peter-panning (0 disables
   * the clamp).
   */
  depthBiasClamp?: number;
  /**
   * Soft-shadow (PCSS) light radius in world units (scaled by the light's
   * transform): larger widens the penumbra.
   */
  bulbRadius?: number;
  castShadows?: boolean;
  shadowMapSize?: number;
}
export interface AxesHelperComponentOptions {}
export interface BoundingBoxHelperComponentOptions {
  color?: Color;
}
export interface SkeletonHelperComponentOptions {
  color?: Color | Color[];
}
export interface CameraHelperComponentOptions {
  color?: Color;
}
export interface CameraView {
  totalSize?: Vec2;
  size?: Vec2;
  offset?: Vec2;
}
export interface CameraComponentOptions {
  projection?: "perspective" | "orthographic";
  near?: number;
  far?: number;
  aspect?: number;
  clearColor?: Color;
  viewMatrix?: Mat4;
  inverseViewMatrix?: Mat4;
  culling?: boolean;
  /** Focal length of the camera lens [10mm - 200mm] in mm. */
  focalLength?: number;
  /** Ratio of camera lens opening, f-number, f/N, aperture [1.2 - 32] in mm. */
  fStop?: number;
  /** Physical camera sensor or film size [sensorWidth, sensorHeight] in mm. */
  sensorSize?: Vec2;
  /** Matching of camera frame to sensor frame. */
  sensorFit?: "vertical" | "horizontal" | "fit" | "overscan" | "fill";
  view?: CameraView;
  fov?: number;
  left?: number;
  right?: number;
  bottom?: number;
  top?: number;
  zoom?: number;
  /** [x, y, width, height] region of the target this camera renders into. */
  viewport?: number[];
  // Runtime, added/derived by the camera system.
  projectionMatrix?: Mat4;
  frustum?: Float32Array;
  actualSensorHeight?: number;
  dirty?: boolean;
}
export interface DirectionalLightComponentOptions extends LightShadowInternals {
  color?: Color;
  intensity?: number;
  /** Shadow-map rasterizer constant depth bias. */
  depthBias?: number;
  /**
   * Shadow-map rasterizer slope-scaled depth bias, the effective term on a
   * float depth map (raise to remove acne).
   */
  depthBiasSlopeScale?: number;
  /**
   * Upper bound on the applied depth bias to limit peter-panning (0 disables
   * the clamp).
   */
  depthBiasClamp?: number;
  /**
   * Soft-shadow (PCSS) light size. A directional light is at infinity, so this
   * reads as an angular size relative to the shadow frustum: larger widens the
   * penumbra.
   */
  bulbRadius?: number;
  castShadows?: boolean;
  shadowMapSize?: number;
}
export interface GeometryComponentOptions {
  positions?: GeometryAttribute;
  normals?: GeometryAttribute;
  tangents?: GeometryAttribute;
  /** Alias: texCoords/texCoords0 */
  uvs?: GeometryAttribute;
  /** Alias: texCoords1 */
  uvs1?: GeometryAttribute;
  vertexColors?: GeometryAttribute;
  cells?: GeometryAttribute;
  weights?: GeometryAttribute;
  joints?: GeometryAttribute;
  /** Instanced */
  offsets?: GeometryAttribute;
  /** Instanced */
  rotations?: GeometryAttribute;
  /** Instanced */
  scales?: GeometryAttribute;
  /** Instanced */
  colors?: GeometryAttribute;
  count?: number;
  instances?: number;
  multiDraw?: object;
  culled?: boolean;
  primitive?: string;
  /** Runtime, computed by the geometry system. */
  bounds?: AABB;
  attributes?: Record<string, unknown>;
}
export interface GridHelperComponentOptions {
  color?: Color;
  size?: number;
}
export interface LightHelperComponentOptions {}
/**
 * Blend equation preset for `material.blend`, named after their common
 * compositing-software equivalents (Photoshop/Three.js/Unity):
 * "normal" (standard non-premultiplied "over"), "premultiplied" ("over" with
 * color already scaled by opacity), "additive", "multiply", "screen".
 */
export type BlendMode =
  | "normal"
  | "premultiplied"
  | "additive"
  | "multiply"
  | "screen";
export interface MaterialComponentOptions {
  unlit?: boolean;
  type?: undefined | "line";
  baseColor?: Color;
  emissiveColor?: Color;
  emissiveIntensity?: number;
  metallic?: number;
  roughness?: number;
  ior?: number;
  specular?: number;
  specularTexture?: MaterialTexture;
  specularColor?: Color;
  specularColorTexture?: MaterialTexture;
  baseColorTexture?: MaterialTexture;
  emissiveColorTexture?: MaterialTexture;
  normalTexture?: MaterialTexture;
  normalTextureScale?: number;
  roughnessTexture?: MaterialTexture;
  metallicTexture?: MaterialTexture;
  metallicRoughnessTexture?: MaterialTexture;
  occlusionTexture?: MaterialTexture;
  clearCoat?: number;
  clearCoatRoughness?: number;
  clearCoatTexture?: MaterialTexture;
  clearCoatRoughnessTexture?: MaterialTexture;
  clearCoatNormalTexture?: MaterialTexture;
  clearCoatNormalTextureScale?: number;
  sheenColor?: Color;
  sheenRoughness?: number;
  transmission?: number;
  transmissionTexture?: MaterialTexture;
  dispersion?: number;
  diffuseTransmission?: number;
  diffuseTransmissionTexture?: MaterialTexture;
  diffuseTransmissionColor?: Color;
  diffuseTransmissionColorTexture?: MaterialTexture;
  thickness?: number;
  thicknessTexture?: MaterialTexture;
  attenuationDistance?: number;
  attenuationColor?: Color;
  alphaTest?: number;
  alphaTexture?: MaterialTexture;
  depthTest?: boolean;
  depthWrite?: boolean;
  depthFunc?: string;
  blend?: boolean;
  /** Blend equation when `blend` is set. Default: "normal". */
  blendMode?: BlendMode;
  cullFace?: boolean;
  cullFaceMode?: string;
  pointSize?: number;
  castShadows?: boolean;
  receiveShadows?: boolean;
  // Line material fields (type: "line"), stored on the same slot.
  lineWidth?: number;
  lineResolution?: number;
  perspectiveScaling?: boolean;
  /** Runtime flag set by renderers when the pipeline variant is rebuilt. */
  needsPipelineUpdate?: boolean;
}
export interface LineMaterialComponentOptions {
  type?: "line";
  baseColor?: Color;
  lineWidth?: number;
  lineResolution?: number;
  perspectiveScaling?: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
  castShadows?: boolean;
}
export interface MorphComponentOptions {
  sources: Record<string, any>;
  targets: Record<string, any>;
  current?: Record<string, any>;
  weights?: number[];
}
export interface OrbiterComponentOptions {
  element?: HTMLElement;
  target?: Vec3;
  lat?: number;
  lon?: number;
  distance?: number;
  /** Runtime pex-cam orbiter instance. */
  _orbiter?: any;
}
export interface PointLightComponentOptions extends LightShadowInternals {
  color?: Color;
  intensity?: number;
  range?: number;
  /** Normalized shadow-map bias (fraction of the light's far plane). */
  bias?: number;
  bulbRadius?: number;
  castShadows?: boolean;
  shadowMapSize?: number;
}
export interface SSAOComponentOptions {
  type?: "sao" | "gtao";
  noiseTexture?: boolean;
  mix?: number;
  samples?: number;
  intensity?: number;
  /** Meters */
  radius?: number;
  blurRadius?: number;
  blurSharpness?: number;
  brightness?: number;
  contrast?: number;
  /** Centimeters */
  bias?: number;
  spiralTurns?: number;
  slices?: number;
  colorBounce?: boolean;
  colorBounceIntensity?: number;
}
export interface DoFComponentOptions {
  /** Gustafsson uses a spiral pattern while Upitis uses a circular one. */
  type?: "gustafsson" | "upitis";
  /** Use camera f-stop and focal length. */
  physical?: boolean;
  /** The point to focus on in meters. */
  focusDistance?: number;
  /**
   * Non physically based value for artistic control when physical is false,
   * otherwise acts as an fStop divider.
   */
  focusScale?: number;
  /**
   * Read the depth buffer to find the first intersecting object to focus on
   * instead of a fixed focus distance.
   */
  focusOnScreenPoint?: boolean;
  /** The normalized screen point to focus on when "focusOnScreenPoint" is true. */
  screenPoint?: Vec2;
  /** Amount of RGB separation. */
  chromaticAberration?: number;
  /** Threshold for out of focus highlights. */
  luminanceThreshold?: number;
  /** Gain for out of focus highlights. */
  luminanceGain?: number;
  /**
   * Iteration steps. More steps means better blur but also degraded
   * performances.
   */
  samples?: number;
  /** The bokeh shape for type "upitis". */
  shape?: "disk" | "pentagon";
  debug?: boolean;
}
export interface MSAAComponentOptions {
  /** Multisample anti-aliasing samples: 1 or 4. */
  sampleCount?: number;
}
export interface FXAAComponentOptions {
  /** For edge luma threshold: 0 to 4. */
  quality?: number;
  /** Higher = softer. Helps mitigate fireflies but will blur small details. */
  subPixelQuality?: number;
}
export interface SMAAComponentOptions {
  /** 0 to 3 (60/80/95/99% of the quality). */
  quality?: number;
  edges?: "luma" | "color" | "depth";
}
export interface FogComponentOptions {
  color?: Color;
  start?: number;
  density?: number;
  sunPosition?: Vec3;
  sunDispertion?: number;
  sunIntensity?: number;
  sunColor?: Color;
  inscatteringCoeffs?: Vec3;
}
export interface BloomComponentOptions {
  /** The bloom quality: 0 or 1 (0 is faster but flickers). */
  quality?: number;
  /** The function used to determine the brightness of a pixel for the threshold. */
  colorFunction?: "luma" | "luminance" | "average";
  /** The brightness value at which pixels are filtered out for the threshold. */
  threshold?: number;
  /** The source texture for the threshold. */
  source?: "color" | "emissive";
  /** The strength of the bloom effect. */
  intensity?: number;
  /** The downsampling radius which controls how much glare gets blended in. */
  radius?: number;
}
export interface LutComponentOptions {
  texture: GpuTexture;
}
export interface ColorCorrectionComponentOptions {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
}
export interface VignetteComponentOptions {
  radius?: number;
  intensity?: number;
}
export interface FilmGrainComponentOptions {
  quality?: number;
  size?: number;
  intensity?: number;
  colorIntensity?: number;
  luminanceIntensity?: number;
  speed?: number;
}
export interface PostProcessingComponentOptions {
  ssao?: SSAOComponentOptions;
  dof?: DoFComponentOptions;
  bloom?: BloomComponentOptions;
  fog?: FogComponentOptions;
  vignette?: VignetteComponentOptions;
  lut?: LutComponentOptions;
  colorCorrection?: ColorCorrectionComponentOptions;
  fxaa?: FXAAComponentOptions;
  smaa?: SMAAComponentOptions;
  msaa?: MSAAComponentOptions;
  filmGrain?: FilmGrainComponentOptions;
  exposure?: number;
  toneMap?:
    | "aces"
    | "agx"
    | "agxPunchy"
    | "filmic"
    | "lottes"
    | "neutral"
    | "reinhard"
    | "reinhard2"
    | "uchimura"
    | "uncharted2"
    | "unreal";
  opacity?: number;
}
/**
 * Pre-baked image-based lighting data (e.g. from a glTF `EXT_lights_image_based`
 * light) that bypasses the reflection-probe system's compute-shader bake
 * pipeline entirely: the specular mips and SH coefficients are uploaded as-is.
 */
export interface ReflectionProbePrebakedData {
  /**
   * `[mip][face]` image sources for the specular cubemap, mip 0 first. Face
   * order matches WebGPU cube array layers (+X, -X, +Y, -Y, +Z, -Z). The mip
   * count becomes the probe's `roughnessLevels` — no resampling to a fixed
   * chain is needed.
   */
  specularImages: ExternalImageSource[][];
  /** Mip 0 face size in pixels. */
  specularImageSize: number;
  /** 9 L2 spherical harmonics coefficients, each `[r, g, b]`. */
  irradianceCoefficients: number[][];
  /** Seeds the probe entity's transform rotation on load. */
  rotation?: Quat;
  /** Multiplier applied to the probe's indirect diffuse + specular output. */
  intensity?: number;
}
export interface ReflectionProbeComponentOptions {
  /** Set to force a rebake of the probe on the next update. */
  dirty?: boolean;
  /** Pre-baked IBL data; when set, bypasses the compute-shader bake pipeline. */
  data?: ReflectionProbePrebakedData;
}
export interface SkinComponentOptions {}
export interface SkyboxComponentOptions {
  sunPosition?: Vec3;
  envMap?: GpuTexture;
  /**
   * Background blur amount, 0 (sharp) to 1 (fully blurred). Sampled from a
   * paired reflectionProbe entity's prefiltered specular cubemap; ignored
   * with a warning if no reflectionProbe is present.
   */
  backgroundBlur?: number;
  exposure?: number;
  turbidity?: number;
  rayleigh?: number;
  mieCoefficient?: number;
  mieDirectionalG?: number;
  // Runtime, added by the skybox system.
  dirty?: boolean;
  _skyTexture?: GpuTexture;
  _skyTextureChanged?: boolean;
}
export interface SpotLightComponentOptions extends LightShadowInternals {
  color?: Color;
  intensity?: number;
  angle?: number;
  innerAngle?: number;
  range?: number;
  /** Shadow-map rasterizer constant depth bias. */
  depthBias?: number;
  /**
   * Shadow-map rasterizer slope-scaled depth bias, the effective term on a
   * float depth map (raise to remove acne).
   */
  depthBiasSlopeScale?: number;
  /**
   * Upper bound on the applied depth bias to limit peter-panning (0 disables
   * the clamp).
   */
  depthBiasClamp?: number;
  /** Soft-shadow (PCSS) light radius in world units: larger widens the penumbra. */
  bulbRadius?: number;
  castShadows?: boolean;
  shadowMapSize?: number;
}
export interface TransformComponentOptions {
  position?: Vec3;
  rotation?: Quat;
  scale?: Vec3;
  // Runtime, added by the transform system.
  parent?: TransformComponentOptions | undefined;
  entity?: Entity;
  depth?: number;
  worldBounds?: AABB;
  worldPosition?: Vec3;
  modelMatrix?: Mat4;
  dirty?: boolean;
  aabbDirty?: boolean;
}
export interface VertexHelperComponentOptions {
  color?: Color;
  size?: number;
  attribute?: string;
}

// Cached, system-owned resources referenced back from entities.
/** Transform state cached per entity by the transform system. */
export interface TransformCache {
  transform: TransformComponentOptions;
  modelMatrix: Mat4;
  localModelMatrix: Mat4;
  worldPosition: Vec3;
}
// Draw-relevant fields (count/instances/indices) are typed permissively:
// they feed pex-gpu draw commands directly and may legitimately be undefined
// at runtime (inferred by pex-gpu), which exactOptionalPropertyTypes would
// otherwise reject when spread into a RenderCommand.
/** Geometry GPU resources cached per entity by the geometry system. */
export interface GeometryCache {
  geometry: GeometryComponentOptions | null;
  attributes: Record<string, any>;
  indices: any;
  count: number;
  instances: number;
  primitive?: string;
  customAttributes?: string[];
}

// Shaders (pipeline WGSL generators)
/** Raw WGSL text injected at fixed points of a pipeline shader. */
export interface ShaderHooks {
  vertDeclarationsEnd?: string;
  vertBeforeTransform?: string;
  vertEnd?: string;
  fragDeclarationsEnd?: string;
  fragBeforeTextures?: string;
  fragBeforeLighting?: string;
  fragAfterLighting?: string;
  fragEnd?: string;
}
/** Active light counts per type consumed by the standard shader generator. */
export interface ShaderLightCounts {
  ambient?: number;
  directional?: number;
  point?: number;
  spot?: number;
  area?: number;
}
/** Options accepted by the pipeline WGSL generators in src/shaders. */
export interface PipelineShaderOptions {
  hooks?: ShaderHooks;
  /** MRT output location for the normal buffer, requires USE_DRAW_BUFFERS. */
  locationNormal?: number;
  /** MRT output location for the emissive buffer, requires USE_DRAW_BUFFERS. */
  locationEmissive?: number;
  /** MRT output location for the velocity buffer, requires USE_DRAW_BUFFERS. */
  locationVelocity?: number;
  /** Size of the skinning joint matrix array. */
  maxJoints?: number;
  /** Per-texture texture coordinate set index (0 or 1), e.g. { baseColor: 1 }. */
  texCoords?: Record<string, number>;
  /** Active light counts per type (0-4), e.g. { directional: 2, point: 1 }. */
  lights?: ShaderLightCounts;
}
/** Signature of a pipeline WGSL generator. */
export type PipelineShaderBuilder = (
  defines?: Set<string>,
  options?: PipelineShaderOptions,
) => string;

// System
export interface SystemOptions {
  ctx: GpuContext;
  frameGraph: FrameGraph;
}
export type SystemUpdate = (entities: Entity[], deltaTime?: number) => void;
export type SystemDispose = (entities?: Entity[]) => void;
export interface System {
  type: string;
  cache?: Record<number, any>;
  debug?: boolean;
  update: SystemUpdate;
  dispose?: SystemDispose;
}
export interface RenderEngineOptions {
  width?: number;
  height?: number;
  renderers?: RendererSystem[];
  drawToScreen?: boolean;
  /** Overrides the engine's accumulated time for this render call. */
  time?: number;
}
/** Resolves to each camera's render targets, keyed by output name. */
export type RenderEngineRender = (
  entities: Entity[],
  cameraEntities: Entity | Entity[],
  options?: RenderEngineOptions,
) => Promise<Record<string, GpuTexture>[]>;
export type RenderEngineDebug = (enable: boolean) => void;
export interface RenderEngine extends System {
  render: RenderEngineRender;
  debug: any;
  systems: System[];
  renderers: RendererSystem[];
}
export type RendererSystemRender = (
  renderView: RenderView,
  entities: Entity | Entity[],
  options?: any,
) => void;
export interface RendererSystemStageOptions {
  attachmentsLocations?: Record<string, number>;
  shadowMappingLight?: any;
  backgroundColorTexture?: GpuTexture | null;
  renderingToReflectionProbe?: boolean;
  msaa?: boolean;
  transparent?: boolean;
  transmitted?: boolean;
  cullFaceMode?: string;
}
export type RendererSystemStage = (
  renderView: RenderView,
  entities: Entity[],
  options?: RendererSystemStageOptions,
) => void;
// Renderer systems accrete per-frame internal state (locations, light data,
// pipeline caches) and expose a set of optional draw stages (render,
// renderShadow, renderOpaque, ...) with per-renderer signatures. The index
// signature keeps that dynamic draw path usable; RendererSystemRender and
// RendererSystemStage document the stage shape callers rely on.
export interface RendererSystem {
  type: string;
  cache?: Record<number, any>;
  debug?: boolean;
  flagDefinitions?: unknown[];
  [key: string]: any;
}

// World
export type WorldAdd = (entity: Entity) => void;
export type WorldAddSystem = (system: System) => void;
export type WorldUpdate = (deltaTime?: number) => void;
export interface World {
  entities: Entity[];
  systems: System[];
  add: WorldAdd;
  addSystem: WorldAddSystem;
  update: WorldUpdate;
}

/** A camera and the region of a target it renders into. */
export interface RenderView {
  camera: CameraComponentOptions;
  cameraEntity?: Entity;
  /** [x, y, width, height] */
  viewport: number[];
}

export type { GpuContext, GpuTexture, GpuBuffer };
