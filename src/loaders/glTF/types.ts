import type * as GLTF from "types-gltf";
import type {
  GpuBuffer,
  GpuTexture,
  MaterialTexture,
  MorphAttribute,
} from "../../types.js";
// pex-loaders re-exports the function but not its result type.
import type { transcodeKtx2 } from "pex-loaders";

type Ktx2Result = Awaited<ReturnType<typeof transcodeKtx2>>;

/** What an accessor's component type decodes to. */
export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Uint32Array
  | Float32Array;

/**
 * The loader resolves a document in place, caching what it decodes on the
 * object it decoded from, so a second reference to the same accessor, image or
 * texture reuses the first one's work. These are the spec's types plus that
 * cache — `_`-prefixed, as the spec reserves no namespace for it.
 */
export type ResolvedBuffer = GLTF.Buffer & { _data: ArrayBuffer };

export type ResolvedBufferView = GLTF.BufferView & {
  _data: ArrayBuffer;
  /** One vertex buffer per bufferView, shared by every attribute in it. */
  _vertexBuffer?: GpuBuffer;
};

export type ResolvedAccessor = GLTF.Accessor & {
  _data: TypedArray;
  _bufferView: ResolvedBufferView;
};

export type ResolvedImage = GLTF.Image & {
  /** Undefined until resolveImages runs, and for a KTX2 payload. */
  _img?: ImageBitmap | HTMLImageElement;
  /** KHR_texture_basisu only: a transcoded mip chain, uploaded as-is. */
  _ktx2?: Ktx2Result;
};

export type ResolvedTexture = GLTF.Texture & { _tex?: GpuTexture };

/**
 * A parsed glTF document part-way through resolution. Arrays keep the spec's
 * optionality: an index into a missing array is a malformed document, not a
 * case the loader is expected to carry a branch for.
 */
export type ResolvedGltf = Omit<
  GLTF.GlTF,
  "accessors" | "buffers" | "bufferViews" | "images" | "textures"
> & {
  accessors?: ResolvedAccessor[];
  buffers?: ResolvedBuffer[];
  bufferViews?: ResolvedBufferView[];
  images?: ResolvedImage[];
  textures?: ResolvedTexture[];
};

/**
 * A glTF material flattened into one object: `pbrMetallicRoughness` and every
 * supported extension merged to the top level, with the spec's own field names
 * kept. Not a pex-renderer material component — loaders/glTF/pex-renderer.ts
 * maps this onto one.
 *
 * Texture fields carry `undefined` explicitly: resolveTexture returns it for a
 * texture whose image never decoded, and the field is still written.
 */
export interface ResolvedMaterial {
  name?: string | undefined;
  doubleSided: boolean;
  alphaMode: NonNullable<GLTF.Material["alphaMode"]>;
  alphaCutoff?: number | undefined;
  unlit: boolean;

  baseColorFactor?: number[];
  metallicFactor?: number;
  roughnessFactor?: number;
  baseColorTexture?: MaterialTexture | undefined;
  metallicRoughnessTexture?: MaterialTexture | undefined;

  normalTexture?: MaterialTexture | undefined;
  normalTextureScale?: number;
  occlusionTexture?: MaterialTexture | undefined;
  occlusionTextureStrength?: number;
  emissiveTexture?: MaterialTexture | undefined;
  emissiveFactor?: number[];

  // KHR_materials_clearcoat
  clearcoatFactor?: number;
  clearcoatRoughnessFactor?: number;
  clearcoatTexture?: MaterialTexture | undefined;
  clearcoatRoughnessTexture?: MaterialTexture | undefined;
  clearcoatNormalTexture?: MaterialTexture | undefined;
  clearcoatNormalTextureScale?: number;

  // KHR_materials_sheen
  sheenColorFactor?: number[];
  sheenRoughnessFactor?: number;
  sheenColorTexture?: MaterialTexture | undefined;
  sheenRoughnessTexture?: MaterialTexture | undefined;

  // KHR_materials_transmission
  transmissionFactor?: number;
  transmissionTexture?: MaterialTexture | undefined;

  // KHR_materials_diffuse_transmission
  diffuseTransmissionFactor?: number;
  diffuseTransmissionColorFactor?: number[];
  diffuseTransmissionTexture?: MaterialTexture | undefined;
  diffuseTransmissionColorTexture?: MaterialTexture | undefined;

  // KHR_materials_volume
  thicknessFactor?: number;
  attenuationDistance?: number;
  attenuationColor?: number[];
  thicknessTexture?: MaterialTexture | undefined;

  // KHR_materials_dispersion
  dispersion?: number;

  // KHR_materials_ior
  ior?: number;

  // KHR_materials_specular
  specularFactor?: number;
  specularColorFactor?: number[];
  specularTexture?: MaterialTexture | undefined;
  specularColorTexture?: MaterialTexture | undefined;

  // KHR_materials_emissive_strength
  emissiveStrength?: number;

  /**
   * KHR_materials_pbrSpecularGlossiness, prefixed: it and
   * KHR_materials_specular independently chose the same field names for
   * unrelated data, and both flatten into this one object.
   */
  sgDiffuseFactor?: number[];
  sgSpecularFactor?: number[];
  sgGlossinessFactor?: number;
  sgDiffuseTexture?: MaterialTexture | undefined;
  sgSpecularGlossinessTexture?: MaterialTexture | undefined;
}

/** A glTF camera in the spec's own vocabulary, one shape per projection. */
export type ResolvedCamera =
  | {
      name?: string | undefined;
      projection: "orthographic";
      near?: number;
      far?: number;
      left: number;
      right: number;
      top: number;
      bottom: number;
    }
  | {
      name?: string | undefined;
      projection: "perspective";
      near?: number;
      far: number;
      fov: number;
      aspect: number;
    };

/** A KHR_lights_punctual light, defaults applied. */
export interface ResolvedLight {
  type: "directional" | "point" | "spot";
  name?: string | undefined;
  color: number[];
  intensity: number;
  /** Point and spot only; absent means infinite. */
  range?: number | undefined;
  /** Spot only, always set by resolveLight for that type. */
  innerConeAngle?: number;
  /** Spot only, always set by resolveLight for that type. */
  outerConeAngle?: number;
}

/**
 * A primitive's geometry in glTF vocabulary: attributes keyed by semantic
 * (POSITION, NORMAL, TEXCOORD_0, ...) alongside the fields the loader derives.
 * The semantics are open — EXT_mesh_gpu_instancing and application-specific
 * `_`-prefixed attributes both land here — so they are typed through the index
 * signature and narrowed by whoever maps them onto a component.
 */
export interface ResolvedGeometry {
  indices?: TypedArray;
  count?: number;
  /** `[min, max]`, from the POSITION accessor. */
  bounds?: number[][];
  topology?: GPUPrimitiveTopology;
  instanceCount?: number;
  [semantic: string]: unknown;
}

/** One primitive, resolved. */
export interface ResolvedPrimitive {
  geometry: ResolvedGeometry;
  material: ResolvedMaterial | Record<string, never>;
  morph: ResolvedMorphTargets | null;
}

export interface ResolvedMorphTargets {
  sources: Record<string, MorphAttribute>;
  targets: Record<string, MorphAttribute[]>;
  weights: number[];
}
