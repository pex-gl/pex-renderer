# pex-renderer v3

Phisically based renderer (PBR) and scene graph for [PEX](http://pex.gl).

This is an **experimental** API and it's likely to change in the future.

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

# API

## Creating renderer

### renderer = createRenderer(opts)

```javascript
const createRenderer = require('pex-renderer')
const renderer = createRendererer({
  ctx: Context,
  shadowQuality: 4, //TODO
  rgbm: true
})
```

## Entities

Entitites are collection of [components](#components) representing an object in the scene graph.

### entity = renderer.entity(components, tags)

Creates and entity from a list of components.

- `components`: Array of Component - list of components that the endity is made of
- `tags` - Array of String - list of tags

*Note: entities are not added to the scene graph automatically.*
*Note on tagging: Camera component also accepts tags. Only entities matching one or more camera tags will be renderered. If camera doesn't have any tags only untagged entities will be rendererd.*

```javascript
var entity = renderer.entity([
  renderer.transform({ position: [0, 1, 0] }),
  renderer.geometry({ positions: [..], normals: [..], cells: [..]}),
  renderer.material({ baseColor: [1, 0, 0, 1] })
])
```

### entity = renderer.add(entity, parent)

Adds entity to the scene graph and attaches to a parent as a child.

```javascript
var entity = renderer.entity(..)
renderer.add(entity)
```

### renderer.remove(entity)

Removes entity from the scene graph.

### entity.addComponent(component)

Adds component to an entity.

### component = entity.getComponent(type)

Gets component by it's class name.

### entity.dispose()

Removes entity from the scene and diposes all the components and their resources

## Components

Components are bits of functionality (transform, light type, geometry, material etc) that are added to an entity.

## Scene Components

### transform = renderer.transform(opts)
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

## TODO

TODO: diposing? right now it's not recursive
TODO: name in the constructor?
TODO: what if e.g. material component shared a texture with another one?

## License

MIT, see [LICENSE.md](http://github.com/pex-gl/pex-renderer/blob/master/LICENSE.md) for details.
