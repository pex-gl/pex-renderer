// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#specifying-extensions
export const SUPPORTED_EXTENSIONS = new Set([
  // 1.0
  "KHR_materials_pbrSpecularGlossiness",
  // 2.0
  "EXT_mesh_gpu_instancing",
  // "KHR_animation_pointer",
  "KHR_draco_mesh_compression",
  "KHR_lights_punctual",
  // "KHR_materials_anisotropy",
  "KHR_materials_clearcoat",
  "KHR_materials_dispersion",
  "KHR_materials_emissive_strength",
  "KHR_materials_ior",
  // "KHR_materials_iridescence",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_transmission",
  "KHR_materials_diffuse_transmission",
  "KHR_materials_unlit",
  // "KHR_materials_variants",
  "KHR_materials_volume",
  "KHR_mesh_quantization",
  "KHR_texture_transform",
  "EXT_lights_image_based",

  // WIP:
  // "KHR_materials_volume_scatter"
  // "KHR_animation_pointer"
  // "KHR_audio"
  // "KHR_texture_basisu" / "EXT_texture_webp": pex-loaders' KTX2/basis
  //   transcoder currently picks its target format from a WebGL context and
  //   hasn't been ported to pex-gpu/WebGPU yet.
]);

// https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#Buffers
export const WEBGL_CONSTANTS = {
  ELEMENT_ARRAY_BUFFER: 34_963, // 0x8893
  ARRAY_BUFFER: 34_962, // 0x8892

  // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#Data_types
  BYTE: 5120, // 0x1400
  UNSIGNED_BYTE: 5121, // 0x1401
  SHORT: 5122, // 0x1402
  UNSIGNED_SHORT: 5123, // 0x1403
  UNSIGNED_INT: 5125, // 0x1405
  FLOAT: 5126, // 0x1406
} as const;

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays#Typed_array_views
export const WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES: Record<
  number,
  Float32ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor
> = {
  [WEBGL_CONSTANTS.BYTE]: Int8Array,
  [WEBGL_CONSTANTS.UNSIGNED_BYTE]: Uint8Array,
  [WEBGL_CONSTANTS.SHORT]: Int16Array,
  [WEBGL_CONSTANTS.UNSIGNED_SHORT]: Uint16Array,
  [WEBGL_CONSTANTS.UNSIGNED_INT]: Uint32Array,
  [WEBGL_CONSTANTS.FLOAT]: Float32Array,
};

// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#accessor-element-size
export const GLTF_ACCESSOR_COMPONENT_TYPE_SIZE: Record<number, number> = {
  [WEBGL_CONSTANTS.BYTE]: 1,
  [WEBGL_CONSTANTS.UNSIGNED_BYTE]: 1,
  [WEBGL_CONSTANTS.SHORT]: 2,
  [WEBGL_CONSTANTS.UNSIGNED_SHORT]: 2,
  [WEBGL_CONSTANTS.UNSIGNED_INT]: 4,
  [WEBGL_CONSTANTS.FLOAT]: 4,
};

export const GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#header
export const MAGIC = 0x46_54_6c_67; // glTF

// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#chunks
export const CHUNK_TYPE = {
  JSON: 0x4e_4f_53_4a,
  BIN: 0x00_4e_49_42,
} as const;

// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
export const MESH_QUANTIZATION_SCALE = new Map<Function, number>([
  [Int8Array, 1 / 127],
  [Uint8Array, 1 / 255],
  [Int16Array, 1 / 32_767],
  [Uint16Array, 1 / 65_535],
]);

export const normalizeData = (data: { constructor: Function }): Float32Array =>
  new Float32Array(data as unknown as ArrayLike<number>).map(
    (v) => v * (MESH_QUANTIZATION_SCALE.get(data.constructor) ?? 1),
  );

export const isSafari =
  typeof navigator !== "undefined" &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent ?? "");
