# pex-renderer v3

![](screenshot.jpg)

Phisically based renderer (PBR) and scene graph for [PEX](http://pex.gl).

This is an **experimental** API and it's likely to change in the future.

#### Key dependencies:
- [pex-context](http://github.com/pex-gl/pex-context) modern WebGL wrapper (buffers, textures, pipelines, commands etc)
- [pex-math](http://github.com/pex-gl/pex-math) array based math (vec3, mat4, quaternions etc)

# Contents
- [Usage](#usage)
- [Examples](#examples)
- [API](#api)
  - [Creating renderer](#creating-renderer)
  - [Entities](#entities)
  - [Components](#components)
  - [Scene Components](#scene-components)
    - transform, camera, overlay
  - [Geometry Components](#geometry-components)
    - animation, geometry, material, morph, skin
  - [Lighting Components](#lighting-components)
    - ambientLight, directionalLight, areaLight, spotLight, skybox, reflectionProbe
  - [Disposing Components](#disposing-components)
  - [Creating Custom Components](#creating-custom-components)

# Usage

PEX Renderer v3 is currently in beta. You can install the latest version via [npm](http://npmjs.com):

```sh
npm i pex-renderer@next
```

This will install v3 with the beta release number after the dash e.g. pex-renderer@3.0.0-4.

PEX Renderer is a CommonJS module and you will need a bundler (e.g. [Browserify](http://browserify.org)) to run it in the browser.

# Examples

```javascript
const createContext = require('pex-context')
const createRenderer = require('pex-renderer')
const createSphere = require('primitive-sphere')

const ctx = createContext({ width: 800, height: 600 })

const renderer = createRenderer({
  ctx: ctx
})

const camera = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100
  })
])
renderer.add(camera)

const cube = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry(createSphere(1)),
  renderer.material({
    baseColor: [1, 0, 0, 1]
  })
])
renderer.add(cube)

const skybox = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skybox)

const reflectionProbe = renderer.entity([
  renderer.reflectionProbe()
])
renderer.add(reflectionProbe)

ctx.frame(() => {
  renderer.draw()
})
```

You can find runnable examples in the `/examples` folder in this repository. To run an example install [Node.js](http://nodejs.org), clone or download this repository and then.

```sh
# install browserify development server
npm i -g budo

# go to the example folder
cd /path-to-pex-renderer/examples/basic

# install example specific dependencies
npm i

# run the example in your default browser window
npm run start
```

#### Examples porting status

- [ ] basic
- [ ] blocks
- [ ] gltf
- [ ] gltf-morph
- [ ] gltf-nodes
- [ ] gltf-skin
- [ ] instancing
- [ ] lights
- [ ] materials
- [ ] overlays
- [ ] panorama
- [ ] postprocessing
- [ ] skin-shader
- [ ] window-resize


# API

## Renderer

Main class responsible for managing scene hierarchy and rendering.
You add your entities to the renderer and call draw every frame.

*Note: PEX Renderer doesn't currently have a concept of a scene. This can be simiulated by creating multiple root entities with their own scene hierarchies and adding / removing them as necessary.*

#### renderer = createRenderer(opts)

```javascript
const createRenderer = require('pex-renderer')
const renderer = createRendererer({
  ctx: Context,
  shadowQuality: 2,
  rgbm: false,
  profile: false,
  pauseOnBlur: true
})
```

- renderer.paused
- renderer.profiler


| property | info | type | default |
| -------- | ---- | ---- | ------- |
| `ctx` | rendering context | pex-context.Context | null |
| `shadowQuality` | shadow smoothness | Integer 0-4 | 2 |
| `rgbm` | use RGBM color packing for rendering pipeline | Boolean | falsse |
| `profile` | enable profiling | Boolean | false |
| `pauseOnBlur` | stop rendering when window looses focus | Boolean | false |
| `entities`* | list of entities in the scene | Array of Entity | [] |

&nbsp;* required
&nbsp;* read only

#### renderer.draw()

```javascript
function frame() {
  renderer.draw()
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)

// or using built-in frame() from pex-Context

ctx.frame(() => {
  renderer.draw()
})
```

Updates transforms, shadowmaps, reflection probes, materials, shaders, renders the scene and applies postprocessing. Should be called every frame.

## Entities

Entitites are collection of [components](#components) representing an object in the scene graph.

*NOTE: It's worth mentioning that in its current form PEX Renderer doesn't implement [Entity-Component-System](https://en.wikipedia.org/wiki/Entity–component–system) architecture.* Components are self contained and fully functional not merely buckets of data to be processed by a collection of systems. In that regard it's comparable to [Unity](http://unity3d.com) and its GameObject and MonoBehaviour implementation.

#### entity = renderer.entity(components, tags)

Creates an entity from a list of components.

- `components`: Array of Component - list of components that the entity is made of
- `tags` - Array of String - list of tags

*Note: entities are not added to the scene graph automatically.*

*Note on tagging: Camera component also accepts tags. Only entities matching one or more camera tags will be renderered. If camera doesn't have any tags only untagged entities will be rendererd.*

```javascript
var entity = renderer.entity([
  renderer.transform({ position: [0, 1, 0] }),
  renderer.geometry({ positions: [..], normals: [..], cells: [..]}),
  renderer.material({ baseColor: [1, 0, 0, 1] })
], ['opaque', 'debug-only'])
```

#### entity = renderer.add(entity, parent)

Adds entity to the scene graph and attaches to a parent as a child.

#### renderer.remove(entity)

Removes entity from the scene graph.

#### entity.addComponent(component)

Adds component to an entity.

#### component = entity.getComponent(type)
```javascript
var pointLightEntity = renderer.entity([
  renderer.pointLight()
])
entity.getComponent('PointLight')
```

Gets component by it's class name.

- `type` - upper camel case name of the component class

#### entity.dispose()

Removes entity from the scene and diposes all the components and their resources.

## Components

Components are bits of functionality (transform, light type, geometry, material etc) that are added to an entity.

#### Properties shared by all components:

| property | info | type | default |
| -------- | ---- | ---- | ------- |
| `type`* | component class name | String | '' |
| `entity`* | entity the component is attached to | Entity | null |
| `changed`* | event emitted whenever component's property changes | [Signal](https://millermedeiros.github.io/js-signals/) | null |

<sup>*</sup> required

#### Observing component changes

```javascript
function onParamChange (name) {
  console.log('param ${name} has changed')
}

// start listening
entity.transform.changed.add(onParamChange)

// done internaly by transform whenever position changes
entity.transform.dispatch('position')

// stop listening
entity.transform.changed.remove(onParamChange)
```

#### component.dispose()

- TODO: https://github.com/pex-gl/pex-renderer/issues/75

## Scene Components

### transform = renderer.transform(opts)

```javascript
transform = renderer.transform({
  position: [0, 0, 0],
  scale: [1, 1, 1],
  rotation: [0, 0, 0, 1]
})
```

| property | info | type | default |
| -------- | ---- | ---- | ------- |
| `position` | entity position relatively to it's parent | vec3 / [x, y, z] | [0, 0, 0] |
| `scale` | entity scale relatively to it's parent | vec3 / [x, y, z] | [1, 1, 1] |
| `rotation` | entity rotation relatively to it's parent | quat / [x, y, z, w] | [0, 0, 0, 1] |
| `parent` | entity's parent entity | Entity | null |
| `enabled` | should the entity be rendered | Boolean | true |
| `children`* |  | Array of Entity | false |
| `bounds`* | | | |
| `worldBounds`* | | | |
| `localModelMatrix`* | | | |
| `modelMatrix`* | | | |

<sup>*</sup> read only

### camera = renderer.camera(opts)

Defines rendering viewport, perspective and postprocessing.

```javascript
camera = renderer.camera({
  fov: Math.PI / 2,
  aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  near: 0.1,
  far: 100,
  postprocess: true,
  ssao: true,
  fxaa: true
})
```

### overlay = renderer.overlay(opts)

Flat 2D overlay, useful for tex and logos.

```javascript
overlay = renderer.overlay({
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  texture: ctx.Texture
})
```

## Geometry Components

### geometry = renderer.geometry(opts)

```javascript
geometry = renderer.geometry({
  positons: [[0, 0, 1], [1, 2, 3], ...],
  normals: [[0, 0, 1], [0, 0, 1], ...],
  uvs: [[0, 0], [0, 1], ...],
  indices: [[0, 1, 2], [3, 4, 5], ...]
})
```

### material = renderer.material(opts)

```javascript
material = renderer.material({
  baseColor: [0.95, 0.95, 0.95, 1],
  baseColorMap: null,
  emissiveColor: [0, 0, 0, 1],
  emissiveColorMap: null,
  metallic: 0.01,
  matallicMap: null,
  occlusionMap: null,
  roughness: 0.5,
  roughnessMap: null,
  castShadows: false,
  receiveShadows: false
})
```

### animation = renderer.animation(opts)

```javascript
animation = renderer.animation({
  TODO
})
```

### morph = renderer.morph(opts)

```javascript
morph = renderer.morph({
  TODO
})
```

### skin = renderer.skin(opts)

```javascript
skin = renderer.skin({
  TODO
})
```


## Lighting Components

### ambientLight = renderer.ambientLight(opts)

```javascript
ambientLight = renderer.ambientLight({
  TODO
})
```

### directionalLight = renderer.directionalLight(opts)

```javascript
directionalLight = renderer.directionalLight({
  TODO
})
```

### areaLight = renderer.areaLight(opts)

```javascript
areaLight = renderer.areaLight({
  TODO
})
```

### spotLight = renderer.spotLight(opts)

```javascript
spotLight = renderer.spotLight({
  TODO
})
```

### skybox = renderer.skybox(opts)

```javascript
skybox = renderer.skybox({
  TODO
})
```

### reflectionProbe = renderer.reflectionProbe(opts)

```javascript
reflectionProbe = renderer.reflectionProbe({
  TODO
})
```

## Creating Custom Components

Start by creating new class as follows:

```javascript
// MyComponent.js

const Signal = require('signals')

function MyComponent (opts) {
  this.type = 'MyComponent'
  this.entity = null
  this.numberParameter = 1
  this.stringParameter = 'some text'
  this.changed = new Signal()
  this.dirty = false
  this.set(opts)  
}

// this function gets called when the component is added
// to an enity
MyComponent.prototype.init = function (entity) {
  this.entity = entity  
}

MyComponent.prototype.set = function (opts) {
  Object.assign(this, opts)
  this.dirty = true
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))  
}

MyComponent.prototype.update = function () {
  if (!this.dirty) return
  this.dirty = false

  var transform = this.entity.transform
  //do sth with transform

  var geom = this.entity.getComponent('Geometry')
  //do sth with geom
}

// by pex-renderer convention we export factory function
// instead of the class type
module.exports = function createMyComponent (opts) {
  return new MyComponent(opts)
}
```

Create instance of your component and add it to an enity.

```javascript
const createMyComponent = require('/path/to/MyComponent')

const myComponent = createMyComponent({ numberParameter: 1 })
const entity = renderer.entity([
  myComponent
])
```

## License

MIT, see [LICENSE.md](http://github.com/pex-gl/pex-renderer/blob/master/LICENSE.md) for details.
