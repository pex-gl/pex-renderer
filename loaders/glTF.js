const path = require('path')
const { loadJSON, loadImage, loadBinary } = require('pex-io')
const { quat, mat4, utils } = require('pex-math')

// Constants
// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#specifying-extensions
const SUPPORTED_EXTENSIONS = [
  'KHR_materials_unlit',
  'KHR_materials_pbrSpecularGlossiness',
  'KHR_texture_transform'
]

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
  FLOAT: 5126 // 0x1406
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays#Typed_array_views
const WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES = {
  [WEBGL_CONSTANTS.BYTE]: Int8Array,
  [WEBGL_CONSTANTS.UNSIGNED_BYTE]: Uint8Array,
  [WEBGL_CONSTANTS.SHORT]: Int16Array,
  [WEBGL_CONSTANTS.UNSIGNED_SHORT]: Uint16Array,
  [WEBGL_CONSTANTS.UNSIGNED_INT]: Uint32Array,
  [WEBGL_CONSTANTS.FLOAT]: Float32Array
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessor-element-size
const GLTF_ACCESSOR_COMPONENT_TYPE_SIZE = {
  [WEBGL_CONSTANTS.BYTE]: 1,
  [WEBGL_CONSTANTS.UNSIGNED_BYTE]: 1,
  [WEBGL_CONSTANTS.SHORT]: 2,
  [WEBGL_CONSTANTS.UNSIGNED_SHORT]: 2,
  [WEBGL_CONSTANTS.UNSIGNED_INT]: 4,
  [WEBGL_CONSTANTS.FLOAT]: 4
}

const GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#header
const MAGIC = 0x46546c67 // glTF

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#chunks
const CHUNK_TYPE = {
  JSON: 0x4e4f534a,
  BIN: 0x004e4942
}

const PEX_ATTRIBUTE_NAME_MAP = {
  POSITION: 'positions',
  NORMAL: 'normals',
  TANGENT: 'tangents',
  TEXCOORD_0: 'texCoords',
  TEXCOORD_1: 'texCoords1',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights',
  COLOR_0: 'vertexColors'
}

// Build
// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/accessor.schema.json
function getAccessor(accessor, bufferViews) {
  if (accessor._data) return accessor

  const numberOfComponents = GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER[accessor.type]
  if (accessor.byteOffset === undefined) accessor.byteOffset = 0

  accessor._bufferView = bufferViews[accessor.bufferView]

  const TypedArrayConstructor =
    WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[accessor.componentType]
  const byteSize = GLTF_ACCESSOR_COMPONENT_TYPE_SIZE[accessor.componentType]

  const data = new TypedArrayConstructor(
    accessor._bufferView._data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * numberOfComponents * byteSize
    )
  )
  accessor._data = data

  // Sparse accessors
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/accessor.sparse.schema.json
  if (accessor.sparse !== undefined) {
    const TypedArrayIndicesConstructor =
      WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[
        accessor.sparse.indices.componentType
      ]

    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/accessor.sparse.indices.schema.json
    const sparseIndices = new TypedArrayIndicesConstructor(
      bufferViews[accessor.sparse.indices.bufferView]._data,
      accessor.sparse.indices.byteOffset || 0,
      accessor.sparse.count
    )

    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/accessor.sparse.values.schema.json
    const sparseValues = new TypedArrayConstructor(
      bufferViews[accessor.sparse.values.bufferView]._data,
      accessor.sparse.values.byteOffset || 0,
      accessor.sparse.count * numberOfComponents
    )

    if (accessor._data !== null) {
      accessor._data = accessor._data.slice()
    }

    let valuesIndex = 0
    for (
      let indicesIndex = 0;
      indicesIndex < sparseIndices.length;
      indicesIndex++
    ) {
      let dataIndex = sparseIndices[indicesIndex] * numberOfComponents
      for (
        let componentIndex = 0;
        componentIndex < numberOfComponents;
        componentIndex++
      ) {
        accessor._data[dataIndex++] = sparseValues[valuesIndex++]
      }
    }
  }

  return accessor
}

function getPexMaterialTexture(materialTexture, gltf, ctx, encoding) {
  // Retrieve glTF root object properties
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/texture.schema.json
  const texture = gltf.textures[materialTexture.index]

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/image.schema.json
  const image = gltf.images[texture.source]

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/sampler.schema.json
  const sampler =
    gltf.samplers && gltf.samplers[texture.sampler]
      ? gltf.samplers[texture.sampler]
      : {}

  sampler.minFilter = sampler.minFilter || ctx.Filter.LinearMipmapLinear
  sampler.magFilter = sampler.magFilter || ctx.Filter.Linear
  sampler.wrapS = sampler.wrapS || ctx.Wrap.Repeat
  sampler.wrapT = sampler.wrapT || ctx.Wrap.Repeat

  const hasMipMap =
    sampler.minFilter !== ctx.Filter.Nearest &&
    sampler.minFilter !== ctx.Filter.Linear

  if (!texture._tex) {
    let img = image._img

    if (!utils.isPowerOfTwo(img.width) || !utils.isPowerOfTwo(img.height)) {
      // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#samplers
      if (
        sampler.wrapS !== ctx.Wrap.Clamp ||
        sampler.wrapT !== ctx.Wrap.Clamp ||
        hasMipMap
      ) {
        const canvas2d = document.createElement('canvas')
        canvas2d.width = utils.nextPowerOfTwo(img.width)
        canvas2d.height = utils.nextPowerOfTwo(img.height)
        const ctx2d = canvas2d.getContext('2d')
        ctx2d.drawImage(img, 0, 0, canvas2d.width, canvas2d.height)
        img = canvas2d
      }
    }
    texture._tex = ctx.texture2D({
      data: img,
      width: img.width,
      height: img.height,
      encoding: encoding || ctx.Encoding.Linear,
      pixelFormat: ctx.PixelFormat.RGBA8,
      wrapS: sampler.wrapS,
      wrapT: sampler.wrapT,
      min: sampler.minFilter,
      mag: sampler.magFilter
    })
    if (hasMipMap) ctx.update(texture._tex, { mipmap: true, aniso: 16 })
  }

  // https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_texture_transform/schema/KHR_texture_transform.textureInfo.schema.json
  const textureTransform =
    materialTexture.extensions &&
    materialTexture.extensions.KHR_texture_transform

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/textureInfo.schema.json
  const texCoord = materialTexture.texCoord

  return !texCoord && !textureTransform
    ? texture._tex
    : {
        texture: texture._tex,
        // textureInfo
        texCoord: texCoord || 0,
        // textureTransform.texCoord: Overrides the textureInfo texCoord value if supplied.
        ...(textureTransform || {})
      }
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/material.schema.json
function handleMaterial(material, gltf, ctx) {
  let materialProps = {
    baseColor: [1, 1, 1, 1],
    roughness: 1,
    metallic: 1,
    castShadows: true,
    receiveShadows: true,
    cullFace: !material.doubleSided
  }

  //  Metallic/Roughness workflow
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/material.pbrMetallicRoughness.schema.json
  const pbrMetallicRoughness = material.pbrMetallicRoughness
  if (pbrMetallicRoughness) {
    materialProps = {
      ...materialProps,
      baseColor: [1, 1, 1, 1],
      roughness: 1,
      metallic: 1
    }
    if (pbrMetallicRoughness.baseColorFactor) {
      materialProps.baseColor = pbrMetallicRoughness.baseColorFactor
    }
    if (pbrMetallicRoughness.baseColorTexture) {
      materialProps.baseColorMap = getPexMaterialTexture(
        pbrMetallicRoughness.baseColorTexture,
        gltf,
        ctx,
        ctx.Encoding.SRGB
      )
    }
    if (pbrMetallicRoughness.metallicFactor) {
      materialProps.metallic = pbrMetallicRoughness.metallicFactor
    }
    if (pbrMetallicRoughness.roughnessFactor) {
      materialProps.roughness = pbrMetallicRoughness.roughnessFactor
    }
    if (pbrMetallicRoughness.metallicRoughnessTexture) {
      materialProps.metallicRoughnessMap = getPexMaterialTexture(
        pbrMetallicRoughness.metallicRoughnessTexture,
        gltf,
        ctx
      )
    }
  }

  // Specular/Glossiness workflow
  // https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness/schema/glTF.KHR_materials_pbrSpecularGlossiness.schema.json
  const pbrSpecularGlossiness = material.extensions
    ? material.extensions.KHR_materials_pbrSpecularGlossiness
    : null
  if (pbrSpecularGlossiness) {
    materialProps = {
      ...materialProps,
      useSpecularGlossinessWorkflow: true,
      diffuse: [1, 1, 1, 1],
      specular: [1, 1, 1],
      glossiness: 1
    }
    if (pbrSpecularGlossiness.diffuseFactor) {
      materialProps.diffuse = pbrSpecularGlossiness.diffuseFactor
    }
    if (pbrSpecularGlossiness.specularFactor) {
      materialProps.specular = pbrSpecularGlossiness.specularFactor
    }
    if (pbrSpecularGlossiness.glossinessFactor) {
      materialProps.glossiness = pbrSpecularGlossiness.glossinessFactor
    }
    if (pbrSpecularGlossiness.diffuseTexture) {
      materialProps.diffuseMap = getPexMaterialTexture(
        pbrSpecularGlossiness.diffuseTexture,
        gltf,
        ctx,
        ctx.Encoding.SRGB
      )
    }
    if (pbrSpecularGlossiness.specularGlossinessTexture) {
      materialProps.specularGlossinessMap = getPexMaterialTexture(
        pbrSpecularGlossiness.specularGlossinessTexture,
        gltf,
        ctx,
        ctx.Encoding.SRGB
      )
    }
  }

  // Additional Maps
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/material.normalTextureInfo.schema.json
  if (material.normalTexture) {
    materialProps.normalMap = getPexMaterialTexture(
      material.normalTexture,
      gltf,
      ctx
    )
  }

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/material.occlusionTextureInfo.schema.json
  if (material.occlusionTexture) {
    materialProps.occlusionMap = getPexMaterialTexture(
      material.occlusionTexture,
      gltf,
      ctx
    )
  }

  if (material.emissiveTexture) {
    materialProps.emissiveColorMap = getPexMaterialTexture(
      material.emissiveTexture,
      gltf,
      ctx,
      ctx.Encoding.SRGB
    )
  }

  if (material.emissiveFactor) {
    materialProps = {
      ...materialProps,
      emissiveColor: [
        material.emissiveFactor[0],
        material.emissiveFactor[1],
        material.emissiveFactor[2],
        1
      ]
    }
  }

  // Alpha Coverage
  if (material.alphaMode === 'BLEND') {
    materialProps = {
      ...materialProps,
      depthWrite: false,
      blend: true,
      blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
      blendSrcAlphaFactor: ctx.BlendFactor.One,
      blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
      blendDstAlphaFactor: ctx.BlendFactor.One
    }
  }
  if (material.alphaMode === 'MASK') {
    materialProps.alphaTest = material.alphaCutoff || 0.5
  }

  // KHR_materials_unlit
  if (material.extensions && material.extensions.KHR_materials_unlit) {
    materialProps = {
      ...materialProps,
      unlit: true
    }
  }

  return materialProps
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/mesh.primitive.schema.json
function handlePrimitive(primitive, gltf, ctx) {
  let geometryProps = {}

  // Format attributes for pex-context
  const attributes = Object.keys(primitive.attributes).reduce(
    (attributes, name) => {
      const attributeName = PEX_ATTRIBUTE_NAME_MAP[name]
      if (!attributeName)
        console.warn(`glTF Loader: Unknown attribute '${name}'`)

      const accessor = getAccessor(
        gltf.accessors[primitive.attributes[name]],
        gltf.bufferViews
      )

      if (accessor.sparse) {
        attributes[attributeName] = accessor._data
      } else {
        if (!accessor._bufferView._vertexBuffer) {
          accessor._bufferView._vertexBuffer = ctx.vertexBuffer(
            accessor._bufferView._data
          )
        }
        attributes[attributeName] = {
          buffer: accessor._bufferView._vertexBuffer,
          offset: accessor.byteOffset,
          type: accessor.componentType,
          stride: accessor._bufferView.byteStride
        }
      }

      return attributes
    },
    {}
  )

  const positionAccessor = gltf.accessors[primitive.attributes.POSITION]
  const indicesAccessor =
    gltf.accessors[primitive.indices] &&
    getAccessor(gltf.accessors[primitive.indices], gltf.bufferViews)

  // Create geometry
  geometryProps = {
    ...geometryProps,
    ...attributes,
    bounds: [positionAccessor.min, positionAccessor.max]
  }

  if (indicesAccessor) {
    if (!indicesAccessor._bufferView._indexBuffer) {
      indicesAccessor._bufferView._indexBuffer = ctx.indexBuffer(
        indicesAccessor._bufferView._data
      )
    }
    geometryProps = {
      ...geometryProps,
      indices: {
        buffer: indicesAccessor._bufferView._indexBuffer,
        offset: indicesAccessor.byteOffset,
        type: indicesAccessor.componentType,
        count: indicesAccessor.count
      }
    }
  } else {
    geometryProps = {
      ...geometryProps,
      count: positionAccessor._data.length / 3
    }
  }

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#primitivemode
  if (primitive.mode) {
    geometryProps = {
      ...geometryProps,
      primitive: primitive.mode
    }
  }

  return geometryProps
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/mesh.schema.json
function handleMesh(mesh, gltf, ctx, renderer) {
  return mesh.primitives.map((primitive) => {
    const geometryCmp = renderer.geometry(
      handlePrimitive(primitive, gltf, ctx, renderer)
    )
    const materialCmp =
      primitive.material !== undefined
        ? renderer.material(
            handleMaterial(
              gltf.materials[primitive.material],
              gltf,
              ctx,
              renderer
            )
          )
        : renderer.material()

    const components = [geometryCmp, materialCmp]

    // Create morph
    if (primitive.targets) {
      let sources = {}
      const targets = primitive.targets.reduce((targets, target) => {
        const targetKeys = Object.keys(target)

        targetKeys.forEach((targetKey) => {
          const targetName = PEX_ATTRIBUTE_NAME_MAP[targetKey] || targetKey
          targets[targetName] = targets[targetName] || []

          const accessor = getAccessor(
            gltf.accessors[target[targetKey]],
            gltf.bufferViews
          )

          targets[targetName].push(accessor._data)

          if (!sources[targetName]) {
            const sourceAccessor = getAccessor(
              gltf.accessors[primitive.attributes[targetKey]],
              gltf.bufferViews
            )
            sources[targetName] = sourceAccessor._data
          }
        })
        return targets
      }, {})

      const morphCmp = renderer.morph({
        sources,
        targets,
        weights: mesh.weights
      })
      components.push(morphCmp)
    }

    return components
  })
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/node.schema.json
function handleNode(node, gltf, i, ctx, renderer, options) {
  const components = []

  let transform

  if (node.matrix) {
    const mn = mat4.create()
    const scale = [
      Math.hypot(node.matrix[0], node.matrix[1], node.matrix[2]),
      Math.hypot(node.matrix[4], node.matrix[5], node.matrix[6]),
      Math.hypot(node.matrix[8], node.matrix[9], node.matrix[10])
    ]
    for (const col of [0, 1, 2]) {
      mn[col] = node.matrix[col] / scale[0]
      mn[col + 4] = node.matrix[col + 4] / scale[1]
      mn[col + 8] = node.matrix[col + 8] / scale[2]
    }

    transform = {
      position: [node.matrix[12], node.matrix[13], node.matrix[14]],
      rotation: quat.fromMat4(quat.create(), mn),
      scale
    }
  } else {
    transform = {
      position: node.translation || [0, 0, 0],
      rotation: node.rotation || [0, 0, 0, 1],
      scale: node.scale || [1, 1, 1]
    }
  }

  components.push(renderer.transform(transform))

  if (options.includeCameras && Number.isInteger(node.camera)) {
    const camera = gltf.cameras[node.camera]
    const enabled = options.enabledCameras.includes(node.camera)

    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/camera.schema.json
    if (camera.type === 'orthographic') {
      // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/camera.orthographic.schema.json
      components.push(
        renderer.camera({
          enabled,
          name: camera.name || `camera_${node.camera}`,
          projection: 'orthographic',
          near: camera.orthographic.znear,
          far: camera.orthographic.zfar,
          left: -camera.orthographic.xmag / 2,
          right: camera.orthographic.xmag / 2,
          top: camera.orthographic.ymag / 2,
          bottom: camera.orthographic.ymag / 2
        })
      )
    } else {
      // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/camera.perspective.schema.json
      components.push(
        renderer.camera({
          enabled,
          name: camera.name || `camera_${node.camera}`,
          near: camera.perspective.znear,
          far: camera.perspective.zfar || Infinity,
          fov: camera.perspective.yfov,
          aspect:
            camera.perspective.aspectRatio ||
            ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
        })
      )
    }
  }

  node.entity = renderer.entity(components)
  node.entity.name = node.name || `node_${i}`

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/skin.schema.json
  let skinCmp = null
  if (Number.isInteger(node.skin)) {
    const skin = gltf.skins[node.skin]
    const accessor = getAccessor(
      gltf.accessors[skin.inverseBindMatrices],
      gltf.bufferViews
    )

    let inverseBindMatrices = []
    for (let i = 0; i < accessor._data.length; i += 16) {
      inverseBindMatrices.push(accessor._data.slice(i, i + 16))
    }

    skinCmp = renderer.skin({
      inverseBindMatrices: inverseBindMatrices
    })
  }

  if (Number.isInteger(node.mesh)) {
    const primitives = handleMesh(gltf.meshes[node.mesh], gltf, ctx, renderer)

    if (primitives.length === 1) {
      primitives[0].forEach((component) => {
        node.entity.addComponent(component)
      })
      if (skinCmp) node.entity.addComponent(skinCmp)
      return node.entity
    } else {
      // create sub nodes for each primitive
      const primitiveNodes = primitives.map((components, j) => {
        const subEntity = renderer.entity(components)
        subEntity.name = `node_${i}_${j}`
        subEntity.transform.set({ parent: node.entity.transform })

        // TODO: should skin component be shared?
        if (skinCmp) subEntity.addComponent(skinCmp)
        return subEntity
      })
      const nodes = [node.entity].concat(primitiveNodes)

      return nodes
    }
  }
  return node.entity
}

function handleAnimation(animation, gltf, renderer) {
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/animation.schema.json
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/animation.channel.schema.json
  const channels = animation.channels.map((channel) => {
    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/animation.sampler.schema.json
    const sampler = animation.samplers[channel.sampler]
    const input = getAccessor(gltf.accessors[sampler.input], gltf.bufferViews)
    const output = getAccessor(gltf.accessors[sampler.output], gltf.bufferViews)

    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/animation.channel.target.schema.json
    const target = gltf.nodes[channel.target.node].entity

    const outputData = []
    const od = output._data
    let offset = GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER[output.type]
    if (channel.target.path === 'weights') {
      offset = target.getComponent('Morph').weights.length
    }
    for (let i = 0; i < od.length; i += offset) {
      if (offset === 1) {
        outputData.push([od[i]])
      }
      if (offset === 2) {
        outputData.push([od[i], od[i + 1]])
      }
      if (offset === 3) {
        outputData.push([od[i], od[i + 1], od[i + 2]])
      }
      if (offset === 4) {
        outputData.push([od[i], od[i + 1], od[i + 2], od[i + 3]])
      }
    }

    return {
      input: input._data,
      output: outputData,
      interpolation: sampler.interpolation,
      target: target,
      path: channel.target.path
    }
  })

  return renderer.animation({
    channels: channels,
    autoplay: true,
    loop: true
  })
}

// LOADER
// =============================================================================
function uint8ArrayToArrayBuffer(arr) {
  return arr.buffer.slice(arr.byteOffset, arr.byteLength + arr.byteOffset)
}

class BinaryReader {
  constructor(arrayBuffer) {
    this._arrayBuffer = arrayBuffer
    this._dataView = new DataView(arrayBuffer)
    this._byteOffset = 0
  }

  getPosition() {
    return this._byteOffset
  }

  getLength() {
    return this._arrayBuffer.byteLength
  }

  readUint32() {
    const value = this._dataView.getUint32(this._byteOffset, true)
    this._byteOffset += 4
    return value
  }

  readUint8Array(length) {
    const value = new Uint8Array(this._arrayBuffer, this._byteOffset, length)
    this._byteOffset += length
    return value
  }

  skipBytes(length) {
    this._byteOffset += length
  }
}

function unpackBinary(data) {
  const binaryReader = new BinaryReader(data)

  // Check header
  // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#header
  // uint32 magic
  // uint32 version
  // uint32 length
  const magic = binaryReader.readUint32()
  if (magic !== MAGIC) throw new Error(`Unexpected magic: ${magic}`)

  const version = binaryReader.readUint32()
  if (version !== 2) throw new Error(`Unsupported version: ${version} `)

  const length = binaryReader.readUint32()
  if (length !== binaryReader.getLength()) {
    throw new Error(
      `Length in header does not match actual data length: ${length} != ${binaryReader.getLength()}`
    )
  }

  // Decode chunks
  // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#chunks
  // uint32 chunkLength
  // uint32 chunkType
  // ubyte[] chunkData

  // JSON
  const chunkLength = binaryReader.readUint32()
  const chunkType = binaryReader.readUint32()
  if (chunkType !== CHUNK_TYPE.JSON)
    throw new Error('First chunk format is not JSON')

  // Decode Buffer to Text
  const buffer = binaryReader.readUint8Array(chunkLength)

  let json
  if (typeof TextDecoder !== 'undefined') {
    json = new TextDecoder().decode(buffer)
  } else {
    let result = ''
    const length = buffer.byteLength

    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(buffer[i])
    }
    json = result
  }

  // BIN
  let bin = null
  while (binaryReader.getPosition() < binaryReader.getLength()) {
    const chunkLength = binaryReader.readUint32()
    const chunkType = binaryReader.readUint32()

    switch (chunkType) {
      case CHUNK_TYPE.JSON: {
        throw new Error('Unexpected JSON chunk')
      }
      case CHUNK_TYPE.BIN: {
        bin = binaryReader.readUint8Array(chunkLength)
        break
      }
      default: {
        binaryReader.skipBytes(chunkLength)
        break
      }
    }
  }

  return {
    json: json,
    bin: bin
  }
}

function loadData(data) {
  if (data instanceof ArrayBuffer) {
    const unpacked = unpackBinary(data)

    return {
      json: JSON.parse(unpacked.json),
      bin: uint8ArrayToArrayBuffer(unpacked.bin)
    }
  }

  return { json: data }
}

function isBase64(uri) {
  return uri.length < 5 ? false : uri.substr(0, 5) === 'data:'
}

function decodeBase64(uri) {
  const decodedString = atob(uri.split(',')[1])
  const bufferLength = decodedString.length
  const bufferView = new Uint8Array(new ArrayBuffer(bufferLength))

  for (let i = 0; i < bufferLength; i++) {
    bufferView[i] = decodedString.charCodeAt(i)
  }

  return bufferView.buffer
}

const DEFAULT_OPTIONS = {
  enabledCameras: [0],
  enabledScene: undefined,
  includeCameras: false,
  includeLights: false
}

async function loadGltf(url, renderer, options = {}) {
  const opts = Object.assign({}, DEFAULT_OPTIONS, options)
  const ctx = renderer._ctx

  // Load and unpack data
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#glb-file-format-specification
  const extension = path.extname(url)
  const basePath = path.dirname(url)
  const isBinary = extension === '.glb'

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/glTF.schema.json
  const { json, bin } = loadData(
    isBinary ? await loadBinary(url) : await loadJSON(url)
  )

  // Check required extensions
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#specifying-extensions
  if (json.extensionsRequired) {
    const unsupportedExtensions = json.extensionsRequired.filter(
      (extension) => !SUPPORTED_EXTENSIONS.includes(extension)
    )
    if (unsupportedExtensions.length) {
      console.warn('glTF loader: unsupported extensions', unsupportedExtensions)
    }
  }

  // Check asset version
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/asset.schema.json
  const version = parseInt(json.asset.version)
  if (!version || version < 2) {
    console.warn(
      `glTF Loader: Invalid or unsupported version: ${json.asset.version}`
    )
  }

  // Data setup
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#binary-data-storage

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/buffer.schema.json
  for (let buffer of json.buffers) {
    if (isBinary) {
      buffer._data = bin
    } else {
      if (isBase64(buffer.uri)) {
        buffer._data = decodeBase64(buffer.uri)
      } else {
        buffer._data = await loadBinary(path.join(basePath, buffer.uri))
      }
    }
  }

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/bufferView.schema.json
  for (let bufferView of json.bufferViews) {
    const bufferData = json.buffers[bufferView.buffer]._data
    if (bufferView.byteOffset === undefined) bufferView.byteOffset = 0

    bufferView._data = bufferData.slice(
      bufferView.byteOffset,
      bufferView.byteOffset + bufferView.byteLength
    )

    // Set buffer if target is present
    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#bufferviewtarget
    if (bufferView.target === WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER) {
      bufferView._indexBuffer = ctx.indexBuffer(bufferView._data)
    } else if (bufferView.target === WEBGL_CONSTANTS.ARRAY_BUFFER) {
      bufferView._vertexBuffer = ctx.vertexBuffer(bufferView._data)
    }
  }

  // Load images
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/image.schema.json
  if (json.images) {
    for (let image of json.images) {
      // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#uris
      if (isBinary) {
        const bufferView = json.bufferViews[image.bufferView]
        bufferView.byteOffset = bufferView.byteOffset || 0
        const buffer = json.buffers[bufferView.buffer]
        const data = buffer._data.slice(
          bufferView.byteOffset,
          bufferView.byteOffset + bufferView.byteLength
        )
        const blob = new Blob([data], { type: image.mimeType })
        const uri = URL.createObjectURL(blob)
        image._img = await loadImage({ url: uri, crossOrigin: 'anonymous' })
      } else if (isBase64(image.uri)) {
        image._img = await loadImage({
          url: image.uri,
          crossOrigin: 'anonymous'
        })
      } else {
        // TODO why are we replacing uri encoded spaces?
        image._img = await loadImage({
          url: path.join(basePath, image.uri).replace(/%/g, '%25'),
          crossOrigin: 'anonymous'
        })
      }
    }
  }

  // Load scene
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/scene.schema.json
  let scenes = (json.scenes || [{}]).map((scene, index) => {
    // Create scene root entity
    scene.root = renderer.entity([
      renderer.transform({
        enabled: opts.enabledScene || index === (json.scene || 0)
      })
    ])
    scene.root.name = scene.name || `scene_${index}`

    // Add scene entities for each node and its children
    // TODO: scene.entities is just convenience. We could use a user-friendly entity traverse.
    scene.entities = json.nodes.reduce((entities, node, i) => {
      const result = handleNode(node, json, i, ctx, renderer, opts)
      if (result.length) {
        result.forEach((primitive) => entities.push(primitive))
      } else {
        entities.push(result)
      }
      return entities
    }, [])

    // Build pex-renderer hierarchy
    json.nodes.forEach((node, index) => {
      const parentNode = json.nodes[index]
      const parentTransform = parentNode.entity.transform

      // Default to scene root
      if (!parentNode.entity.transform.parent) {
        parentNode.entity.transform.set({ parent: scene.root.transform })
      }

      if (node.children) {
        node.children.forEach((childIndex) => {
          const child = json.nodes[childIndex]
          const childTransform = child.entity.transform

          childTransform.set({ parent: parentTransform })
        })
      }
    })

    json.nodes.forEach((node) => {
      if (node.skin !== undefined) {
        const skin = json.skins[node.skin]
        const joints = skin.joints.map((i) => json.nodes[i].entity)

        if (json.meshes[node.mesh].primitives.length === 1) {
          node.entity.getComponent('Skin').set({
            joints: joints
          })
        } else {
          node.entity.transform.children.forEach((child) => {
            // FIXME: currently we share the same Skin component
            // so this code is redundant after first child
            child.entity.getComponent('Skin').set({
              joints: joints
            })
          })
        }
      }
    })

    if (json.animations) {
      json.animations.forEach((animation) => {
        const animationComponent = handleAnimation(animation, json, renderer)
        scene.root.addComponent(animationComponent)
      })
    }

    renderer.update()

    return scene
  })

  return scenes
}

module.exports = loadGltf
