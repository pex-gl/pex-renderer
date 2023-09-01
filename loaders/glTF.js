import { loadJson, loadImage, loadArrayBuffer, loadBlob } from "pex-io";
import { quat, mat4, utils } from "pex-math";
import { getDirname, getFileExtension } from "../utils.js";
import { components, entity, systems } from "../index.js";
import { loadDraco, loadKtx2 } from "pex-loaders";

const isSafari =
  /^((?!chrome|android).)*safari/i.test(globalThis.navigator?.userAgent) ===
  true;

// Constants
// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#specifying-extensions
const SUPPORTED_EXTENSIONS = [
  // 1.0
  "KHR_materials_pbrSpecularGlossiness",
  // 2.0
  "EXT_mesh_gpu_instancing",
  "KHR_draco_mesh_compression",
  "KHR_lights_punctual",
  "KHR_materials_clearcoat",
  "KHR_materials_emissive_strength",
  // "KHR_materials_ior",
  "KHR_materials_sheen",
  // "KHR_materials_specular",
  // "KHR_materials_transmission",
  "KHR_materials_unlit",
  // "KHR_materials_variants",
  // "KHR_materials_volume",
  "KHR_mesh_quantization",
  "KHR_texture_basisu",
  "KHR_texture_transform",
];

const WEBGL_CONSTANTS = {
  // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#Buffers
  ELEMENT_ARRAY_BUFFER: 34963, // 0x8893
  ARRAY_BUFFER: 34962, // 0x8892

  // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#Data_types
  BYTE: 5120, // 0x1400
  UNSIGNED_BYTE: 5121, // 0x1401
  SHORT: 5122, // 0x1402
  UNSIGNED_SHORT: 5123, // 0x1403
  UNSIGNED_INT: 5125, // 0x1405
  FLOAT: 5126, // 0x1406
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays#Typed_array_views
const WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES = {
  [WEBGL_CONSTANTS.BYTE]: Int8Array,
  [WEBGL_CONSTANTS.UNSIGNED_BYTE]: Uint8Array,
  [WEBGL_CONSTANTS.SHORT]: Int16Array,
  [WEBGL_CONSTANTS.UNSIGNED_SHORT]: Uint16Array,
  [WEBGL_CONSTANTS.UNSIGNED_INT]: Uint32Array,
  [WEBGL_CONSTANTS.FLOAT]: Float32Array,
};

// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#accessor-element-size
const GLTF_ACCESSOR_COMPONENT_TYPE_SIZE = {
  [WEBGL_CONSTANTS.BYTE]: 1,
  [WEBGL_CONSTANTS.UNSIGNED_BYTE]: 1,
  [WEBGL_CONSTANTS.SHORT]: 2,
  [WEBGL_CONSTANTS.UNSIGNED_SHORT]: 2,
  [WEBGL_CONSTANTS.UNSIGNED_INT]: 4,
  [WEBGL_CONSTANTS.FLOAT]: 4,
};

const GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#header
const MAGIC = 0x46546c67; // glTF

// https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#chunks
const CHUNK_TYPE = {
  JSON: 0x4e4f534a,
  BIN: 0x004e4942,
};

const PEX_ATTRIBUTE_NAME_MAP = {
  POSITION: "positions",
  NORMAL: "normals",
  TANGENT: "tangents",
  TEXCOORD_0: "texCoords",
  TEXCOORD_1: "texCoords1",
  JOINTS_0: "joints",
  WEIGHTS_0: "weights",
  COLOR_0: "vertexColors",
  // instanced
  TRANSLATION: "offsets",
  ROTATION: "rotations",
  SCALE: "scales",
};

function linearToSrgb(color) {
  return [
    color[0] ** (1.0 / 2.2),
    color[1] ** (1.0 / 2.2),
    color[2] ** (1.0 / 2.2),
    color.length == 4 ? color[3] : 1,
  ];
}

// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
const MESH_QUANTIZATION_SCALE = {
  [Int8Array]: 1 / 127,
  [Uint8Array]: 1 / 255,
  [Int16Array]: 1 / 32767,
  [Uint16Array]: 1 / 65535,
};

const normalizeData = (data) =>
  new Float32Array(data).map(
    (v) => v * MESH_QUANTIZATION_SCALE[data.constructor]
  );

const loadImageBitmap = async (blob) =>
  await createImageBitmap(blob, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });

// Build
// https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/accessor.schema.json
function getAccessor(accessor, bufferViews) {
  if (accessor._data) return accessor;

  const numberOfComponents =
    GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER[accessor.type];
  if (accessor.byteOffset === undefined) accessor.byteOffset = 0;

  accessor._bufferView = bufferViews[accessor.bufferView];

  const TypedArrayConstructor =
    WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[accessor.componentType];
  const byteSize = GLTF_ACCESSOR_COMPONENT_TYPE_SIZE[accessor.componentType];

  // Handle bufferView byteStride different from accessor.componentType defined byte size
  const itemBytes = byteSize * numberOfComponents;
  const byteStride = accessor._bufferView.byteStride;
  if (byteStride && byteStride !== itemBytes) {
    const ibSlice = Math.floor(accessor.byteOffset / byteStride);
    accessor._data = new TypedArrayConstructor(
      accessor._bufferView._data,
      ibSlice * byteStride,
      (accessor.count * byteStride) / byteSize
    );
    // TODO: AnimatedMorphCube normals needs byteStride * 4
    accessor._byteStride = byteStride;
  } else {
    // Assign buffer view
    accessor._data = new TypedArrayConstructor(
      accessor._bufferView._data,
      accessor.byteOffset,
      accessor.count * numberOfComponents
    );
  }

  // Sparse accessors
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/accessor.sparse.schema.json
  if (accessor.sparse !== undefined) {
    const TypedArrayIndicesConstructor =
      WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[
        accessor.sparse.indices.componentType
      ];

    // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/accessor.sparse.indices.schema.json
    const sparseIndices = new TypedArrayIndicesConstructor(
      bufferViews[accessor.sparse.indices.bufferView]._data,
      accessor.sparse.indices.byteOffset || 0,
      accessor.sparse.count
    );

    // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/accessor.sparse.values.schema.json
    const sparseValues = new TypedArrayConstructor(
      bufferViews[accessor.sparse.values.bufferView]._data,
      accessor.sparse.values.byteOffset || 0,
      accessor.sparse.count * numberOfComponents
    );

    if (accessor._data !== null) {
      accessor._data = accessor._data.slice();
    }

    let valuesIndex = 0;
    for (
      let indicesIndex = 0;
      indicesIndex < sparseIndices.length;
      indicesIndex++
    ) {
      let dataIndex = sparseIndices[indicesIndex] * numberOfComponents;
      for (
        let componentIndex = 0;
        componentIndex < numberOfComponents;
        componentIndex++
      ) {
        accessor._data[dataIndex++] = sparseValues[valuesIndex++];
      }
    }
  }

  return accessor;
}

function getPexMaterialTexture(
  materialTexture,
  { textures, images, samplers },
  ctx,
  encoding
) {
  // Retrieve glTF root object properties
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/texture.schema.json
  const texture = textures[materialTexture.index];

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/image.schema.json
  const image =
    texture.extensions &&
    texture.extensions.KHR_texture_basisu &&
    Number.isInteger(texture.extensions.KHR_texture_basisu.source)
      ? images[texture.extensions.KHR_texture_basisu.source]
      : images[texture.source];

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/sampler.schema.json
  const sampler =
    samplers && samplers[texture.sampler] ? samplers[texture.sampler] : {};

  sampler.minFilter = sampler.minFilter || ctx.Filter.LinearMipmapLinear;
  sampler.magFilter = sampler.magFilter || ctx.Filter.Linear;
  sampler.wrapS = sampler.wrapS || ctx.Wrap.Repeat;
  sampler.wrapT = sampler.wrapT || ctx.Wrap.Repeat;

  const hasMipMap =
    sampler.minFilter !== ctx.Filter.Nearest &&
    sampler.minFilter !== ctx.Filter.Linear;

  if (!texture._tex) {
    let img = image._img;

    if (!utils.isPowerOfTwo(img.width) || !utils.isPowerOfTwo(img.height)) {
      // https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#samplers
      if (
        sampler.wrapS !== ctx.Wrap.ClampToEdge ||
        sampler.wrapT !== ctx.Wrap.ClampToEdge ||
        hasMipMap
      ) {
        const canvas2d = document.createElement("canvas");
        canvas2d.width = utils.nextPowerOfTwo(img.width);
        canvas2d.height = utils.nextPowerOfTwo(img.height);

        console.warn(
          `Resizing NPOT texture ${img.width}x${img.height} to ${canvas2d.width}x${canvas2d.height}. Src: ${img.src}`
        );

        const ctx2d = canvas2d.getContext("2d");
        ctx2d.drawImage(img, 0, 0, canvas2d.width, canvas2d.height);
        img = canvas2d;
      }
    }
    const pexTextureOptions = img.compressed
      ? img
      : { data: img, width: img.width, height: img.height };
    if (!img.compressed && hasMipMap) {
      pexTextureOptions.mipmap = true;
      pexTextureOptions.aniso = 16;
    }
    texture._tex = ctx.texture2D({
      encoding: encoding || ctx.Encoding.Linear,
      pixelFormat: ctx.PixelFormat.RGBA8,
      wrapS: sampler.wrapS,
      wrapT: sampler.wrapT,
      min: sampler.minFilter,
      mag: sampler.magFilter,
      ...pexTextureOptions,
    });
  }

  // https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_transform/schema/KHR_texture_transform.textureInfo.schema.json
  const textureTransform =
    materialTexture.extensions &&
    materialTexture.extensions.KHR_texture_transform;

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/textureInfo.schema.json
  const texCoord = materialTexture.texCoord;

  return !texCoord && !textureTransform
    ? texture._tex
    : {
        texture: texture._tex,
        // textureInfo
        texCoord: texCoord || 0,
        // textureTransform.texCoord: Overrides the textureInfo texCoord value if supplied.
        ...(textureTransform || {}),
      };
}

// https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.schema.json
function handleMaterial(material, gltf, ctx) {
  let materialProps = {
    name: material.name,
    baseColor: [1, 1, 1, 1],
    roughness: 1,
    metallic: 1,
    castShadows: true,
    receiveShadows: true,
    cullFace: !(material.doubleSided || material.alphaMode),
  };

  //  Metallic/Roughness workflow
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.pbrMetallicRoughness.schema.json
  const pbrMetallicRoughness = material.pbrMetallicRoughness;
  if (pbrMetallicRoughness) {
    materialProps = {
      ...materialProps,
      baseColor: [1, 1, 1, 1],
      roughness: 1,
      metallic: 1,
    };
    if (pbrMetallicRoughness.baseColorFactor) {
      materialProps.baseColor = linearToSrgb(
        pbrMetallicRoughness.baseColorFactor
      );
    }
    if (pbrMetallicRoughness.baseColorTexture) {
      materialProps.baseColorTexture = getPexMaterialTexture(
        pbrMetallicRoughness.baseColorTexture,
        gltf,
        ctx,
        ctx.Encoding.SRGB
      );
    }
    if (pbrMetallicRoughness.metallicFactor !== undefined) {
      materialProps.metallic = pbrMetallicRoughness.metallicFactor;
    }
    if (pbrMetallicRoughness.roughnessFactor !== undefined) {
      materialProps.roughness = pbrMetallicRoughness.roughnessFactor;
    }
    if (pbrMetallicRoughness.metallicRoughnessTexture) {
      materialProps.metallicRoughnessTexture = getPexMaterialTexture(
        pbrMetallicRoughness.metallicRoughnessTexture,
        gltf,
        ctx
      );
    }

    if (material.extensions) {
      // https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen#sheen
      if (material.extensions.KHR_materials_sheen) {
        const sheenExt = material.extensions.KHR_materials_sheen;
        materialProps.sheenColor = [...sheenExt.sheenColorFactor, 1.0];
        materialProps.sheenRoughness = sheenExt.sheenRoughnessFactor;
        materialProps.normalScale = 1;
        if (sheenExt.sheenColorTexture) {
          materialProps.sheenColorTexture = getPexMaterialTexture(
            sheenExt.sheenColorTexture,
            gltf,
            ctx,
            ctx.Encoding.SRGB
          );
        }
        if (sheenExt.sheenRoughnessTexture) {
          if (
            sheenExt.sheenColorTexture.index !==
            sheenExt.sheenRoughnessTexture.index
          ) {
            throw new Error(
              "Sheen roughnes texture is different from sheen color texture. Not supported."
            );
          }
        }
      }

      // https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_clearcoat#clearcoat
      if (material.extensions.KHR_materials_clearcoat) {
        const clearcoatExt = material.extensions.KHR_materials_clearcoat;
        materialProps.clearCoat = clearcoatExt.clearcoatFactor;
        materialProps.clearCoatRoughness =
          clearcoatExt.clearcoatRoughnessFactor;
        // TODO: could clearcoatTexture and clearcoatRoughnessTexture be same texture as we read r and g components in shader
        if (clearcoatExt.clearcoatTexture) {
          materialProps.clearCoatTexture = getPexMaterialTexture(
            clearcoatExt.clearcoatTexture,
            gltf,
            ctx,
            ctx.Encoding.Linear
          );
        }
        if (clearcoatExt.clearcoatRoughnessTexture) {
          materialProps.clearCoatRoughnessTexture = getPexMaterialTexture(
            clearcoatExt.clearcoatRoughnessTexture,
            gltf,
            ctx,
            ctx.Encoding.Linear
          );
        }
        if (clearcoatExt.clearcoatNormalTexture) {
          materialProps.clearCoatNormalTexture = getPexMaterialTexture(
            clearcoatExt.clearcoatNormalTexture,
            gltf,
            ctx,
            ctx.Encoding.SRGB
          );
        }
      }
    }
  }

  // Specular/Glossiness workflow
  // https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness/schema/glTF.KHR_materials_pbrSpecularGlossiness.schema.json
  const pbrSpecularGlossiness = material.extensions
    ? material.extensions.KHR_materials_pbrSpecularGlossiness
    : null;
  if (pbrSpecularGlossiness) {
    materialProps = {
      ...materialProps,
      useSpecularGlossinessWorkflow: true,
      diffuse: [1, 1, 1, 1],
      specular: [1, 1, 1],
      glossiness: 1,
    };
    if (pbrSpecularGlossiness.diffuseFactor) {
      materialProps.diffuse = linearToSrgb(pbrSpecularGlossiness.diffuseFactor);
    }
    if (pbrSpecularGlossiness.specularFactor) {
      materialProps.specular = linearToSrgb(
        pbrSpecularGlossiness.specularFactor
      );
    }
    if (pbrSpecularGlossiness.glossinessFactor !== undefined) {
      materialProps.glossiness = pbrSpecularGlossiness.glossinessFactor;
    }
    if (pbrSpecularGlossiness.diffuseTexture) {
      materialProps.diffuseTexture = getPexMaterialTexture(
        pbrSpecularGlossiness.diffuseTexture,
        gltf,
        ctx,
        ctx.Encoding.SRGB
      );
    }
    if (pbrSpecularGlossiness.specularGlossinessTexture) {
      materialProps.specularGlossinessTexture = getPexMaterialTexture(
        pbrSpecularGlossiness.specularGlossinessTexture,
        gltf,
        ctx,
        ctx.Encoding.SRGB
      );
    }
  }

  // Additional Maps
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.normalTextureInfo.schema.json
  if (material.normalTexture) {
    materialProps.normalTexture = getPexMaterialTexture(
      material.normalTexture,
      gltf,
      ctx
    );
  }

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/material.occlusionTextureInfo.schema.json
  if (material.occlusionTexture) {
    materialProps.occlusionTexture = getPexMaterialTexture(
      material.occlusionTexture,
      gltf,
      ctx
    );
  }

  if (material.emissiveTexture) {
    materialProps.emissiveColorTexture = getPexMaterialTexture(
      material.emissiveTexture,
      gltf,
      ctx,
      ctx.Encoding.SRGB
    );
  }

  if (material.emissiveFactor) {
    materialProps = {
      ...materialProps,
      emissiveColor: linearToSrgb(material.emissiveFactor),
    };
  }

  if (material.extensions?.KHR_materials_emissive_strength) {
    materialProps.emissiveIntensity =
      material.extensions.KHR_materials_emissive_strength.emissiveStrength ?? 1;
  }

  // Alpha Coverage
  if (material.alphaMode === "BLEND") {
    materialProps = {
      ...materialProps,
      depthWrite: false,
      blend: true,
      blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
      blendSrcAlphaFactor: ctx.BlendFactor.One,
      blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
      blendDstAlphaFactor: ctx.BlendFactor.One,
    };
  } else if (material.alphaMode === "MASK") {
    materialProps.alphaTest = material.alphaCutoff || 0.5;
  }

  // KHR_materials_unlit
  if (material.extensions && material.extensions.KHR_materials_unlit) {
    materialProps = {
      ...materialProps,
      unlit: true,
    };
  }

  return materialProps;
}

// https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/mesh.primitive.schema.json
async function handlePrimitive(
  primitive,
  { bufferViews, accessors },
  ctx,
  { dracoOptions }
) {
  let geometryProps = {};

  // Load draco
  // https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
  if (primitive.extensions && primitive.extensions.KHR_draco_mesh_compression) {
    // The loader must process KHR_draco_mesh_compression first. The loader must get the data from KHR_draco_mesh_compression's bufferView property and decompress the data using a Draco decoder to a Draco geometry.
    const bufferView =
      bufferViews[primitive.extensions.KHR_draco_mesh_compression.bufferView];
    const gltfAttributeMap =
      primitive.extensions.KHR_draco_mesh_compression.attributes;

    const attributeIDs = {};
    const attributeTypes = {};
    const normalizedAttributes = [];

    for (const name in gltfAttributeMap) {
      attributeIDs[PEX_ATTRIBUTE_NAME_MAP[name] || name.toLowerCase()] =
        gltfAttributeMap[name];
    }

    for (const name in primitive.attributes) {
      const attributeName = PEX_ATTRIBUTE_NAME_MAP[name] || name.toLowerCase();

      if (gltfAttributeMap[name] !== undefined) {
        const accessor = accessors[primitive.attributes[name]];
        const componentType =
          WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[accessor.componentType];
        attributeTypes[attributeName] = componentType.name;
        if (accessor.normalized === true) {
          normalizedAttributes.push(attributeName);
        }
      }
    }

    // If the loader does support the Draco extension, but will not process KHR_draco_mesh_compression, then the loader must load the glTF asset ignoring KHR_draco_mesh_compression in primitive.
    try {
      geometryProps = await loadDraco(bufferView._data, ctx.gl, {
        transcodeConfig: {
          attributeIDs,
          attributeTypes,
          useUniqueIDs: true,
        },
        ...dracoOptions,
      });

      normalizedAttributes.forEach((attributeName) => {
        if (geometryProps[attributeName]) {
          geometryProps[attributeName].normalized = true;
        }
      });
    } catch (error) {
      console.warn(
        `glTF Loader: Error decoding Draco geometry '${primitive.name}'. Trying to load uncompressed geometry.`,
        error
      );
    }

    // Then the loader must process attributes and indices properties of the primitive.
    // If additional attributes are defined in primitive's attributes, but not defined in KHR_draco_mesh_compression's attributes, then the loader must process the additional attributes as usual.
  }

  // Format attributes for pex-context
  const attributes = Object.keys(primitive.attributes).reduce(
    (attributes, name) => {
      const attributeName = PEX_ATTRIBUTE_NAME_MAP[name];
      if (!attributeName)
        console.warn(`glTF Loader: Unknown attribute '${name}'`);

      // https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_draco_mesh_compression/README.md#conformance
      // When loading each accessor, you must ignore the bufferView and byteOffset of the accessor and go to the previously decoded Draco geometry in the primitive to get the data of indices and attributes. A loader must use the decompressed data to fill the accessors or render the decompressed Draco geometry directly (e.g. ThreeJS (non-normative)).
      if (geometryProps[attributeName]) {
        // TODO: does draco loaded data need to be added as _data to accessor?
        return attributes;
      }

      const accessor = getAccessor(
        accessors[primitive.attributes[name]],
        bufferViews
      );

      if (accessor.sparse) {
        attributes[attributeName] = accessor._data;
      } else {
        if (!accessor._bufferView._vertexBuffer) {
          accessor._bufferView._vertexBuffer = ctx.vertexBuffer(
            accessor._bufferView._data
          );
        }
        attributes[attributeName] = {
          count: accessor.count,
          buffer: accessor._bufferView._vertexBuffer,
          offset: accessor.byteOffset,
          data: accessor._bufferView._data,
          type: accessor.componentType,
          stride: accessor._bufferView.byteStride,
          normalized: accessor.normalized,
        };
      }

      return attributes;
    },
    {}
  );

  const positionAccessor = accessors[primitive.attributes.POSITION];
  const indicesAccessor =
    accessors[primitive.indices] &&
    !geometryProps.indices &&
    getAccessor(accessors[primitive.indices], bufferViews);

  // Create geometry
  geometryProps = {
    ...geometryProps,
    ...attributes,
  };

  if (positionAccessor) {
    // TODO: are bounds calculated for targets?
    const scale = positionAccessor.normalized
      ? MESH_QUANTIZATION_SCALE[
          WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[positionAccessor.componentType]
        ]
      : 1;
    geometryProps.bounds = [
      positionAccessor.min.map((v) => v * scale),
      positionAccessor.max.map((v) => v * scale),
    ];
  }

  if (indicesAccessor) {
    if (!indicesAccessor._bufferView._indexBuffer) {
      indicesAccessor._bufferView._indexBuffer = ctx.indexBuffer(
        indicesAccessor._bufferView._data
      );
    }
    geometryProps = {
      ...geometryProps,
      indices: {
        buffer: indicesAccessor._bufferView._indexBuffer,
        offset: indicesAccessor.byteOffset,
        type: indicesAccessor.componentType,
        normalized: indicesAccessor.normalized,
      },
      count: indicesAccessor.count,
    };
  } else if (positionAccessor?._data) {
    geometryProps = {
      ...geometryProps,
      count: positionAccessor.count,
    };
  }

  // https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#primitivemode
  if (primitive.mode) {
    geometryProps = {
      ...geometryProps,
      primitive: primitive.mode,
    };
  }

  return geometryProps;
}

// https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/mesh.schema.json
async function handleMesh({ primitives, weights }, gltf, ctx, options) {
  return await Promise.all(
    primitives.map(async (primitive) => {
      const decodedPrimitive = await handlePrimitive(
        primitive,
        gltf,
        ctx,
        options
      );
      const geometryCmp = components.geometry(decodedPrimitive);
      const materialCmp =
        primitive.material !== undefined
          ? components.material(
              handleMaterial(gltf.materials[primitive.material], gltf, ctx)
            )
          : components.material();

      const entityComponents = {
        geometry: geometryCmp,
        material: materialCmp,
      };

      // Create morph
      if (primitive.targets) {
        let sources = {};
        const targets = primitive.targets.reduce((targets, target) => {
          const targetKeys = Object.keys(target);

          targetKeys.forEach((targetKey) => {
            const targetName = PEX_ATTRIBUTE_NAME_MAP[targetKey] || targetKey;
            targets[targetName] = targets[targetName] || [];

            const accessor = getAccessor(
              gltf.accessors[target[targetKey]],
              gltf.bufferViews
            );

            targets[targetName].push(
              accessor.normalized
                ? normalizeData(accessor._data)
                : accessor._data
            );

            if (!sources[targetName]) {
              if (
                gltf.accessors[primitive.attributes[targetKey]] &&
                gltf.accessors[primitive.attributes[targetKey]]._bufferView
              ) {
                const sourceAccessor = getAccessor(
                  gltf.accessors[primitive.attributes[targetKey]],
                  gltf.bufferViews
                );

                sources[targetName] = sourceAccessor.normalized
                  ? normalizeData(sourceAccessor._data)
                  : sourceAccessor._data;
              } else {
                // Draco
                sources[targetName] = decodedPrimitive[targetName].data;
              }
            }
          });
          return targets;
        }, {});

        entityComponents.morph = components.morph({
          sources,
          targets,
          weights,
        });
      }

      return entityComponents;
    })
  );
}

// eslint-disable-next-line no-unused-vars
const formatLight = ({ type, name, color, ...rest }) => ({
  ...rest,
  color: [...(color || [1, 1, 1]), 1],
});

function getLight(light) {
  if (light._light) return light;

  switch (light.type) {
    case "directional":
      light._light = components.directionalLight(formatLight(light));
      break;
    case "point":
      light._light = components.pointLight(formatLight(light));
      break;
    case "spot":
      light._light = components.spotLight({
        ...formatLight(light),
        innerAngle: light.spot?.innerConeAngle || 0,
        angle: light.spot?.outerConeAngle || Math.PI / 4.0,
      });
      break;

    default:
      throw new Error(`Unexpected light type: ${light.type}`);
  }

  return light;
}

// https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/node.schema.json
async function handleNode(node, gltf, i, ctx, options) {
  const entityComponents = {};
  // const entity = {};

  let transform;

  if (node.matrix) {
    const mn = mat4.create();
    const scale = [
      Math.hypot(node.matrix[0], node.matrix[1], node.matrix[2]),
      Math.hypot(node.matrix[4], node.matrix[5], node.matrix[6]),
      Math.hypot(node.matrix[8], node.matrix[9], node.matrix[10]),
    ];
    for (const col of [0, 1, 2]) {
      mn[col] = node.matrix[col] / scale[0];
      mn[col + 4] = node.matrix[col + 4] / scale[1];
      mn[col + 8] = node.matrix[col + 8] / scale[2];
    }

    transform = {
      position: [node.matrix[12], node.matrix[13], node.matrix[14]],
      rotation: quat.fromMat4(quat.create(), mn),
      scale,
    };
  } else {
    transform = {
      position: node.translation || [0, 0, 0],
      rotation: node.rotation || [0, 0, 0, 1],
      scale: node.scale || [1, 1, 1],
    };
  }

  entityComponents.transform = components.transform(transform);
  // entity.transform = transform;
  // transform.entity = entity;

  if (options.includeCameras && Number.isInteger(node.camera)) {
    const camera = gltf.cameras[node.camera];
    const enabled = options.enabledCameras.includes(node.camera);

    // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.schema.json
    if (camera.type === "orthographic") {
      // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.orthographic.schema.json
      entityComponents.camera = components.camera({
        enabled,
        name: camera.name || `camera_${node.camera}`,
        projection: "orthographic",
        near: camera.orthographic.znear,
        far: camera.orthographic.zfar,
        left: -camera.orthographic.xmag / 2,
        right: camera.orthographic.xmag / 2,
        top: camera.orthographic.ymag / 2,
        bottom: -camera.orthographic.ymag / 2,
      });
    } else {
      // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/camera.perspective.schema.json
      entityComponents.camera = components.camera({
        enabled,
        name: camera.name || `camera_${node.camera}`,
        near: camera.perspective.znear,
        far: camera.perspective.zfar || Infinity,
        fov: camera.perspective.yfov,
        aspect:
          camera.perspective.aspectRatio ||
          ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      });
    }
  }

  // https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_lights_punctual
  if (
    options.includeLights &&
    Number.isInteger(node.extensions?.KHR_lights_punctual?.light)
  ) {
    const light =
      gltf.extensions?.KHR_lights_punctual?.lights[
        node.extensions.KHR_lights_punctual.light
      ];
    if (light) {
      const { _light } = getLight(light);
      entityComponents[`${light.type}Light`] = _light;
    }
  }

  node.entity = entity(entityComponents);
  node.entity.name = node.name || `node_${i}`;

  // node.entity = entity;
  // node.entity.name = node.name || `node_${i}`;

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/skin.schema.json
  let skinCmp = null;
  if (Number.isInteger(node.skin)) {
    const skin = gltf.skins[node.skin];
    const accessor = getAccessor(
      gltf.accessors[skin.inverseBindMatrices],
      gltf.bufferViews
    );

    let inverseBindMatrices = [];
    for (let i = 0; i < accessor._data.length; i += 16) {
      inverseBindMatrices.push(accessor._data.slice(i, i + 16));
    }

    skinCmp = components.skin({
      inverseBindMatrices: inverseBindMatrices,
    });

    // skinCmp = {
    //   inverseBindMatrices,
    // };
  }

  if (Number.isInteger(node.mesh)) {
    const primitives = await handleMesh(
      gltf.meshes[node.mesh],
      gltf,
      ctx,
      options
    );
    let instances = null;

    if (node.extensions) {
      if (node.extensions.EXT_mesh_gpu_instancing) {
        const instancingPrimitive = node.extensions.EXT_mesh_gpu_instancing;
        instances = await handlePrimitive(instancingPrimitive, gltf, ctx);
        Object.keys(instances).forEach((attribName) => {
          instances[attribName].divisor = 1;
        });
        // entity.instanced = true;
        instances.instances = instances.offsets.count;
        const maxInstances = Math.max(maxInstances, instances.instances);

        if (instances.instances != 561) {
          instances = null;
          return null;
        } else {
          console.log(
            node.name,
            "EXT_mesh_gpu_instancing",
            instancingPrimitive,
            instances,
            maxInstances
          );
          instances.offsets.buffer = ctx.vertexBuffer(instances.offsets.data);
          instances.scales.buffer = ctx.vertexBuffer(instances.scales.data);
          instances.rotations.buffer = ctx.vertexBuffer(
            instances.rotations.data
          );
        }
        instances.rotations = null;
      }
    }

    if (primitives.length === 1) {
      Object.assign(node.entity, primitives[0]);
      if (skinCmp) {
        node.entity.skin = skinCmp;
      }

      // const components = primitives[0];
      // Object.assign(entity, components);
      // if (skinCmp) {
      //   // node.entity.skin = skinCmp;
      //   node.entity.addComponent(skinCmp);
      // }
      // if (instances) {
      //   Object.assign(entity.geometry, instances);
      // }
      return node.entity;
    } else {
      // create sub nodes for each primitive
      const primitiveNodes = primitives.map((components, j) => {
        const subEntity = entity(components);
        // const subEntity = {
        //   ...components,
        //   transform: {},
        //   // TODO: add components
        // };
        // subEntity.transform.entity = subEntity;
        subEntity.name = `node_${i}_${j}`;
        subEntity.transform = {
          ...(subEntity.transform || {}),
          parent: node.entity.transform,
        };
        // subEntity.transform.parent = node.entity.transform;

        // TODO: should skin component be shared?
        if (skinCmp) subEntity.skin = skinCmp;
        // if (skinCmp) {
        //   subEntity.skin = skinCmp;
        // }

        return subEntity;
      });
      const nodes = [node.entity].concat(primitiveNodes);

      return nodes;
    }
  }
  return node.entity;
}

function handleAnimation(animation, { accessors, bufferViews, nodes }, index) {
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/animation.schema.json
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/animation.channel.schema.json
  const channels = animation.channels.map((channel) => {
    // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/animation.sampler.schema.json
    const sampler = animation.samplers[channel.sampler];
    const input = getAccessor(accessors[sampler.input], bufferViews);
    const output = getAccessor(accessors[sampler.output], bufferViews);

    // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/animation.channel.target.schema.json
    const target = nodes[channel.target.node].entity;

    const outputData = [];
    let od = output._data;

    if (output.normalized) {
      const scale =
        MESH_QUANTIZATION_SCALE[
          WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[output.componentType]
        ];

      const scaled = new Float32Array(od.length);
      for (let j = 0, jl = od.length; j < jl; j++) {
        scaled[j] = od[j] * scale;
      }
      od = scaled;
    }

    let offset = GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER[output.type];
    if (channel.target.path === "weights") {
      offset = target.morph.weights.length;
    }
    for (let i = 0; i < od.length; i += offset) {
      if (offset === 1) {
        outputData.push([od[i]]);
      }
      if (offset === 2) {
        outputData.push([od[i], od[i + 1]]);
      }
      if (offset === 3) {
        outputData.push([od[i], od[i + 1], od[i + 2]]);
      }
      if (offset === 4) {
        outputData.push([od[i], od[i + 1], od[i + 2], od[i + 3]]);
      }
    }

    return {
      input: input._data,
      output: outputData,
      interpolation: sampler.interpolation,
      target,
      path: channel.target.path,
    };
  });

  // return components.animation({
  //   channels: channels,
  //   autoplay: true,
  //   loop: true,
  // });

  const duration = channels.reduce(
    (duration, { input }) => Math.max(duration, input[input.length - 1]),
    0
  );

  return components.animation({
    name: animation.name || `Animation ${index}`,
    channels,
    duration,
    autoplay: true,
    loop: true,
  });
}

// LOADER
// =============================================================================
function uint8ArrayToArrayBuffer({ buffer, byteOffset, byteLength }) {
  return buffer.slice(byteOffset, byteLength + byteOffset);
}

class BinaryReader {
  constructor(arrayBuffer) {
    this._arrayBuffer = arrayBuffer;
    this._dataView = new DataView(arrayBuffer);
    this._byteOffset = 0;
  }

  getPosition() {
    return this._byteOffset;
  }

  getLength() {
    return this._arrayBuffer.byteLength;
  }

  readUint32() {
    const value = this._dataView.getUint32(this._byteOffset, true);
    this._byteOffset += 4;
    return value;
  }

  readUint8Array(length) {
    const value = new Uint8Array(this._arrayBuffer, this._byteOffset, length);
    this._byteOffset += length;
    return value;
  }

  skipBytes(length) {
    this._byteOffset += length;
  }
}

function unpackBinary(data) {
  const binaryReader = new BinaryReader(data);

  // Check header
  // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#header
  // uint32 magic
  // uint32 version
  // uint32 length
  const magic = binaryReader.readUint32();
  if (magic !== MAGIC) throw new Error(`Unexpected magic: ${magic}`);

  const version = binaryReader.readUint32();
  if (version !== 2) throw new Error(`Unsupported version: ${version} `);

  const length = binaryReader.readUint32();
  if (length !== binaryReader.getLength()) {
    throw new Error(
      `Length in header does not match actual data length: ${length} != ${binaryReader.getLength()}`
    );
  }

  // Decode chunks
  // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#chunks
  // uint32 chunkLength
  // uint32 chunkType
  // ubyte[] chunkData

  // JSON
  const chunkLength = binaryReader.readUint32();
  const chunkType = binaryReader.readUint32();
  if (chunkType !== CHUNK_TYPE.JSON)
    throw new Error("First chunk format is not JSON");

  // Decode Buffer to Text
  const buffer = binaryReader.readUint8Array(chunkLength);

  let json;
  if (typeof TextDecoder !== "undefined") {
    json = new TextDecoder().decode(buffer);
  } else {
    let result = "";
    const length = buffer.byteLength;

    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(buffer[i]);
    }
    json = result;
  }

  // BIN
  let bin = null;
  while (binaryReader.getPosition() < binaryReader.getLength()) {
    const chunkLength = binaryReader.readUint32();
    const chunkType = binaryReader.readUint32();

    switch (chunkType) {
      case CHUNK_TYPE.JSON: {
        throw new Error("Unexpected JSON chunk");
      }
      case CHUNK_TYPE.BIN: {
        bin = binaryReader.readUint8Array(chunkLength);
        break;
      }
      default: {
        binaryReader.skipBytes(chunkLength);
        break;
      }
    }
  }

  return {
    json,
    bin,
  };
}

function loadData(data) {
  if (data instanceof ArrayBuffer) {
    const unpacked = unpackBinary(data);

    return {
      json: JSON.parse(unpacked.json),
      bin: uint8ArrayToArrayBuffer(unpacked.bin),
    };
  }

  return { json: data };
}

function isBase64(uri) {
  return uri.length < 5 ? false : uri.substr(0, 5) === "data:";
}

function decodeBase64(uri) {
  const decodedString = atob(uri.split(",")[1]);
  const bufferLength = decodedString.length;
  const bufferView = new Uint8Array(new ArrayBuffer(bufferLength));

  for (let i = 0; i < bufferLength; i++) {
    bufferView[i] = decodedString.charCodeAt(i);
  }

  return bufferView.buffer;
}

const DEFAULT_OPTIONS = {
  enabledCameras: [0],
  enabledScene: undefined,
  includeCameras: false,
  includeLights: false,
  dracoOptions: {},
  basisOptions: {},
  supportImageBitmap: !isSafari,
};

async function loadGltf(url, options = {}) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options);
  const { ctx } = options;

  console.debug("loaders.gltf", url, options, opts);

  // Load and unpack data
  // https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification
  const extension = getFileExtension(url);
  const basePath = getDirname(url);
  const isBinary = extension === "glb";

  console.debug("loaders.gltf", url, extension, isBinary);
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/glTF.schema.json
  const { json, bin } = loadData(
    isBinary ? await loadArrayBuffer(url) : await loadJson(url)
  );

  console.debug("loaders.gltf", json, bin);

  // Check required extensions
  // https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#specifying-extensions
  if (json.extensionsRequired) {
    const unsupportedExtensions = json.extensionsRequired.filter(
      (extension) => !SUPPORTED_EXTENSIONS.includes(extension)
    );
    if (unsupportedExtensions.length) {
      console.warn(
        "glTF loader: unsupported extensions",
        unsupportedExtensions
      );
    }
  }

  // Check asset version
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/asset.schema.json
  const version = parseInt(json.asset.version);
  if (!version || version < 2) {
    console.warn(
      `glTF Loader: Invalid or unsupported version: ${json.asset.version}`
    );
  }

  // Data setup
  // https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#binary-data-storage

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/buffer.schema.json
  await Promise.all(
    json.buffers.map(async (buffer) => {
      if (isBinary) {
        buffer._data = bin;
      } else {
        if (isBase64(buffer.uri)) {
          buffer._data = decodeBase64(buffer.uri);
        } else {
          buffer._data = await loadArrayBuffer(
            [basePath, buffer.uri].join("/")
          );
        }
      }
    })
  );

  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/bufferView.schema.json
  for (let bufferView of json.bufferViews) {
    const bufferData = json.buffers[bufferView.buffer]._data;
    if (bufferView.byteOffset === undefined) bufferView.byteOffset = 0;

    bufferView._data = bufferData.slice(
      bufferView.byteOffset,
      bufferView.byteOffset + bufferView.byteLength
    );

    // Set buffer if target is present
    // https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#bufferviewtarget
    if (bufferView.target === WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER) {
      bufferView._indexBuffer = ctx.indexBuffer(bufferView._data);
    } else if (bufferView.target === WEBGL_CONSTANTS.ARRAY_BUFFER) {
      bufferView._vertexBuffer = ctx.vertexBuffer(bufferView._data);
    }
  }

  // Load images
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/image.schema.json
  // TODO: images should only be loaded as needed by texture to handle fallbacks and prevent extra loading
  if (json.images) {
    await Promise.all(
      json.images.map(async (image) => {
        // https://www.khronos.org/registry/glTF/specs/2.0/glTF-2.0.html#uris
        if (isBinary || image.bufferView) {
          const bufferView = json.bufferViews[image.bufferView];
          bufferView.byteOffset = bufferView.byteOffset || 0;
          const buffer = json.buffers[bufferView.buffer];
          const data = buffer._data.slice(
            bufferView.byteOffset,
            bufferView.byteOffset + bufferView.byteLength
          );
          if (image.mimeType === "image/ktx2") {
            image._img = await loadKtx2(data, ctx.gl, {
              basisOptions: opts.basisOptions,
            });
          } else {
            const blob = new Blob([data], { type: image.mimeType });
            image._img = await loadImage({
              url: URL.createObjectURL(blob),
              crossOrigin: "anonymous",
            });
          }
        } else if (isBase64(image.uri)) {
          image._img = await loadImage({
            url: image.uri,
            crossOrigin: "anonymous",
          });
        } else {
          const url = decodeURIComponent([basePath, image.uri].join("/"));
          if (image.uri.endsWith(".ktx2")) {
            image._img = await loadKtx2(url, ctx.gl, {
              basisOptions: opts.basisOptions,
            });
          } else {
            image._img = opts.supportImageBitmap
              ? await loadImageBitmap(await loadBlob(url, { mode: "cors" }))
              : await loadImage({ url, crossOrigin: "anonymous" });
          }
        }
      })
    );
  }

  const transformSystem = systems.transform();

  // Load scene
  // https://github.com/KhronosGroup/glTF/blob/main/specification/2.0/schema/scene.schema.json
  let scenes = await Promise.all(
    (json.scenes || [{}]).map(async (scene, index) => {
      // Create scene root entity
      scene.root = entity({
        transform: components.transform({
          enabled: opts.enabledScene || index === (json.scene || 0),
        }),
      });
      scene.root.name = scene.name || `scene_${index}`;

      // Add scene entities for each node and its children
      // TODO: scene.entities is just convenience. We could use a user-friendly entity traverse.
      // scene.entities = json.nodes.reduce(async (entities, node, i) => {
      //   const result = await handleNode(node, json, i, ctx, opts);
      //   if (result.length) {
      //     result.forEach((primitive) => entities.push(primitive));
      //   } else {
      //     entities.push(result);
      //   }
      //   return entities;
      // }, []);
      scene.entities = await Promise.all(
        json.nodes.map(
          async (node, i) => await handleNode(node, json, i, ctx, opts)
        )
      );
      scene.entities = scene.entities.flat();
      scene.entities.unshift(scene.root);

      // Build pex-renderer hierarchy
      json.nodes.forEach(({ children }, index) => {
        const parentNode = json.nodes[index];
        const parentTransform = parentNode.entity.transform;

        // Default to scene root
        if (!parentNode.entity.transform.parent) {
          parentNode.entity.transform.parent = scene.root.transform;
        }

        if (children) {
          children.forEach((childIndex) => {
            const child = json.nodes[childIndex];
            const childTransform = child.entity.transform;

            childTransform.parent = parentTransform;
          });
        }
      });

      json.nodes.forEach((node) => {
        if (node.skin !== undefined) {
          const skin = json.skins[node.skin];
          const joints = skin.joints.map((i) => json.nodes[i].entity);

          if (json.meshes[node.mesh].primitives.length === 1) {
            node.entity.skin.joints = joints;
          } else {
            // TODO: implement joints
            // node.entity.transform.children.forEach(({ entity }) => {
            // FIXME: currently we share the same Skin component
            // so this code is redundant after first child
            // entity.skin.joints = joints;
            // });
          }
        }
      });

      if (json.animations && options.includeAnimations !== false) {
        scene.root.animations = [];
        json.animations.forEach((animation, index) => {
          const animationComponent = handleAnimation(animation, json, index);
          // TODO: is it really needed? Animation systems checks for animations
          if (index == 0) {
            scene.root.animation = animationComponent;
          }
          scene.root.animations.push(animationComponent);
        });
      }

      //prep skins
      json.nodes.forEach((node) => {
        if (node.skin !== undefined) {
          const skin = json.skins[node.skin];
          const joints = skin.joints.map((i) => json.nodes[i].entity);

          if (json.meshes[node.mesh].primitives.length === 1) {
            // node.entity.getComponent("Skin").set({
            //   joints: joints,
            // });
            node.entity.skin.joints = joints;
            node.entity.skin.jointMatrices = joints.map(() => mat4.create());
          } else {
            scene.entities
              .filter((e) => {
                return e.transform.parent == node.entity.transform;
              })
              .forEach((childEntity) => {
                childEntity.skin.joints = joints;
                childEntity.skin.jointMatrices = joints.map(() =>
                  mat4.create()
                );
              });
          }
        }
      });

      // Assuming all entities have transform and loaded geometry have bounds
      // https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#accessors-bounds
      // Animation input and vertex position attribute accessors MUST have accessor.min and accessor.max defined
      transformSystem.sort(scene.entities);
      transformSystem.update(scene.entities);

      return scene;
    })
  );
  transformSystem.dispose();

  return scenes;
}

export default loadGltf;
