const isPOT = require('is-power-of-two')
const nextPOT = require('next-power-of-two')
const log = require('debug')('gltf-build')
const assert = require('assert')
const aabb = require('pex-geom/aabb')
const vec3 = require('pex-math/vec3')
const createBox = require('primitive-box')
const edges = require('geom-edges')

var WebGLConstants = {
  ELEMENT_ARRAY_BUFFER: 34963,  // 0x8893
  ARRAY_BUFFER: 34962,          // 0x8892
  UNSIGNED_SHORT: 5123,         // 0x1403
  UNSIGNED_INT: 5125,
  FLOAT: 5126,                  // 0x1406
  TRIANGLES: 4,                 // 0x0004
  SAMPLER_2D: 35678,            // 0x8B5E
  FLOAT_VEC2: 35664,            // 0x8B50
  FLOAT_VEC3: 35665,            // 0x8B51
  FLOAT_VEC4: 35666,            // 0x8B52
  FLOAT_MAT4: 35676             // 0x8B5C
}

const AttributeSizeMap = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16
}

const AttributeNameMap = {
  POSITION: 'positions',
  NORMAL: 'normals',
  TANGENT: 'tangents',
  TEXCOORD_0: 'texCoords',
  TEXCOORD_1: 'texCoords1',
  TEXCOORD_2: 'texCoords2',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights',
  COLOR_0: 'vertexColors'
}

function handleBufferView (bufferView, bufferData, ctx, renderer) {
  if (bufferView.byteOffset === undefined) bufferView.byteOffset = 0
  bufferView._data = bufferData.slice(
    bufferView.byteOffset,
    bufferView.byteOffset + bufferView.byteLength
  )

  if (bufferView.target === WebGLConstants.ELEMENT_ARRAY_BUFFER) {
    bufferView._indexBuffer = ctx.indexBuffer(bufferView._data)
  } else if (bufferView.target === WebGLConstants.ARRAY_BUFFER) {
    bufferView._vertexBuffer = ctx.vertexBuffer(bufferView._data)
  }
}

function handleAccessor (accessor, bufferView, ctx, renderer) {
  const size = AttributeSizeMap[accessor.type]
  if (accessor.byteOffset === undefined) accessor.byteOffset = 0

  accessor._bufferView = bufferView

  if (bufferView._indexBuffer) {
    accessor._buffer = bufferView._indexBuffer
    // return
  }
  if (bufferView._vertexBuffer) {
    accessor._buffer = bufferView._vertexBuffer
    // return
  }

  if (accessor.componentType === WebGLConstants.UNSIGNED_SHORT) {
    const data = new Uint16Array(bufferView._data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 2
    ))
    accessor._data = data
  } else if (accessor.componentType === WebGLConstants.UNSIGNED_INT) {
    const data = new Uint32Array(bufferView._data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor._data = data
  } else if (accessor.componentType === WebGLConstants.FLOAT) {
    const data = new Float32Array(bufferView._data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor._data = data
  } else if (accessor.componentType === WebGLConstants.FLOAT_VEC2) {
    const data = new Float32Array(bufferView._data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor._data = data
  } else if (accessor.componentType === WebGLConstants.FLOAT_VEC3) {
    const data = new Float32Array(bufferView._data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor._data = data
  } else if (accessor.componentType === WebGLConstants.FLOAT_VEC4) {
    const data = new Float32Array(bufferView._data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor._data = data
  } else {
    // TODO
    console.log('uncaught', accessor)
  }
}

// TODO: add texture cache so we don't load the same texture twice
// TODO: make it sync as the data is loaded already
function loadTexture (materialTexture, gltf, encoding, ctx, renderer) {
  let texture = gltf.textures[materialTexture.index]
  let image = gltf.images[texture.source]
  let sampler = gltf.samplers ? gltf.samplers[texture.sampler] : {
    minFilter: ctx.Filter.Linear,
    magFilter: ctx.Filter.Linear
  }
  sampler.minFilter = ctx.Filter.LinearMipmapLinear
  // set defaults as per GLTF 2.0 spec
  if (!sampler.wrapS) sampler.wrapS = ctx.Wrap.Repeat
  if (!sampler.wrapT) sampler.wrapT = ctx.Wrap.Repeat

  if (texture._tex) {
    return texture._tex
  }

  let img = image._img
  if (!isPOT(img.width) || !isPOT(img.height)) {
    // FIXME: this is WebGL1 limitation
    if (sampler.wrapS !== ctx.Wrap.Clamp || sampler.wrapT !== ctx.Wrap.Clamp || (sampler.minFilter !== ctx.Filter.Nearest && sampler.minFilter !== ctx.Filter.Linear)) {
      const nw = nextPOT(img.width)
      const nh = nextPOT(img.height)
      console.log(`Warning: NPOT Repeat Wrap mode and mipmapping is not supported for NPOT Textures. Resizing... ${img.width}x${img.height} -> ${nw}x${nh}`)
      var canvas2d = document.createElement('canvas')
      canvas2d.width = nw
      canvas2d.height = nh
      var ctx2d = canvas2d.getContext('2d')
      ctx2d.drawImage(img, 0, 0, canvas2d.width, canvas2d.height)
      img = canvas2d
    }
  }
  // console.log(`min: ${WebGLDebugUtils.glEnumToString(sampler.minFilter)} mag: ${WebGLDebugUtils.glEnumToString(sampler.magFilter)}`)
  var tex = texture._tex = ctx.texture2D({
    data: img,
    width: img.width,
    height: img.height,
    encoding: encoding || ctx.Encoding.SRGB,
    pixelFormat: ctx.PixelFormat.RGBA8,
    wrapS: sampler.wrapS,
    wrapT: sampler.wrapT,
    min: sampler.minFilter,
    mag: sampler.magFilter,
    mipmap: true,
    aniso: 16,
    flipY: false // this is confusing as
  })
  if (sampler.minFilter !== ctx.Filter.Nearest && sampler.minFilter !== ctx.Filter.Linear) {
    ctx.update(tex, { mipmap: true })
  }
  return tex
}

function handleMaterial (material, gltf, ctx, renderer) {
  const materialCmp = renderer.material({
    baseColor: [1, 1, 1, 1.0],
    roughness: 1.0,
    metallic: 1.0,
    castShadows: true,
    receiveShadows: true,
    cullFaceEnabled: !material.doubleSided
  })

  const pbrMetallicRoughness = material.pbrMetallicRoughness
  if (pbrMetallicRoughness) {
    log('pbrMetallicRoughness')
    materialCmp.set({
      baseColor: [1, 1, 1, 1],
      roughness: 1,
      metallic: 1
    })
    log('material.pbrMatallicRoughness', pbrMetallicRoughness, materialCmp)
    if (pbrMetallicRoughness.baseColorFactor !== undefined) {
      materialCmp.set({ baseColor: pbrMetallicRoughness.baseColorFactor })
    }
    if (pbrMetallicRoughness.baseColorTexture) {
      let tex = loadTexture(pbrMetallicRoughness.baseColorTexture, gltf, ctx.Encoding.SRGB, ctx, renderer)
      log('baseColorTexture', tex)
      materialCmp.set({ baseColorMap: tex })
    }
    if (pbrMetallicRoughness.metallicFactor !== undefined) {
      materialCmp.set({ metallic: pbrMetallicRoughness.metallicFactor })
    }
    if (pbrMetallicRoughness.roughnessFactor !== undefined) {
      materialCmp.set({ roughness: pbrMetallicRoughness.roughnessFactor })
    }
    if (pbrMetallicRoughness.metallicRoughnessTexture) {
      let tex = loadTexture(pbrMetallicRoughness.metallicRoughnessTexture, gltf, ctx.Encoding.Linear, ctx, renderer)
      materialCmp.set({ metallicRoughnessMap: tex })
    }
  }

  const pbrSpecularGlossiness = material.extensions ? material.extensions.KHR_materials_pbrSpecularGlossiness : null
  if (pbrSpecularGlossiness) {
    materialCmp.set({
      diffuse: [1, 1, 1, 1],
      specular: [1, 1, 1],
      glossiness: 1
    })
    log('material.pbrSpecularGlossiness', pbrSpecularGlossiness, materialCmp)
    if (pbrSpecularGlossiness.diffuseFactor !== undefined) {
      materialCmp.set({ diffuse: pbrSpecularGlossiness.diffuseFactor })
    }
    if (pbrSpecularGlossiness.specularFactor !== undefined) {
      materialCmp.set({ specular: pbrSpecularGlossiness.specularFactor })
    }
    if (pbrSpecularGlossiness.glossinessFactor !== undefined) {
      materialCmp.set({ glossiness: pbrSpecularGlossiness.glossinessFactor })
    }
    if (pbrSpecularGlossiness.diffuseTexture) {
      let tex = loadTexture(pbrSpecularGlossiness.diffuseTexture, gltf, ctx.Encoding.SRGB, ctx, renderer)
      materialCmp.set({ diffuseMap: tex })
    }
    if (pbrSpecularGlossiness.specularGlossinessTexture) {
      let tex = loadTexture(pbrSpecularGlossiness.specularGlossinessTexture, gltf, ctx.Encoding.SRGB, ctx, renderer)
      materialCmp.set({ specularGlossinessMap: tex })
    }
    if (pbrSpecularGlossiness.diffuseFactor !== undefined) {
      materialCmp.set({ diffuse: pbrSpecularGlossiness.diffuseFactor })
    } else {
      materialCmp.set({ diffuse: [1, 1, 1, 1] })
    }
    if (pbrSpecularGlossiness.glossinessFactor !== undefined) {
      materialCmp.set({ glossiness: pbrSpecularGlossiness.glossinessFactor })
    } else {
      materialCmp.set({ glossiness: 1 })
    }
    if (pbrSpecularGlossiness.specularFactor !== undefined) {
      materialCmp.set({ specular: pbrSpecularGlossiness.specularFactor.slice(0, 3) })
    } else {
      materialCmp.set({ specular: [1, 1, 1] })
    }
  }

  if (material.normalTexture) {
    let tex = loadTexture(material.normalTexture, gltf, ctx.Encoding.Linear, ctx, renderer)
    materialCmp.set({ normalMap: tex })
  }

  if (material.emissiveFactor) {
    materialCmp.set({ emissiveColor: [
      material.emissiveFactor[0],
      material.emissiveFactor[1],
      material.emissiveFactor[2],
      1
    ]})
  }
  if (material.occlusionTexture) {
    let tex = loadTexture(material.occlusionTexture, gltf, ctx.Encoding.Linear, ctx, renderer)
    materialCmp.set({ occlusionMap: tex })
  }

  if (material.emissiveTexture) {
    // TODO: double check sRGB
    var tex = loadTexture(material.emissiveTexture, gltf, ctx.Encoding.SRGB, ctx, renderer)
    materialCmp.set({ emissiveColorMap: tex })
  }

  return materialCmp
}

function handleMesh (mesh, gltf, ctx, renderer) {
  return mesh.primitives.map((primitive) => {
    const attributes = Object.keys(primitive.attributes).reduce((attributes, name) => {
      const accessor = gltf.accessors[primitive.attributes[name]]
      // TODO: add stride support (requires update to pex-render/geometry
      if (accessor._buffer) {
        const attributeName = AttributeNameMap[name]

        assert(attributeName, `GLTF: Unknown attribute '${name}'`)
        attributes[attributeName] = {
          buffer: accessor._buffer,
          offset: accessor.byteOffset,
          type: accessor.componentType,
          stride: accessor._bufferView.stride
        }
      } else {
        const attributeName = AttributeNameMap[name]
        assert(attributeName, `GLTF: Unknown attribute '${name}'`)
        attributes[attributeName] = accessor._data
      }
      return attributes
    }, {})

    console.log('handleMesh.attributes', attributes)

    const positionAccessor = gltf.accessors[primitive.attributes.POSITION]
    const indicesAccessor = gltf.accessors[primitive.indices]
    console.log('handleMesh.positionAccessor', positionAccessor)
    console.log('handleMesh.indicesAccessor', indicesAccessor)

    const geometryCmp = renderer.geometry(attributes)
    geometryCmp.set({
      bounds: [positionAccessor.min, positionAccessor.max]
    })

    if (indicesAccessor) {
      if (indicesAccessor._buffer) {
        console.log('indicesAccessor._buffer', indicesAccessor)
        geometryCmp.set({
          indices: {
            buffer: indicesAccessor._buffer,
            offset: indicesAccessor.byteOffset,
            type: indicesAccessor.componentType,
            count: indicesAccessor.count
          }
        })
      } else {
        // TODO: does it ever happen?
        geometryCmp.set({
          indices: indicesAccessor._data
        })
      }
    } else {
      geometryCmp.set({
        count: positionAccessor.buffer.length / 3
      })
    }

    let materialCmp = null
    if (primitive.material !== undefined) {
      const material = gltf.materials[primitive.material]
      materialCmp = handleMaterial(material, gltf, ctx, renderer)
    } else {
      materialCmp = renderer.material({})
    }
      // materialCmp = renderer.material({
        // roughness: 0.1,
        // metallic: 0,
        // baseColor: [1, 0.2, 0.2, 1],
        // castShadows: true,
        // receiveShadows: true
      // })

    let components = [
      geometryCmp,
      materialCmp
    ]
    log('components', components)

    if (primitive.targets) {
      let targets = primitive.targets.map((target) => {
        return gltf.accessors[target.POSITION]._data
      })
      let morphCmp = renderer.morph({
        // TODO the rest ?
        targets: targets,
        weights: mesh.weights
      })
      components.push(morphCmp)
    }

    return components
  })
}

function handleNode (node, gltf, i, ctx, renderer) {
  const transform = {
    position: node.translation || [0, 0, 0],
    rotation: node.rotation || [0, 0, 0, 1],
    scale: node.scale || [1, 1, 1]
  }
  if (node.matrix) transform.matrix = node.matrix
  const transformCmp = renderer.transform(transform)

  node.entity = renderer.add(renderer.entity([
    transformCmp
  ]))
  node.entity.name = node.name || ('node_' + i)

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
      // create sub modes for each primitive
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

      const joints = skin.joints.map((i) => {
        return nodes[i].entity
      })

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

function handleAnimation (animation, gltf, ctx, renderer) {
  const channels = animation.channels.map((channel) => {
    const sampler = animation.samplers[channel.sampler]
    const input = gltf.accessors[sampler.input]
    const output = gltf.accessors[sampler.output]
    const target = gltf.nodes[channel.target.node].entity

    const outputData = []
    const od = output._data
    let offset = AttributeSizeMap[output.type]
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

  const animationCmp = renderer.animation({
    channels: channels,
    autoplay: true,
    loop: true
  })
  return animationCmp
}

function build (gltf, ctx, renderer) {
  log('build', gltf)
  gltf.bufferViews.map((bufferView) => {
    handleBufferView(bufferView, gltf.buffers[bufferView.buffer]._data, ctx, renderer)
  })

  gltf.accessors.map((accessor) => {
    handleAccessor(accessor, gltf.bufferViews[accessor.bufferView], ctx, renderer)
  })

  const scene = {
    root: null,
    entities: null
  }

  scene.root = renderer.add(renderer.entity())
  scene.root.name = 'sceneRoot'
  scene.entities = gltf.nodes.reduce((entities, node, i) => {
    const result = handleNode(node, gltf, i, ctx, renderer)
    if (result.length) {
      result.forEach((primitive) => entities.push(primitive))
    } else {
      entities.push(result)
    }
    return entities
  }, [])

  buildHierarchy(gltf.nodes, gltf)

  scene.entities.forEach((e) => {
    if (e.transform.parent === renderer.root.transform) {
      console.log('attaching to scene root', e)
      e.transform.set({ parent: scene.root.transform })
    }
  })

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
      const animationComponent = handleAnimation(animation, gltf, ctx, renderer)
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
  log('entities pruned', scene.entities)

  renderer.update() // refresh scene hierarchy

  const sceneBounds = scene.root.transform.worldBounds
  const sceneSize = aabb.size(scene.root.transform.worldBounds)
  const sceneCenter = aabb.center(scene.root.transform.worldBounds)
  const sceneScale = 1 / (Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2])) || 1)
  if (!aabb.isEmpty(sceneBounds)) {
    scene.root.transform.set({
      position: vec3.scale([-sceneCenter[0], -sceneBounds[0][1], -sceneCenter[2]], sceneScale),
      scale: [sceneScale, sceneScale, sceneScale]
    })
  }

  renderer.update() // refresh scene hierarchy

  scene.entities.push(scene.root)

  // function printEntity (e, level, s) {
    // s = s || ''
    // level = '  ' + (level || '')
    // var g = e.getComponent('Geometry')
    // s += level + (e.name || 'child') + ' ' + aabbToString(e.transform.worldBounds) + ' ' + aabbToString(e.transform.bounds) + ' ' + (g ? aabbToString(g.bounds) : '') + '\n'
    // if (e.transform) {
      // e.transform.children.forEach((c) => {
        // s = printEntity(c.entity, level, s)
      // })
    // }
    // return s
  // }
  var box = createBox(1)
  box.cells = edges(box.cells)
  box.primitive = ctx.Primitive.Lines

  const showBoundingBoxes = false
  if (showBoundingBoxes) {
    const bboxes = scene.entities.map((e) => {
      var size = aabb.size(e.transform.worldBounds)
      var center = aabb.center(e.transform.worldBounds)

      const bbox = renderer.add(renderer.entity([
        renderer.transform({
          scale: size,
          position: center
        }),
        renderer.geometry(box),
        renderer.material({
          baseColor: [1, 0, 0, 1]
        })
      ]))
      bbox.name = e.name + '_bbox'
      return bbox
    }).filter((e) => e)
    scene.entities = scene.entities.concat(bboxes)
  }

  return scene
}

module.exports = build
