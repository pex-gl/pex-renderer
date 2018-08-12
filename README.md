# pex-renderer v3

![](screenshot.jpg)

Phisically based renderer (PBR) and scene graph for [PEX](http://pex.gl).

This is an **experimental** API and it's likely to change in the future.

#### Key dependencies:
- [pex-context](http://github.com/pex-gl/pex-context) modern WebGL wrapper (buffers, textures, pipelines, commands etc)
- [pex-math](http://github.com/pex-gl/pex-math) array based math (vec3, mat4, quaternions etc)

# Contents
- [Usage](#usage)
- [Example](#example)
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

# Example

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
  profiler: null,
  pauseOnBlur: true
})
```

- renderer.paused
- renderer.profiler

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

Gets component by it's class name. The convention is that all component names start with Uppercase.


#### entity.dispose()

Removes entity from the scene and diposes all the components and their resources.

## Components

Components are bits of functionality (transform, light type, geometry, material etc) that are added to an entity.

## Scene Components

### transform = renderer.transform(opts)

```

```

### camera = renderer.camera(opts)
### overlay = renderer.overlay(opts)

## Geometry Components

### animation = renderer.animation(opts)
### geometry = renderer.geometry(opts)
### material = renderer.material(opts)
### morph = renderer.morph(opts)
### skin = renderer.skin(opts)

## Lighting Components

### ambientLight = renderer.ambientLight(opts)
### directionalLight = renderer.directionalLight(opts)
### areaLight = renderer.areaLight(opts)
### spotLight = renderer.spotLight(opts)
### skybox = renderer.skybox(opts)
### reflectionProbe = renderer.reflectionProbe(opts)

## Disposing Components

- TODO: diposing? right now it's not recursive
- TODO: name in the constructor?
- TODO: what if e.g. material component shared a texture with another one?

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
