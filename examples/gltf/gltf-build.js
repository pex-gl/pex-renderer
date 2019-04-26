const isPOT = require('is-power-of-two')
const nextPOT = require('next-power-of-two')
const assert = require('assert')
const { quat } = require('pex-math')

// Constants
const SUPPORTED_EXTENSIONS = [
  'KHR_materials_unlit',
  'KHR_materials_pbrSpecularGlossiness',
  'KHR_texture_transform',
]

const WEBGL_CONSTANTS = {
  // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#Buffers
  ELEMENT_ARRAY_BUFFER: 34963,  // 0x8893
  ARRAY_BUFFER: 34962,          // 0x8892

  // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#Data_types
  BYTE: 5120,                   // 0x1400
  UNSIGNED_BYTE: 5121,          // 0x1401
  SHORT: 5122,                  // 0x1402
  UNSIGNED_SHORT: 5123,         // 0x1403
  UNSIGNED_INT: 5125,           // 0x1405
  FLOAT: 5126,                  // 0x1406

  SAMPLER_2D: 35678,            // 0x8B5E
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

const AttributeNameMap = {
  POSITION: 'positions',
  NORMAL: 'normals',
  TANGENT: 'tangents',
  TEXCOORD_0: 'texCoords',
  TEXCOORD_1: 'texCoords1',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights',
  COLOR_0: 'vertexColors'
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/bufferView.schema.json
function handleBufferView (bufferView, bufferData, ctx) {
  if (bufferView.byteOffset === undefined) bufferView.byteOffset = 0
  bufferView._data = bufferData.slice(
    bufferView.byteOffset,
    bufferView.byteOffset + bufferView.byteLength
  )

  if (bufferView.target === WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER) {
    bufferView._indexBuffer = ctx.indexBuffer(bufferView._data)
  } else if (bufferView.target === WEBGL_CONSTANTS.ARRAY_BUFFER) {
    bufferView._vertexBuffer = ctx.vertexBuffer(bufferView._data)
  }
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/accessor.schema.json
function handleAccessor (accessor, bufferView, bufferViews) {
  const numberOfComponents = GLTF_ACCESSOR_TYPE_COMPONENTS_NUMBER[accessor.type]
  if (accessor.byteOffset === undefined) accessor.byteOffset = 0

  accessor._bufferView = bufferView

  if (bufferView._indexBuffer) {
    accessor._buffer = bufferView._indexBuffer
  }
  if (bufferView._vertexBuffer) {
    accessor._buffer = bufferView._vertexBuffer
  }

  const TypedArrayConstructor = WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[accessor.componentType]
  const byteSize = GLTF_ACCESSOR_COMPONENT_TYPE_SIZE[accessor.componentType]

  const data = new TypedArrayConstructor(bufferView._data.slice(
    accessor.byteOffset,
    accessor.byteOffset + accessor.count * numberOfComponents * byteSize
  ))
  accessor._data = data

  // Sparse accessors
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/accessor.sparse.schema.json
  if (accessor.sparse !== undefined) {
    const TypedArrayIndicesConstructor =
      WEBGL_TYPED_ARRAY_BY_COMPONENT_TYPES[accessor.sparse.indices.componentType]

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
    for (let indicesIndex = 0; indicesIndex < sparseIndices.length; indicesIndex++) {
      let dataIndex = sparseIndices[indicesIndex] * numberOfComponents
      for (let componentIndex = 0; componentIndex < numberOfComponents; componentIndex++) {
        accessor._data[dataIndex++] = sparseValues[valuesIndex++]
      }
    }
  }
}

function getPexMaterialMap(materialTexture, gltf, ctx, encoding) {
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

  const hasMipMap = (sampler.minFilter !== ctx.Filter.Nearest && sampler.minFilter !== ctx.Filter.Linear)

  if (!texture._tex) {
    let img = image._img

    if (!isPOT(img.width) || !isPOT(img.height)) {
      // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#samplers
      if (
        sampler.wrapS !== ctx.Wrap.Clamp ||
        sampler.wrapT !== ctx.Wrap.Clamp ||
        hasMipMap
      ) {
        const canvas2d = document.createElement('canvas')
        canvas2d.width = nextPOT(img.width)
        canvas2d.height = nextPOT(img.height)
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
      mag: sampler.magFilter,
    })
    if (hasMipMap) ctx.update(texture._tex, { mipmap: true, aniso: 16 })
  }

  // https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_texture_transform/schema/KHR_texture_transform.textureInfo.schema.json
  const textureTransform =
    materialTexture.extensions &&
    materialTexture.extensions.KHR_texture_transform

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/textureInfo.schema.json
  const texCoord = materialTexture.texCoord

  return !texCoord && !textureTransform ? texture._tex : {
    texture: texture._tex,
    // textureInfo
    texCoord: texCoord || 0,
    // textureTransform.texCoord: Overrides the textureInfo texCoord value if supplied.
    ...(textureTransform || {})
  }
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/material.schema.json
function handleMaterial (material, gltf, ctx, renderer) {
  let materialProps = {
    baseColor: [1, 1, 1, 1],
    roughness: 1,
    metallic: 1,
    castShadows: true,
    receiveShadows: true,
    cullFace: !material.doubleSided
  }

  //  Metallic/Roughness workflow
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
      materialProps.baseColorMap = getPexMaterialMap(
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
      materialProps.metallicRoughnessMap = getPexMaterialMap(
        pbrMetallicRoughness.metallicRoughnessTexture,
        gltf,
        ctx
      )
    }
  }

  // Specular/Glossiness workflow
  const pbrSpecularGlossiness = material.extensions ? material.extensions.KHR_materials_pbrSpecularGlossiness : null
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
      materialProps.diffuseMap = getPexMaterialMap(
        pbrSpecularGlossiness.diffuseTexture,
        gltf,
        ctx,
        ctx.Encoding.SRGB
      )
    }
    if (pbrSpecularGlossiness.specularGlossinessTexture) {
      materialProps.specularGlossinessMap = getPexMaterialMap(
        pbrSpecularGlossiness.specularGlossinessTexture,
        gltf,
        ctx,
        ctx.Encoding.SRGB
      )
    }
  }

  // Additional Maps
  if (material.normalTexture) {
    materialProps.normalMap = getPexMaterialMap(
      material.normalTexture,
      gltf,
      ctx
    )
  }

  if (material.occlusionTexture) {
    materialProps.occlusionMap = getPexMaterialMap(
      material.occlusionTexture,
      gltf,
      ctx
    )
  }

  if (material.emissiveTexture) {
    materialProps.emissiveColorMap = getPexMaterialMap(
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
      roughness: null,
      metallic: null
    }
  }

  return renderer.material(materialProps)
}

function handleMesh (mesh, gltf, ctx, renderer) {
  return mesh.primitives.map((primitive) => {
    // Format attributes for pex-context
    const attributes = Object.keys(primitive.attributes).reduce((attributes, name) => {
      const attributeName = AttributeNameMap[name]
      assert(attributeName, `GLTF: Unknown attribute '${name}'`)

      const accessor = gltf.accessors[primitive.attributes[name]]

      if (accessor._buffer) {
        attributes[attributeName] = {
          buffer: accessor._buffer,
          offset: accessor.byteOffset,
          type: accessor.componentType,
          stride: accessor._bufferView.byteStride
        }
      } else {
        attributes[attributeName] = accessor._data
      }
      return attributes
    }, {})

    const positionAccessor = gltf.accessors[primitive.attributes.POSITION]
    const indicesAccessor = gltf.accessors[primitive.indices]

    // Create geometry
    const geometryCmp = renderer.geometry(attributes)
    geometryCmp.set({
      bounds: [positionAccessor.min, positionAccessor.max]
    })

    if (indicesAccessor) {
      if (indicesAccessor._buffer) {
        geometryCmp.set({
          indices: {
            buffer: indicesAccessor._buffer,
            offset: indicesAccessor.byteOffset,
            type: indicesAccessor.componentType,
            count: indicesAccessor.count
          }
        })
      } else {
        geometryCmp.set({
          indices: indicesAccessor._data
        })
      }
    } else {
      geometryCmp.set({
        count: positionAccessor._data.length / 3
      })
    }

    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#primitivemode
    if (primitive.mode) {
      geometryCmp.set({
        primitive: primitive.mode
      })
    }

    // Create material
    const materialCmp =
      primitive.material !== undefined
        ? handleMaterial(
          gltf.materials[primitive.material],
          gltf,
          ctx,
          renderer
        )
        : renderer.material()

    const components = [
      geometryCmp,
      materialCmp
    ]

    // Create morph
    if (primitive.targets) {
      let sources = {}
      const targets = primitive.targets.reduce((targets, target) => {
        const targetKeys = Object.keys(target)

        targetKeys.forEach(targetKey => {
          const targetName = AttributeNameMap[targetKey] || targetKey
          targets[targetName] = targets[targetName] || []
          targets[targetName].push(gltf.accessors[target[targetKey]]._data)

          if (!sources[targetName]) {
            sources[targetName] = gltf.accessors[primitive.attributes[targetKey]]._data
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

function handleNode (node, gltf, i, ctx, renderer, options) {
  const transform = node.matrix
    ? {
      position: [
        node.matrix[12],
        node.matrix[13],
        node.matrix[14]
      ],
      rotation: quat.fromMat4(quat.create(), node.matrix),
      scale: [
        Math.hypot(node.matrix[0], node.matrix[1], node.matrix[2]),
        Math.hypot(node.matrix[4], node.matrix[5], node.matrix[6]),
        Math.hypot(node.matrix[8], node.matrix[9], node.matrix[10])
      ]
    }
    : {
      position: node.translation || [0, 0, 0],
      rotation: node.rotation || [0, 0, 0, 1],
      scale: node.scale || [1, 1, 1]
    }
  const transformCmp = renderer.transform(transform)

  node.entity = renderer.add(renderer.entity([
    transformCmp
  ]))
  node.entity.name = node.name || `node_${i}`

  if (!options.skipCameras && Number.isInteger(node.camera)) {
    node.entity.addComponent(
      handleCamera(
        gltf.cameras[node.camera],
        renderer,
        ctx,
        options.enabledCameras.includes(node.camera)
      )
    )
  }

  let skinCmp = null
  if (node.skin !== undefined) {
    const skin = gltf.skins[node.skin]
    const data = gltf.accessors[skin.inverseBindMatrices]._data

    let inverseBindMatrices = []
    for (let i = 0; i < data.length; i += 16) {
      inverseBindMatrices.push(data.slice(i, i + 16))
    }

    skinCmp = renderer.skin({
      inverseBindMatrices: inverseBindMatrices
    })
  }

  if (node.mesh !== undefined) {
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
        const subMesh = renderer.add(renderer.entity(components))
        subMesh.name = `node_${i}_${j}`
        subMesh.transform.set({ parent: node.entity.transform })

        // TODO: should skin component be shared?
        if (skinCmp) subMesh.addComponent(skinCmp)
        return subMesh
      })
      const nodes = [node.entity].concat(primitiveNodes)
      return nodes
    }
  }
  return node.entity
}

function buildHierarchy (nodes, gltf) {
  nodes.forEach((node, index) => {
    let parent = nodes[index]
    if (!parent || !parent.entity) return // TEMP: for debuggin only, child should always exist
    let parentTransform = parent.entity.transform
    if (node.children) {
      node.children.forEach((childIndex) => {
        let child = nodes[childIndex]
        if (!child || !child.entity) return // TEMP: for debuggin only, child should always exist
        let childTransform = child.entity.transform
        childTransform.set({ parent: parentTransform })
      })
    }
  })

  nodes.forEach((node) => {
    if (node.skin !== undefined) {
      const skin = gltf.skins[node.skin]
      const joints = skin.joints.map((i) => nodes[i].entity)

      if (gltf.meshes[node.mesh].primitives.length === 1) {
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
}

// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/camera.schema.json
function handleCamera (camera, renderer, ctx, enabled = false) {
  if (camera.type === 'orthographic') {
    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/camera.orthographic.schema.json
    return renderer.camera({
      enabled,
      name: camera.name,
      projection: 'orthographic',
      near: camera.orthographic.znear,
      far: camera.orthographic.zfar,
      left: -camera.orthographic.xmag / 2,
      right: camera.orthographic.xmag / 2,
      top: camera.orthographic.ymag / 2,
      bottom: camera.orthographic.ymag / 2
    })
  }

  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/schema/camera.perspective.schema.json
  return renderer.camera({
    enabled,
    name: camera.name,
    near: camera.perspective.znear,
    far: camera.perspective.zfar || Infinity,
    fov: camera.perspective.yfov,
    aspect: camera.perspective.aspectRatio || ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  })
}

function handleAnimation (animation, gltf, renderer) {
  const channels = animation.channels.map((channel) => {
    const sampler = animation.samplers[channel.sampler]
    const input = gltf.accessors[sampler.input]
    const output = gltf.accessors[sampler.output]
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

const defaultOptions = {
  enabledCameras: [0],
  skipCameras: false
}

function build (gltf, ctx, renderer, options) {
  const opts = Object.assign(defaultOptions, options)

  // Check required extensions
  if (gltf.extensionsRequired) {
    const unsupportedExtensions = gltf.extensionsRequired.filter(extension => !SUPPORTED_EXTENSIONS.includes(extension))
    if (unsupportedExtensions.length) {
      console.warn('glTF loader: unsupported extensions', unsupportedExtensions)
    }
  }

  // Handle binary data retrieval
  // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#binary-data-storage
  for (let i = 0; i < gltf.bufferViews.length; i++) {
    const bufferView = gltf.bufferViews[i]
    handleBufferView(bufferView, gltf.buffers[bufferView.buffer]._data, ctx)
  }

  for (let j = 0; j < gltf.accessors.length; j++) {
    const accessor = gltf.accessors[j]
    handleAccessor(accessor, gltf.bufferViews[accessor.bufferView], gltf.bufferViews)
  }

  // Build pex-renderer scene
  const scene = {}
  scene.root = renderer.add(renderer.entity())
  scene.root.name = 'sceneRoot'
  scene.entities = gltf.nodes.reduce((entities, node, i) => {
    const result = handleNode(node, gltf, i, ctx, renderer, opts)
    if (result.length) {
      result.forEach((primitive) => entities.push(primitive))
    } else {
      entities.push(result)
    }
    return entities
  }, [])

  buildHierarchy(gltf.nodes, gltf)

  scene.entities.forEach((entity) => {
    if (entity.transform.parent === renderer.root.transform) {
      entity.transform.set({ parent: scene.root.transform })
    }
  })

  // TODO: handle camera and lights
  // prune non geometry nodes (cameras, lights, etc) from the hierarchy
  scene.entities.forEach((e) => {
    if (e.getComponent('Geometry')) {
      e.used = true
      while (e.transform.parent) {
        e = e.transform.parent.entity
        e.used = true
      }
    }
  })

  if (gltf.animations) {
    gltf.animations.map((animation) => {
      const animationComponent = handleAnimation(animation, gltf, renderer)
      scene.root.addComponent(animationComponent)
    })
  }

  if (gltf.skins) {
    gltf.skins.forEach((skin) => {
      skin.joints.forEach((jointIndex) => {
        let e = scene.entities[jointIndex]
        e.used = true
        while (e.transform.parent) {
          e = e.transform.parent.entity
          e.used = true
        }
      })
    })
  }

  renderer.update()

  scene.entities.push(scene.root)

  return scene
}

module.exports = build
