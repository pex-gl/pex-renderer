# pex-renderer

[![npm version](https://img.shields.io/npm/v/pex-renderer)](https://www.npmjs.com/package/pex-renderer)
[![stability-stable](https://img.shields.io/badge/stability-stable-green.svg)](https://www.npmjs.com/package/pex-renderer)
[![npm minzipped size](https://img.shields.io/bundlephobia/minzip/pex-renderer)](https://bundlephobia.com/package/pex-renderer)
[![dependencies](https://img.shields.io/librariesio/release/npm/pex-renderer)](https://github.com/pex-gl/pex-renderer/blob/main/package.json)
[![types](https://img.shields.io/npm/types/pex-renderer)](https://github.com/microsoft/TypeScript)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-fa6673.svg)](https://conventionalcommits.org)
[![styled with prettier](https://img.shields.io/badge/styled_with-Prettier-f8bc45.svg?logo=prettier)](https://github.com/prettier/prettier)
[![linted with eslint](https://img.shields.io/badge/linted_with-ES_Lint-4B32C3.svg?logo=eslint)](https://github.com/eslint/eslint)
[![license](https://img.shields.io/github/license/pex-gl/pex-renderer)](https://github.com/pex-gl/pex-renderer/blob/main/LICENSE.md)

Physically Based Renderer (PBR) and scene graph designed as ECS for [PEX](https://pex.gl): define entities to be rendered as collections of components with their update orchestrated by systems.

![](https://raw.githubusercontent.com/pex-gl/pex-renderer/main/screenshot.jpg)

## Installation

```bash
npm install pex-renderer
```

## Usage

```js
import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "pex-renderer";

import createContext from "pex-context";
import { sphere } from "primitive-geometry";

const ctx = createContext({ pixelRatio: devicePixelRatio });
const renderEngine = createRenderEngine({ ctx });

const world = createWorld();

const cameraEntity = createEntity({
  transform: components.transform({ position: [0, 0, 3] }),
  camera: components.camera(),
  orbiter: components.orbiter(),
});
world.add(cameraEntity);

const skyEntity = createEntity({
  skybox: components.skybox({ sunPosition: [1, 0.5, 1] }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const geometryEntity = createEntity({
  transform: components.transform({ position: [0, 0, 0] }),
  geometry: components.geometry(sphere()),
  material: components.material({
    baseColor: [1, 0, 0, 1],
    metallic: 0,
    roughness: 0.5,
  }),
});
world.add(geometryEntity);

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);
});
```

## Architecture

- components are **plain old data** objects
- data lives in components or system caches
- systems are functions
- systems communicate through components
- system order is maintained by the user

## API

<!-- api-start -->

## Modules

<dl>
<dt><a href="#module_pex-renderer">pex-renderer</a></dt>
<dd></dd>
<dt><a href="#module_components">components</a></dt>
<dd></dd>
<dt><a href="#module_systems">systems</a></dt>
<dd></dd>
<dt><a href="#module_renderer">renderer</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#default">default([components])</a> ⇒ <code><a href="#Entity">Entity</a></code></dt>
<dd><p>Create an entity</p>
</dd>
</dl>

## Typedefs

<dl>
<dt><a href="#Entity">Entity</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#AmbientLightComponentOptions">AmbientLightComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#AnimationComponentOptions">AnimationComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#AreaLightComponentOptions">AreaLightComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#AxesHelperComponentOptions">AxesHelperComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#BoundingBoxHelperComponentOptions">BoundingBoxHelperComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#CameraHelperComponentOptions">CameraHelperComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#CameraView">CameraView</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#CameraComponentOptions">CameraComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#DirectionalLightComponentOptions">DirectionalLightComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#GeometryComponentOptions">GeometryComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#GridHelperComponentOptions">GridHelperComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#LightHelperComponentOptions">LightHelperComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#TextureTransform">TextureTransform</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#MaterialComponentOptions">MaterialComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#LineMaterialComponentOptions">LineMaterialComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#MorphComponentOptions">MorphComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#OrbiterComponentOptions">OrbiterComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#OverlayComponentOptions">OverlayComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#PointLightComponentOptions">PointLightComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#SSAOComponentOptions">SSAOComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#DoFComponentOptions">DoFComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#AAComponentOptions">AAComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#FogComponentOptions">FogComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#BloomComponentOptions">BloomComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#LutComponentOptions">LutComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#ColorCorrectionComponentOptions">ColorCorrectionComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#VignetteComponentOptions">VignetteComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#FilmGrainComponentOptions">FilmGrainComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#PostProcessingComponentOptions">PostProcessingComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#ReflectionProbeComponentOptions">ReflectionProbeComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#SkinComponentOptions">SkinComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#SkyboxComponentOptions">SkyboxComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#SpotLightComponentOptions">SpotLightComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#TransformComponentOptions">TransformComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#VertexHelperComponentOptions">VertexHelperComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#SystemOptions">SystemOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#SystemUpdate">SystemUpdate</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#SystemDispose">SystemDispose</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#System">System</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#RenderEngineOptions">RenderEngineOptions</a></dt>
<dd></dd>
<dt><a href="#RenderEngineRender">RenderEngineRender</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#RenderEngineDebug">RenderEngineDebug</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#RenderEngine">RenderEngine</a> : <code><a href="#System">System</a></code></dt>
<dd></dd>
<dt><a href="#RendererSystemRender">RendererSystemRender</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#RendererSystemStageOptions">RendererSystemStageOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#RendererSystemStage">RendererSystemStage</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#RendererSystem">RendererSystem</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#WorldAdd">WorldAdd</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#WorldAddSystem">WorldAddSystem</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#WorldUpdate">WorldUpdate</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#World">World</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#RenderGraph">RenderGraph</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#ResourceCacheUsage">ResourceCacheUsage</a> : <code>&quot;Transient&quot;</code> | <code>&quot;Retained&quot;</code></dt>
<dd></dd>
<dt><a href="#ResourceCache">ResourceCache</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#RenderView">RenderView</a> : <code>object</code></dt>
<dd></dd>
</dl>

<a name="module_pex-renderer"></a>

## pex-renderer

- [pex-renderer](#module_pex-renderer)
  - [.components](#module_pex-renderer.components) : [<code>components</code>](#module_components)
  - [.systems](#module_pex-renderer.systems) : [<code>systems</code>](#module_systems)
  - [.world()](#module_pex-renderer.world) ⇒ [<code>World</code>](#World)
  - [.entity([components])](#module_pex-renderer.entity) ⇒ [<code>Entity</code>](#Entity)
  - [.renderEngine()](#module_pex-renderer.renderEngine) ⇒ [<code>RenderEngine</code>](#RenderEngine)
  - [.renderGraph(ctx)](#module_pex-renderer.renderGraph) ⇒ [<code>RenderGraph</code>](#RenderGraph)
  - [.resourceCache(ctx)](#module_pex-renderer.resourceCache) ⇒ [<code>ResourceCache</code>](#ResourceCache)

<a name="module_pex-renderer.components"></a>

### pex-renderer.components : [<code>components</code>](#module_components)

All components as a function returning a component with default values.

**Kind**: static property of [<code>pex-renderer</code>](#module_pex-renderer)
<a name="module_pex-renderer.systems"></a>

### pex-renderer.systems : [<code>systems</code>](#module_systems)

All systems as a function returning a system with a type property and an update function.

**Kind**: static property of [<code>pex-renderer</code>](#module_pex-renderer)
<a name="module_pex-renderer.world"></a>

### pex-renderer.world() ⇒ [<code>World</code>](#World)

Create a world object to store entities and systems

**Kind**: static method of [<code>pex-renderer</code>](#module_pex-renderer)
<a name="module_pex-renderer.entity"></a>

### pex-renderer.entity([components]) ⇒ [<code>Entity</code>](#Entity)

Create an entity from an object of plain data components

**Kind**: static method of [<code>pex-renderer</code>](#module_pex-renderer)

| Param        | Type                | Default         |
| ------------ | ------------------- | --------------- |
| [components] | <code>object</code> | <code>{}</code> |

<a name="module_pex-renderer.renderEngine"></a>

### pex-renderer.renderEngine() ⇒ [<code>RenderEngine</code>](#RenderEngine)

Create a render engine eg. a collection of systems for default rendering

**Kind**: static method of [<code>pex-renderer</code>](#module_pex-renderer)
<a name="module_pex-renderer.renderGraph"></a>

### pex-renderer.renderGraph(ctx) ⇒ [<code>RenderGraph</code>](#RenderGraph)

Create a render graph for rendering passes

**Kind**: static method of [<code>pex-renderer</code>](#module_pex-renderer)

| Param | Type                                           |
| ----- | ---------------------------------------------- |
| ctx   | <code>module:pex-context/types/index.js</code> |

<a name="module_pex-renderer.resourceCache"></a>

### pex-renderer.resourceCache(ctx) ⇒ [<code>ResourceCache</code>](#ResourceCache)

Create a resource cache for pex-context caching.

**Kind**: static method of [<code>pex-renderer</code>](#module_pex-renderer)

| Param | Type                                           |
| ----- | ---------------------------------------------- |
| ctx   | <code>module:pex-context/types/index.js</code> |

<a name="module_components"></a>

## components

- [components](#module_components)
  - [.ambientLight([options])](#module_components.ambientLight) ⇒ <code>object</code>
  - [.animation([options])](#module_components.animation) ⇒ <code>object</code>
  - [.areaLight([options])](#module_components.areaLight) ⇒ <code>object</code>
  - [.axesHelper([options])](#module_components.axesHelper) ⇒ <code>object</code>
  - [.boundingBoxHelper([options])](#module_components.boundingBoxHelper) ⇒ <code>object</code>
  - [.cameraHelper([options])](#module_components.cameraHelper) ⇒ <code>object</code>
  - [.camera([options])](#module_components.camera) ⇒ <code>object</code>
  - [.directionalLight([options])](#module_components.directionalLight) ⇒ <code>object</code>
  - [.geometry([options])](#module_components.geometry) ⇒ <code>object</code>
  - [.gridHelper([options])](#module_components.gridHelper) ⇒ <code>object</code>
  - [.lightHelper([options])](#module_components.lightHelper) ⇒ <code>object</code>
  - [.material([options])](#module_components.material) ⇒ <code>object</code>
  - [.morph(options)](#module_components.morph) ⇒ <code>object</code>
  - [.orbiter(options)](#module_components.orbiter) ⇒ <code>object</code>
  - [.overlay([options])](#module_components.overlay) ⇒ <code>object</code>
  - [.pointLight([options])](#module_components.pointLight) ⇒ <code>object</code>
  - [.postProcessing([options])](#module_components.postProcessing) ⇒ <code>object</code>
  - [.reflectionProbe([options])](#module_components.reflectionProbe) ⇒ <code>object</code>
  - [.skin([options])](#module_components.skin) ⇒ <code>object</code>
  - [.skybox([options])](#module_components.skybox) ⇒ <code>object</code>
  - [.spotLight([options])](#module_components.spotLight) ⇒ <code>object</code>
  - [.transform([options])](#module_components.transform) ⇒ <code>object</code>
  - [.vertexHelper([options])](#module_components.vertexHelper) ⇒ <code>object</code>

<a name="module_components.ambientLight"></a>

### components.ambientLight([options]) ⇒ <code>object</code>

Ambient light component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                       |
| --------- | -------------------------------------------------------------------------- |
| [options] | [<code>AmbientLightComponentOptions</code>](#AmbientLightComponentOptions) |

<a name="module_components.animation"></a>

### components.animation([options]) ⇒ <code>object</code>

Animation component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| [options] | [<code>AnimationComponentOptions</code>](#AnimationComponentOptions) |

<a name="module_components.areaLight"></a>

### components.areaLight([options]) ⇒ <code>object</code>

Area light component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| [options] | [<code>AreaLightComponentOptions</code>](#AreaLightComponentOptions) |

<a name="module_components.axesHelper"></a>

### components.axesHelper([options]) ⇒ <code>object</code>

Axes helper component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| [options] | [<code>AxesHelperComponentOptions</code>](#AxesHelperComponentOptions) |

<a name="module_components.boundingBoxHelper"></a>

### components.boundingBoxHelper([options]) ⇒ <code>object</code>

Bounding box helper component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| [options] | [<code>BoundingBoxHelperComponentOptions</code>](#BoundingBoxHelperComponentOptions) |

<a name="module_components.cameraHelper"></a>

### components.cameraHelper([options]) ⇒ <code>object</code>

Camera helper component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                       |
| --------- | -------------------------------------------------------------------------- |
| [options] | [<code>CameraHelperComponentOptions</code>](#CameraHelperComponentOptions) |

<a name="module_components.camera"></a>

### components.camera([options]) ⇒ <code>object</code>

Camera component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                           |
| --------- | -------------------------------------------------------------- |
| [options] | [<code>CameraComponentOptions</code>](#CameraComponentOptions) |

<a name="module_components.directionalLight"></a>

### components.directionalLight([options]) ⇒ <code>object</code>

Directional light component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                               |
| --------- | ---------------------------------------------------------------------------------- |
| [options] | [<code>DirectionalLightComponentOptions</code>](#DirectionalLightComponentOptions) |

<a name="module_components.geometry"></a>

### components.geometry([options]) ⇒ <code>object</code>

Geometry component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                               |
| --------- | ------------------------------------------------------------------ |
| [options] | [<code>GeometryComponentOptions</code>](#GeometryComponentOptions) |

<a name="module_components.gridHelper"></a>

### components.gridHelper([options]) ⇒ <code>object</code>

Grid helper component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| [options] | [<code>GridHelperComponentOptions</code>](#GridHelperComponentOptions) |

<a name="module_components.lightHelper"></a>

### components.lightHelper([options]) ⇒ <code>object</code>

Light helper component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                     |
| --------- | ------------------------------------------------------------------------ |
| [options] | [<code>LightHelperComponentOptions</code>](#LightHelperComponentOptions) |

<a name="module_components.material"></a>

### components.material([options]) ⇒ <code>object</code>

Material component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [options] | [<code>MaterialComponentOptions</code>](#MaterialComponentOptions) \| [<code>LineMaterialComponentOptions</code>](#LineMaterialComponentOptions) |

<a name="module_components.morph"></a>

### components.morph(options) ⇒ <code>object</code>

Morph component

**Kind**: static method of [<code>components</code>](#module_components)

| Param   | Type                                                         |
| ------- | ------------------------------------------------------------ |
| options | [<code>MorphComponentOptions</code>](#MorphComponentOptions) |

<a name="module_components.orbiter"></a>

### components.orbiter(options) ⇒ <code>object</code>

Orbiter component

**Kind**: static method of [<code>components</code>](#module_components)

| Param   | Type                                                             |
| ------- | ---------------------------------------------------------------- |
| options | [<code>OrbiterComponentOptions</code>](#OrbiterComponentOptions) |

<a name="module_components.overlay"></a>

### components.overlay([options]) ⇒ <code>object</code>

Overlay component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                             |
| --------- | ---------------------------------------------------------------- |
| [options] | [<code>OverlayComponentOptions</code>](#OverlayComponentOptions) |

<a name="module_components.pointLight"></a>

### components.pointLight([options]) ⇒ <code>object</code>

Point light component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| [options] | [<code>PointLightComponentOptions</code>](#PointLightComponentOptions) |

<a name="module_components.postProcessing"></a>

### components.postProcessing([options]) ⇒ <code>object</code>

Post Processing component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| [options] | [<code>PostProcessingComponentOptions</code>](#PostProcessingComponentOptions) |

<a name="module_components.reflectionProbe"></a>

### components.reflectionProbe([options]) ⇒ <code>object</code>

Reflection probe component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| [options] | [<code>ReflectionProbeComponentOptions</code>](#ReflectionProbeComponentOptions) |

<a name="module_components.skin"></a>

### components.skin([options]) ⇒ <code>object</code>

Skin component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                       |
| --------- | ---------------------------------------------------------- |
| [options] | [<code>SkinComponentOptions</code>](#SkinComponentOptions) |

<a name="module_components.skybox"></a>

### components.skybox([options]) ⇒ <code>object</code>

Skybox component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                           |
| --------- | -------------------------------------------------------------- |
| [options] | [<code>SkyboxComponentOptions</code>](#SkyboxComponentOptions) |

<a name="module_components.spotLight"></a>

### components.spotLight([options]) ⇒ <code>object</code>

Spot light component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| [options] | [<code>SpotLightComponentOptions</code>](#SpotLightComponentOptions) |

<a name="module_components.transform"></a>

### components.transform([options]) ⇒ <code>object</code>

Transform component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| [options] | [<code>TransformComponentOptions</code>](#TransformComponentOptions) |

<a name="module_components.vertexHelper"></a>

### components.vertexHelper([options]) ⇒ <code>object</code>

Vertex helper component

**Kind**: static method of [<code>components</code>](#module_components)

| Param     | Type                                                                       |
| --------- | -------------------------------------------------------------------------- |
| [options] | [<code>VertexHelperComponentOptions</code>](#VertexHelperComponentOptions) |

<a name="module_systems"></a>

## systems

- [systems](#module_systems)
  - [.renderer](#module_systems.renderer) : [<code>renderer</code>](#module_renderer)
  - [.animation()](#module_systems.animation) ⇒ [<code>System</code>](#System)
  - [.camera()](#module_systems.camera) ⇒ [<code>System</code>](#System)
  - [.geometry(options)](#module_systems.geometry) ⇒ [<code>System</code>](#System)
  - [.layer()](#module_systems.layer) ⇒ [<code>System</code>](#System)
  - [.light()](#module_systems.light) ⇒ [<code>System</code>](#System)
  - [.morph()](#module_systems.morph) ⇒ [<code>System</code>](#System)
  - [.reflectionProbe(options)](#module_systems.reflectionProbe) ⇒ [<code>System</code>](#System)
  - [.skin()](#module_systems.skin) ⇒ [<code>System</code>](#System)
  - [.skybox(options)](#module_systems.skybox) ⇒ [<code>System</code>](#System)
  - [.transform()](#module_systems.transform) ⇒ [<code>System</code>](#System)
  - [.renderPipeline(options)](#module_systems.renderPipeline) ⇒ [<code>System</code>](#System)

<a name="module_systems.renderer"></a>

### systems.renderer : [<code>renderer</code>](#module_renderer)

All renderer systems

**Kind**: static property of [<code>systems</code>](#module_systems)
<a name="module_systems.animation"></a>

### systems.animation() ⇒ [<code>System</code>](#System)

Animation system

**Kind**: static method of [<code>systems</code>](#module_systems)
<a name="module_systems.camera"></a>

### systems.camera() ⇒ [<code>System</code>](#System)

Camera system

Adds:

- "\_orbiter" to orbiter components

**Kind**: static method of [<code>systems</code>](#module_systems)
<a name="module_systems.geometry"></a>

### systems.geometry(options) ⇒ [<code>System</code>](#System)

Geometry system

Adds:

- "bounds" to geometry components
- "dirty" to geometry components properties
- "\_geometry" to entities as reference to internal cache

**Kind**: static method of [<code>systems</code>](#module_systems)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="module_systems.layer"></a>

### systems.layer() ⇒ [<code>System</code>](#System)

Layer system

**Kind**: static method of [<code>systems</code>](#module_systems)
<a name="module_systems.light"></a>

### systems.light() ⇒ [<code>System</code>](#System)

Light system

Adds:

- "\_projectionMatrix" and "\_viewMatrix" to light components
- "\_direction" to directional and spot light components

**Kind**: static method of [<code>systems</code>](#module_systems)
<a name="module_systems.morph"></a>

### systems.morph() ⇒ [<code>System</code>](#System)

Morph system

**Kind**: static method of [<code>systems</code>](#module_systems)
<a name="module_systems.reflectionProbe"></a>

### systems.reflectionProbe(options) ⇒ [<code>System</code>](#System)

Reflection Probe system

Adds:

- "\_reflectionProbe" to reflectionProbe components

**Kind**: static method of [<code>systems</code>](#module_systems)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="module_systems.skin"></a>

### systems.skin() ⇒ [<code>System</code>](#System)

Skin system

**Kind**: static method of [<code>systems</code>](#module_systems)
<a name="module_systems.skybox"></a>

### systems.skybox(options) ⇒ [<code>System</code>](#System)

Skybox system

Adds:

- "\_skyTexture" to skybox components with no envMap for skybox-renderer to render
- "\_skyTextureChanged" to skybox components for reflection-probe system

**Kind**: static method of [<code>systems</code>](#module_systems)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="module_systems.transform"></a>

### systems.transform() ⇒ [<code>System</code>](#System)

Transform system

Adds:

- "worldBounds", "dirty" and "aabbDirty" to transform components
- "\_transform" to entities as reference to internal cache

**Kind**: static method of [<code>systems</code>](#module_systems)
<a name="module_systems.renderPipeline"></a>

### systems.renderPipeline(options) ⇒ [<code>System</code>](#System)

Render pipeline system

Adds:

- "\_near", "\_far", "\_radiusUV" and "\_sceneBboxInLightSpace" to light components that cast shadows
- "\_shadowCubemap" to pointLight components and "\_shadowMap" to other light components
- "\_targets" to postProcessing components

**Kind**: static method of [<code>systems</code>](#module_systems)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="module_renderer"></a>

## renderer

- [renderer](#module_renderer)
  - [.base()](#module_renderer.base) ⇒ [<code>RendererSystem</code>](#RendererSystem)
  - [.basic(options)](#module_renderer.basic) ⇒ [<code>RendererSystem</code>](#RendererSystem)
  - [.helper(options)](#module_renderer.helper) ⇒ [<code>RendererSystem</code>](#RendererSystem)
  - [.line(options)](#module_renderer.line) ⇒ [<code>RendererSystem</code>](#RendererSystem)
  - [.skybox(options)](#module_renderer.skybox) ⇒ [<code>RendererSystem</code>](#RendererSystem)
  - [.standard(options)](#module_renderer.standard) ⇒ [<code>RendererSystem</code>](#RendererSystem)

<a name="module_renderer.base"></a>

### renderer.base() ⇒ [<code>RendererSystem</code>](#RendererSystem)

Base renderer

All renderers are composed with it.

**Kind**: static method of [<code>renderer</code>](#module_renderer)
<a name="module_renderer.basic"></a>

### renderer.basic(options) ⇒ [<code>RendererSystem</code>](#RendererSystem)

Basic renderer

**Kind**: static method of [<code>renderer</code>](#module_renderer)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="module_renderer.helper"></a>

### renderer.helper(options) ⇒ [<code>RendererSystem</code>](#RendererSystem)

Helper renderer

**Kind**: static method of [<code>renderer</code>](#module_renderer)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="module_renderer.line"></a>

### renderer.line(options) ⇒ [<code>RendererSystem</code>](#RendererSystem)

Line renderer

**Kind**: static method of [<code>renderer</code>](#module_renderer)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="module_renderer.skybox"></a>

### renderer.skybox(options) ⇒ [<code>RendererSystem</code>](#RendererSystem)

Skybox renderer

Renders a skybox (envMap or \_skyTexture) to screen or to reflection probes.

**Kind**: static method of [<code>renderer</code>](#module_renderer)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="module_renderer.standard"></a>

### renderer.standard(options) ⇒ [<code>RendererSystem</code>](#RendererSystem)

Standard renderer

**Kind**: static method of [<code>renderer</code>](#module_renderer)

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="default"></a>

## default([components]) ⇒ [<code>Entity</code>](#Entity)

Create an entity

**Kind**: global function

| Param        | Type                           |
| ------------ | ------------------------------ |
| [components] | [<code>Entity</code>](#Entity) |

<a name="Entity"></a>

## Entity : <code>object</code>

**Kind**: global typedef
**Properties**

| Name                | Type                                                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                  | <code>number</code>                                                                                                                                        |
| [ambientLight]      | [<code>AmbientLightComponentOptions</code>](#AmbientLightComponentOptions)                                                                                 |
| [animation]         | [<code>AnimationComponentOptions</code>](#AnimationComponentOptions) \| [<code>Array.&lt;AnimationComponentOptions&gt;</code>](#AnimationComponentOptions) |
| [areaLight]         | [<code>AreaLightComponentOptions</code>](#AreaLightComponentOptions)                                                                                       |
| [axesHelper]        | [<code>AxesHelperComponentOptions</code>](#AxesHelperComponentOptions)                                                                                     |
| [boundingBoxHelper] | [<code>BoundingBoxHelperComponentOptions</code>](#BoundingBoxHelperComponentOptions)                                                                       |
| [cameraHelper]      | [<code>CameraHelperComponentOptions</code>](#CameraHelperComponentOptions)                                                                                 |
| [camera]            | [<code>CameraComponentOptions</code>](#CameraComponentOptions)                                                                                             |
| [directionalLight]  | [<code>DirectionalLightComponentOptions</code>](#DirectionalLightComponentOptions)                                                                         |
| [geometry]          | [<code>GeometryComponentOptions</code>](#GeometryComponentOptions)                                                                                         |
| [gridHelper]        | [<code>GridHelperComponentOptions</code>](#GridHelperComponentOptions)                                                                                     |
| [lightHelper]       | [<code>LightHelperComponentOptions</code>](#LightHelperComponentOptions)                                                                                   |
| [material]          | [<code>MaterialComponentOptions</code>](#MaterialComponentOptions)                                                                                         |
| [morph]             | [<code>MorphComponentOptions</code>](#MorphComponentOptions)                                                                                               |
| [orbiter]           | [<code>OrbiterComponentOptions</code>](#OrbiterComponentOptions)                                                                                           |
| [overlay]           | [<code>OverlayComponentOptions</code>](#OverlayComponentOptions)                                                                                           |
| [pointLight]        | [<code>PointLightComponentOptions</code>](#PointLightComponentOptions)                                                                                     |
| [postProcessing]    | [<code>PostProcessingComponentOptions</code>](#PostProcessingComponentOptions)                                                                             |
| [reflectionProbe]   | [<code>ReflectionProbeComponentOptions</code>](#ReflectionProbeComponentOptions)                                                                           |
| [skin]              | [<code>SkinComponentOptions</code>](#SkinComponentOptions)                                                                                                 |
| [skybox]            | [<code>SkyboxComponentOptions</code>](#SkyboxComponentOptions)                                                                                             |
| [spotLight]         | [<code>SpotLightComponentOptions</code>](#SpotLightComponentOptions)                                                                                       |
| [transform]         | [<code>TransformComponentOptions</code>](#TransformComponentOptions)                                                                                       |
| [vertexHelper]      | [<code>VertexHelperComponentOptions</code>](#VertexHelperComponentOptions)                                                                                 |

<a name="AmbientLightComponentOptions"></a>

## AmbientLightComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name    | Type                              | Default                   |
| ------- | --------------------------------- | ------------------------- |
| [color] | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code> |

<a name="AnimationComponentOptions"></a>

## AnimationComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name       | Type                 | Default            |
| ---------- | -------------------- | ------------------ |
| [playing]  | <code>boolean</code> | <code>false</code> |
| [loop]     | <code>boolean</code> | <code>false</code> |
| [time]     | <code>number</code>  | <code>0</code>     |
| [channels] | <code>Array</code>   | <code>[]</code>    |

<a name="AreaLightComponentOptions"></a>

## AreaLightComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name            | Type                              | Default                   |
| --------------- | --------------------------------- | ------------------------- |
| [color]         | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code> |
| [intensity]     | <code>number</code>               | <code>1</code>            |
| [disk]          | <code>boolean</code>              | <code>false</code>        |
| [doubleSided]   | <code>boolean</code>              | <code>false</code>        |
| [bias]          | <code>number</code>               | <code>0.1</code>          |
| [bulbRadius]    | <code>number</code>               | <code>1</code>            |
| [castShadows]   | <code>boolean</code>              | <code>true</code>         |
| [shadowMapSize] | <code>number</code>               | <code>2048</code>         |

<a name="AxesHelperComponentOptions"></a>

## AxesHelperComponentOptions : <code>object</code>

**Kind**: global typedef
<a name="BoundingBoxHelperComponentOptions"></a>

## BoundingBoxHelperComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name    | Type                              | Default                   |
| ------- | --------------------------------- | ------------------------- |
| [color] | <code>Array.&lt;number&gt;</code> | <code>[1, 0, 0, 1]</code> |

<a name="CameraHelperComponentOptions"></a>

## CameraHelperComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name    | Type                              | Default                   |
| ------- | --------------------------------- | ------------------------- |
| [color] | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code> |

<a name="CameraView"></a>

## CameraView : <code>object</code>

**Kind**: global typedef
**Properties**

| Name        | Type                              |
| ----------- | --------------------------------- |
| [totalSize] | <code>Array.&lt;number&gt;</code> |
| [size]      | <code>Array.&lt;number&gt;</code> |
| [offset]    | <code>Array.&lt;number&gt;</code> |

<a name="CameraComponentOptions"></a>

## CameraComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name             | Type                                                                                                                                                                                                                                                                                          | Default                              | Description                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| [projection]     | <code>&quot;perspective&quot;</code> \| <code>&quot;orthographic&quot;</code>                                                                                                                                                                                                                 | <code>&quot;perspective&quot;</code> |                                                                        |
| [near]           | <code>number</code>                                                                                                                                                                                                                                                                           | <code>0.5</code>                     |                                                                        |
| [far]            | <code>number</code>                                                                                                                                                                                                                                                                           | <code>1000</code>                    |                                                                        |
| [aspect]         | <code>number</code>                                                                                                                                                                                                                                                                           | <code>1</code>                       |                                                                        |
| [clearColor]     | <code>module:pex-color~color</code>                                                                                                                                                                                                                                                           |                                      |                                                                        |
| [viewMatrix]     | <code>mat4</code>                                                                                                                                                                                                                                                                             |                                      |                                                                        |
| [invViewMatrix]  | <code>mat4</code>                                                                                                                                                                                                                                                                             |                                      |                                                                        |
| [culling]        | <code>boolean</code>                                                                                                                                                                                                                                                                          | <code>false</code>                   |                                                                        |
| [exposure]       | <code>number</code>                                                                                                                                                                                                                                                                           | <code>1</code>                       |                                                                        |
| [toneMap]        | <code>&quot;aces&quot;</code> \| <code>&quot;filmic&quot;</code> \| <code>&quot;lottes&quot;</code> \| <code>&quot;reinhard&quot;</code> \| <code>&quot;reinhard2&quot;</code> \| <code>&quot;uchimura&quot;</code> \| <code>&quot;uncharted2&quot;</code> \| <code>&quot;unreal&quot;</code> | <code>&quot;aces&quot;</code>        |                                                                        |
| [outputEncoding] | <code>number</code>                                                                                                                                                                                                                                                                           | <code>ctx.Encoding.Gamma</code>      |                                                                        |
| [focalLength]    | <code>number</code>                                                                                                                                                                                                                                                                           | <code>50</code>                      | Focal length of the camera lens [10mm - 200mm] in mm                   |
| [fStop]          | <code>number</code>                                                                                                                                                                                                                                                                           | <code>2.8</code>                     | Ratio of camera lens opening, f-number, f/N, aperture [1.2 - 32] in mm |
| [sensorSize]     | <code>number</code>                                                                                                                                                                                                                                                                           | <code>[36, 24]</code>                | Physical camera sensor or film size [sensorWidth, sensorHeight] in mm  |
| sensorFit        | <code>&quot;vertical&quot;</code> \| <code>&quot;horizontal&quot;</code> \| <code>&quot;fit&quot;</code> \| <code>&quot;overscan&quot;</code> \| <code>&quot;vertical&quot;</code>                                                                                                            |                                      | Matching of camera frame to sensor frame                               |
| [view]           | [<code>CameraView</code>](#CameraView)                                                                                                                                                                                                                                                        |                                      |                                                                        |
| [fov]            | <code>number</code>                                                                                                                                                                                                                                                                           | <code>Math.PI / 4</code>             |                                                                        |
| [left]           | <code>number</code>                                                                                                                                                                                                                                                                           | <code>-1</code>                      |                                                                        |
| [right]          | <code>number</code>                                                                                                                                                                                                                                                                           | <code>1</code>                       |                                                                        |
| [bottom]         | <code>number</code>                                                                                                                                                                                                                                                                           | <code>-1</code>                      |                                                                        |
| [top]            | <code>number</code>                                                                                                                                                                                                                                                                           | <code>1</code>                       |                                                                        |
| [zoom]           | <code>number</code>                                                                                                                                                                                                                                                                           | <code>1</code>                       |                                                                        |

<a name="DirectionalLightComponentOptions"></a>

## DirectionalLightComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name            | Type                              | Default                   |
| --------------- | --------------------------------- | ------------------------- |
| [color]         | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code> |
| [intensity]     | <code>number</code>               | <code>1</code>            |
| [bias]          | <code>number</code>               | <code>0.1</code>          |
| [bulbRadius]    | <code>number</code>               | <code>1</code>            |
| [castShadows]   | <code>boolean</code>              | <code>true</code>         |
| [shadowMapSize] | <code>number</code>               | <code>2048</code>         |

<a name="GeometryComponentOptions"></a>

## GeometryComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name           | Type                                                 | Default                              | Description                 |
| -------------- | ---------------------------------------------------- | ------------------------------------ | --------------------------- |
| [positions]    | <code>Float32Array</code>                            |                                      |                             |
| [normals]      | <code>Float32Array</code>                            |                                      |                             |
| [uvs]          | <code>Float32Array</code>                            |                                      | Alias: texCoords/texCoords0 |
| [uvs1]         | <code>Float32Array</code>                            |                                      | Alias: texCoords1           |
| [vertexColors] | <code>Float32Array</code>                            |                                      |                             |
| [cells]        | <code>Uint16Array</code> \| <code>Uint32Array</code> |                                      |                             |
| [weights]      | <code>Float32Array</code>                            |                                      |                             |
| [joints]       | <code>Float32Array</code>                            |                                      |                             |
| [offsets]      | <code>Float32Array</code>                            |                                      | Instanced                   |
| [rotations]    | <code>Float32Array</code>                            |                                      | Instanced                   |
| [scales]       | <code>Float32Array</code>                            |                                      | Instanced                   |
| [colors]       | <code>Float32Array</code>                            |                                      | Instanced                   |
| [count]        | <code>number</code>                                  |                                      |                             |
| [multiDraw]    | <code>object</code>                                  |                                      |                             |
| [culled]       | <code>boolean</code>                                 |                                      |                             |
| [primitive]    | <code>ctx.Primitive</code>                           | <code>ctx.Primitive.Triangles</code> |                             |

<a name="GridHelperComponentOptions"></a>

## GridHelperComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name    | Type                              | Default                   |
| ------- | --------------------------------- | ------------------------- |
| [color] | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code> |
| [size]  | <code>Array.&lt;number&gt;</code> | <code>10</code>           |

<a name="LightHelperComponentOptions"></a>

## LightHelperComponentOptions : <code>object</code>

**Kind**: global typedef
<a name="TextureTransform"></a>

## TextureTransform : <code>object</code>

**Kind**: global typedef
**Properties**

| Name       | Type                              | Description      |
| ---------- | --------------------------------- | ---------------- |
| [offset]   | <code>Array.&lt;number&gt;</code> | [x, y]           |
| [rotation] | <code>number</code>               | angle in radians |
| [scales]   | <code>Array.&lt;number&gt;</code> | [x, y]           |

<a name="MaterialComponentOptions"></a>

## MaterialComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name                          | Type                                                                             | Default                            |
| ----------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- |
| [unlit]                       | <code>boolean</code>                                                             |                                    |
| [type]                        | <code>undefined</code> \| <code>&quot;line&quot;</code>                          | <code>&quot;undefined&quot;</code> |
| [baseColor]                   | <code>Array.&lt;number&gt;</code>                                                | <code>[1, 1, 1, 1]</code>          |
| [emissiveColor]               | <code>Array.&lt;number&gt;</code>                                                | <code>&quot;undefined&quot;</code> |
| [emissiveIntensity]           | <code>number</code>                                                              | <code>1</code>                     |
| [metallic]                    | <code>number</code>                                                              | <code>1</code>                     |
| [roughness]                   | <code>number</code>                                                              | <code>1</code>                     |
| [ior]                         | <code>number</code>                                                              |                                    |
| [specular]                    | <code>number</code>                                                              |                                    |
| [specularTexture]             | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [specularColor]               | <code>Array.&lt;number&gt;</code>                                                | <code>[1, 1, 1]</code>             |
| [specularColorTexture]        | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [baseColorTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [emissiveColorTexture]        | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [normalTexture]               | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [normalTextureScale]          | <code>number</code>                                                              | <code>1</code>                     |
| [roughnessTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [metallicTexture]             | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [metallicRoughnessTexture]    | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [occlusionTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [clearCoat]                   | <code>number</code>                                                              |                                    |
| [clearCoatRoughness]          | <code>number</code>                                                              |                                    |
| [clearCoatTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [clearCoatRoughnessTexture]   | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [clearCoatNormalTexture]      | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [clearCoatNormalTextureScale] | <code>number</code>                                                              |                                    |
| [sheenColor]                  | <code>Array.&lt;number&gt;</code>                                                |                                    |
| [sheenRoughness]              | <code>number</code>                                                              |                                    |
| [transmission]                | <code>number</code>                                                              |                                    |
| [transmissionTexture]         | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [thickness]                   | <code>number</code>                                                              |                                    |
| [thicknessTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [attenuationDistance]         | <code>number</code>                                                              |                                    |
| [attenuationColor]            | <code>Array.&lt;number&gt;</code>                                                |                                    |
| [dispersion]                  | <code>number</code>                                                              |                                    |
| [alphaTest]                   | <code>number</code>                                                              | <code>&quot;undefined&quot;</code> |
| [alphaTexture]                | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |
| [depthTest]                   | <code>boolean</code>                                                             | <code>true</code>                  |
| [depthWrite]                  | <code>boolean</code>                                                             | <code>true</code>                  |
| [depthFunc]                   | <code>ctx.DepthFunc</code>                                                       | <code>ctx.DepthFunc.Less</code>    |
| [blend]                       | <code>boolean</code>                                                             | <code>false</code>                 |
| [blendSrcRGBFactor]           | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |
| [blendSrcAlphaFactor]         | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |
| [blendDstRGBFactor]           | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |
| [blendDstAlphaFactor]         | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |
| [cullFace]                    | <code>boolean</code>                                                             | <code>true</code>                  |
| [cullFaceMode]                | <code>ctx.Face</code>                                                            | <code>ctx.Face.Back</code>         |
| [pointSize]                   | <code>number</code>                                                              | <code>1</code>                     |
| [castShadows]                 | <code>boolean</code>                                                             | <code>false</code>                 |
| [receiveShadows]              | <code>boolean</code>                                                             | <code>false</code>                 |

<a name="LineMaterialComponentOptions"></a>

## LineMaterialComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name             | Type                              | Default                       |
| ---------------- | --------------------------------- | ----------------------------- |
| [type]           | <code>&quot;line&quot;</code>     | <code>&quot;line&quot;</code> |
| [baseColor]      | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code>     |
| [lineWidth]      | <code>number</code>               | <code>1</code>                |
| [lineResolution] | <code>number</code>               | <code>16</code>               |

<a name="MorphComponentOptions"></a>

## MorphComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name      | Type                | Default         |
| --------- | ------------------- | --------------- |
| sources   | <code>object</code> |                 |
| targets   | <code>object</code> |                 |
| [current] | <code>object</code> |                 |
| [weights] | <code>Array</code>  | <code>[]</code> |

<a name="OrbiterComponentOptions"></a>

## OrbiterComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name       | Type                              | Default                    |
| ---------- | --------------------------------- | -------------------------- |
| [element]  | <code>HTMLElement</code>          | <code>document.body</code> |
| [target]   | <code>Array.&lt;number&gt;</code> | <code>[0, 0, 0]</code>     |
| [lat]      | <code>number</code>               | <code>0</code>             |
| [lon]      | <code>number</code>               | <code>0</code>             |
| [distance] | <code>number</code>               | <code>0</code>             |

<a name="OverlayComponentOptions"></a>

## OverlayComponentOptions : <code>object</code>

**Kind**: global typedef
<a name="PointLightComponentOptions"></a>

## PointLightComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name            | Type                              | Default                   |
| --------------- | --------------------------------- | ------------------------- |
| [color]         | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code> |
| [intensity]     | <code>number</code>               | <code>1</code>            |
| [range]         | <code>number</code>               | <code>10</code>           |
| [bulbRadius]    | <code>number</code>               | <code>1</code>            |
| [castShadows]   | <code>boolean</code>              | <code>true</code>         |
| [shadowMapSize] | <code>number</code>               | <code>2048</code>         |

<a name="SSAOComponentOptions"></a>

## SSAOComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name                   | Type                                                          | Default                                | Description |
| ---------------------- | ------------------------------------------------------------- | -------------------------------------- | ----------- |
| [type]                 | <code>&quot;sao&quot;</code> \| <code>&quot;gtao&quot;</code> | <code>&quot;sao&quot;</code>           |             |
| [noiseTexture]         | <code>boolean</code>                                          | <code>true</code>                      |             |
| [mix]                  | <code>number</code>                                           | <code>1</code>                         |             |
| [samples]              | <code>number</code>                                           | <code>&quot;gtao&quot; ? 6 : 11</code> |             |
| [intensity]            | <code>number</code>                                           | <code>2.2</code>                       |             |
| [radius]               | <code>number</code>                                           | <code>0.5</code>                       | meters      |
| [blurRadius]           | <code>number</code>                                           | <code>0.5</code>                       |             |
| [blurSharpness]        | <code>number</code>                                           | <code>10</code>                        |             |
| [brightness]           | <code>number</code>                                           | <code>0</code>                         |             |
| [contrast]             | <code>number</code>                                           | <code>1</code>                         | // SSAO     |
| [bias]                 | <code>number</code>                                           | <code>0.001</code>                     | centimeters |
| [spiralTurns]          | <code>number</code>                                           | <code>7</code>                         | // GTAO     |
| [slices]               | <code>number</code>                                           | <code>3</code>                         |             |
| [colorBounce]          | <code>number</code>                                           | <code>true</code>                      |             |
| [colorBounceIntensity] | <code>number</code>                                           | <code>1.0</code>                       |             |

<a name="DoFComponentOptions"></a>

## DoFComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name                  | Type                                                                   | Default                             | Description                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type]                | <code>&quot;gustafsson&quot;</code> \| <code>&quot;upitis&quot;</code> | <code>&quot;gustafsson&quot;</code> | Gustafsson uses a spiral pattern while Upitis uses a circular one.                                                                                                                                                         |
| [physical]            | <code>boolean</code>                                                   | <code>true</code>                   | Use camera f-stop and focal length                                                                                                                                                                                         |
| [focusDistance]       | <code>number</code>                                                    | <code>7</code>                      | The point to focus on in meters.                                                                                                                                                                                           |
| [focusScale]          | <code>number</code>                                                    | <code>1</code>                      | Non physically based value for artistic control when physical is false, otherwise act as an fStop divider. Larger aperture (ie, smaller f-stop) or larger focal length (smaller fov) = smaller depth of field = more blur. |
| [focusOnScreenPoint]  | <code>boolean</code>                                                   | <code>false</code>                  | Read the depth buffer to find the first intersecting object to focus on instead of a fixed focus distance.                                                                                                                 |
| [screenPoint]         | <code>Array.&lt;number&gt;</code>                                      | <code>[0.5, 0.5]</code>             | The normalized screen point to focus on when "focusOnScreenPoint" is true.                                                                                                                                                 |
| [chromaticAberration] | <code>number</code>                                                    | <code>0.7</code>                    | Amount of RGB separation                                                                                                                                                                                                   |
| [luminanceThreshold]  | <code>number</code>                                                    | <code>0.7</code>                    | Threshold for out of focus hightlights                                                                                                                                                                                     |
| [luminanceGain]       | <code>number</code>                                                    | <code>1</code>                      | Gain for out of focus hightlights                                                                                                                                                                                          |
| [samples]             | <code>number</code>                                                    | <code>6</code>                      | Iteration steps. More steps means better blur but also degraded performances.                                                                                                                                              |
| [shape]               | <code>&quot;disk&quot;</code> \| <code>&quot;pentagon&quot;</code>     | <code>&quot;disk&quot;</code>       | The bokeh shape for type "upitis".                                                                                                                                                                                         |
| [debug]               | <code>boolean</code>                                                   | <code>false</code>                  |                                                                                                                                                                                                                            |

<a name="AAComponentOptions"></a>

## AAComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name      | Type                                                             | Default                        | Description       |
| --------- | ---------------------------------------------------------------- | ------------------------------ | ----------------- |
| [type]    | <code>&quot;fxaa2&quot;</code> \| <code>&quot;fxaa3&quot;</code> | <code>&quot;fxaa2&quot;</code> |                   |
| [spanMax] | <code>number</code>                                              | <code>8</code>                 | For "fxaa2" only. |

<a name="FogComponentOptions"></a>

## FogComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name                 | Type                              | Default                        |
| -------------------- | --------------------------------- | ------------------------------ |
| [color]              | <code>Array.&lt;number&gt;</code> | <code>[0.5, 0.5, 0.5]</code>   |
| [start]              | <code>number</code>               | <code>5</code>                 |
| [density]            | <code>number</code>               | <code>0.15</code>              |
| [sunPosition]        | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1]</code>         |
| [sunDispertion]      | <code>number</code>               | <code>0.2</code>               |
| [sunIntensity]       | <code>number</code>               | <code>0.1</code>               |
| [sunColor]           | <code>Array.&lt;number&gt;</code> | <code>[0.98, 0.98, 0.7]</code> |
| [inscatteringCoeffs] | <code>Array.&lt;number&gt;</code> | <code>[0.3, 0.3, 0.3]</code>   |

<a name="BloomComponentOptions"></a>

## BloomComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name            | Type                                                                                                    | Default                        | Description                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| [quality]       | <code>number</code>                                                                                     | <code>1</code>                 | The bloom quality: 0 or 1 (0 is faster but flickers)                        |
| [colorFunction] | <code>&quot;luma&quot;</code> \| <code>&quot;luminance&quot;</code> \| <code>&quot;average&quot;</code> | <code>&quot;luma&quot;</code>  | The function used to determine the brightness of a pixel for the threshold. |
| [threshold]     | <code>number</code>                                                                                     | <code>1</code>                 | The brightness value at which pixels are filtered out for the threshold.    |
| [source]        | <code>&quot;color&quot;</code> \| <code>&quot;emissive&quot;</code>                                     | <code>&quot;color&quot;</code> | The source texture for the threshold.                                       |
| [intensity]     | <code>number</code>                                                                                     | <code>0.1</code>               | The strength of the bloom effect.                                           |
| [radius]        | <code>number</code>                                                                                     | <code>1</code>                 | The downsampling radius which controls how much glare gets blended in.      |

<a name="LutComponentOptions"></a>

## LutComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name    | Type                       |
| ------- | -------------------------- |
| texture | <code>ctx.texture2D</code> |

<a name="ColorCorrectionComponentOptions"></a>

## ColorCorrectionComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name         | Type                | Default        |
| ------------ | ------------------- | -------------- |
| [brightness] | <code>number</code> | <code>0</code> |
| [contrast]   | <code>number</code> | <code>1</code> |
| [saturation] | <code>number</code> | <code>1</code> |
| [hue]        | <code>number</code> | <code>0</code> |

<a name="VignetteComponentOptions"></a>

## VignetteComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name        | Type                | Default          |
| ----------- | ------------------- | ---------------- |
| [radius]    | <code>number</code> | <code>0.8</code> |
| [intensity] | <code>number</code> | <code>0.2</code> |

<a name="FilmGrainComponentOptions"></a>

## FilmGrainComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name                 | Type                | Default           |
| -------------------- | ------------------- | ----------------- |
| [quality]            | <code>number</code> | <code>2</code>    |
| [size]               | <code>number</code> | <code>1.6</code>  |
| [intensity]          | <code>number</code> | <code>0.05</code> |
| [colorIntensity]     | <code>number</code> | <code>0.6</code>  |
| [luminanceIntensity] | <code>number</code> | <code>1</code>    |
| [speed]              | <code>number</code> | <code>0.5</code>  |

<a name="PostProcessingComponentOptions"></a>

## PostProcessingComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name              | Type                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| [ssao]            | [<code>SSAOComponentOptions</code>](#SSAOComponentOptions)                       |
| [dof]             | [<code>DoFComponentOptions</code>](#DoFComponentOptions)                         |
| [aa]              | [<code>AAComponentOptions</code>](#AAComponentOptions)                           |
| [fog]             | [<code>FogComponentOptions</code>](#FogComponentOptions)                         |
| [bloom]           | [<code>BloomComponentOptions</code>](#BloomComponentOptions)                     |
| [lut]             | [<code>LutComponentOptions</code>](#LutComponentOptions)                         |
| [colorCorrection] | [<code>ColorCorrectionComponentOptions</code>](#ColorCorrectionComponentOptions) |
| [vignette]        | [<code>VignetteComponentOptions</code>](#VignetteComponentOptions)               |
| [filmGrain]       | [<code>FilmGrainComponentOptions</code>](#FilmGrainComponentOptions)             |
| opacity           | <code>number</code>                                                              |

<a name="ReflectionProbeComponentOptions"></a>

## ReflectionProbeComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name   | Type                | Default           |
| ------ | ------------------- | ----------------- |
| [size] | <code>number</code> | <code>1024</code> |

<a name="SkinComponentOptions"></a>

## SkinComponentOptions : <code>object</code>

**Kind**: global typedef
<a name="SkyboxComponentOptions"></a>

## SkyboxComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name              | Type                              | Default            |
| ----------------- | --------------------------------- | ------------------ |
| [sunPosition]     | <code>Array.&lt;number&gt;</code> |                    |
| [envMap]          | <code>ctx.texture2D</code>        |                    |
| [backgroundBlur]  | <code>boolean</code>              | <code>false</code> |
| [exposure]        | <code>number</code>               | <code>1</code>     |
| [turbidity]       | <code>number</code>               | <code>10</code>    |
| [rayleigh]        | <code>number</code>               | <code>2</code>     |
| [mieCoefficient]  | <code>number</code>               | <code>0.005</code> |
| [mieDirectionalG] | <code>number</code>               | <code>0.8</code>   |

<a name="SpotLightComponentOptions"></a>

## SpotLightComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name            | Type                              | Default                   |
| --------------- | --------------------------------- | ------------------------- |
| [color]         | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code> |
| [intensity]     | <code>number</code>               | <code>1</code>            |
| [angle]         | <code>number</code>               | <code>Math.PI / 4</code>  |
| [innerAngle]    | <code>number</code>               | <code>0</code>            |
| [range]         | <code>number</code>               | <code>10</code>           |
| [bias]          | <code>number</code>               | <code>0.1</code>          |
| [bulbRadius]    | <code>number</code>               | <code>1</code>            |
| [castShadows]   | <code>boolean</code>              | <code>true</code>         |
| [shadowMapSize] | <code>number</code>               | <code>2048</code>         |

<a name="TransformComponentOptions"></a>

## TransformComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name       | Type                              | Default                   |
| ---------- | --------------------------------- | ------------------------- |
| [position] | <code>Array.&lt;number&gt;</code> | <code>[0, 0, 0]</code>    |
| [rotation] | <code>Array.&lt;number&gt;</code> | <code>[0, 0, 0, 1]</code> |
| [scale]    | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1]</code>    |

<a name="VertexHelperComponentOptions"></a>

## VertexHelperComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name        | Type                              | Default                                        |
| ----------- | --------------------------------- | ---------------------------------------------- |
| [color]     | <code>Array.&lt;number&gt;</code> | <code>[0, 1, 0, 1]</code>                      |
| [size]      | <code>Array.&lt;number&gt;</code> | <code>1</code>                                 |
| [attribute] | <code>string</code>               | <code>&quot;\&quot;normals\&quot;&quot;</code> |

<a name="SystemOptions"></a>

## SystemOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name            | Type                                           |
| --------------- | ---------------------------------------------- |
| ctx             | <code>module:pex-context/types/index.js</code> |
| [resourceCache] | [<code>ResourceCache</code>](#ResourceCache)   |
| [renderGraph]   | [<code>RenderGraph</code>](#RenderGraph)       |

<a name="SystemUpdate"></a>

## SystemUpdate : <code>function</code>

**Kind**: global typedef

| Param       | Type                                         |
| ----------- | -------------------------------------------- |
| entities    | [<code>Array.&lt;Entity&gt;</code>](#Entity) |
| [deltaTime] | <code>number</code>                          |

<a name="SystemDispose"></a>

## SystemDispose : <code>function</code>

**Kind**: global typedef

| Param    | Type                                         |
| -------- | -------------------------------------------- |
| entities | [<code>Array.&lt;Entity&gt;</code>](#Entity) |

<a name="System"></a>

## System : <code>object</code>

**Kind**: global typedef
**Properties**

| Name    | Type                                         |
| ------- | -------------------------------------------- |
| type    | <code>string</code>                          |
| cache   | <code>object</code>                          |
| debug   | <code>boolean</code>                         |
| update  | [<code>SystemUpdate</code>](#SystemUpdate)   |
| dispose | [<code>SystemDispose</code>](#SystemDispose) |

<a name="RenderEngineOptions"></a>

## RenderEngineOptions

**Kind**: global typedef
**Properties**

| Name         | Type                                         |
| ------------ | -------------------------------------------- |
| width        | <code>number</code>                          |
| height       | <code>number</code>                          |
| renderers    | [<code>Array.&lt;System&gt;</code>](#System) |
| drawToScreen | <code>boolean</code>                         |

<a name="RenderEngineRender"></a>

## RenderEngineRender : <code>function</code>

**Kind**: global typedef

| Param          | Type                                                     | Default         |
| -------------- | -------------------------------------------------------- | --------------- |
| entities       | [<code>Array.&lt;Entity&gt;</code>](#Entity)             |                 |
| cameraEntities | [<code>Array.&lt;Entity&gt;</code>](#Entity)             |                 |
| [options]      | [<code>RenderEngineOptions</code>](#RenderEngineOptions) | <code>{}</code> |

<a name="RenderEngineDebug"></a>

## RenderEngineDebug : <code>function</code>

**Kind**: global typedef

| Param  | Type                 |
| ------ | -------------------- |
| enable | <code>boolean</code> |

<a name="RenderEngine"></a>

## RenderEngine : [<code>System</code>](#System)

**Kind**: global typedef
**Properties**

| Name      | Type                                                   |
| --------- | ------------------------------------------------------ |
| render    | [<code>RenderEngineRender</code>](#RenderEngineRender) |
| debug     | [<code>RenderEngineDebug</code>](#RenderEngineDebug)   |
| systems   | [<code>Array.&lt;System&gt;</code>](#System)           |
| renderers | [<code>Array.&lt;System&gt;</code>](#System)           |

<a name="RendererSystemRender"></a>

## RendererSystemRender : <code>function</code>

**Kind**: global typedef

| Param      | Type                                                                           | Default         |
| ---------- | ------------------------------------------------------------------------------ | --------------- |
| renderView | [<code>RenderView</code>](#RenderView)                                         |                 |
| entities   | [<code>Entity</code>](#Entity) \| [<code>Array.&lt;Entity&gt;</code>](#Entity) |                 |
| [options]  | <code>object</code>                                                            | <code>{}</code> |

<a name="RendererSystemStageOptions"></a>

## RendererSystemStageOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name                         | Type                       |
| ---------------------------- | -------------------------- |
| [attachmentsLocations]       | <code>object</code>        |
| [shadowMappingLight]         | <code>object</code>        |
| [backgroundColorTexture]     | <code>ctx.texture2D</code> |
| [renderingToReflectionProbe] | <code>boolean</code>       |

<a name="RendererSystemStage"></a>

## RendererSystemStage : <code>function</code>

**Kind**: global typedef

| Param      | Type                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| renderView | [<code>Array.&lt;RenderView&gt;</code>](#RenderView)                   |
| entities   | [<code>Array.&lt;Entity&gt;</code>](#Entity)                           |
| options    | [<code>RendererSystemStageOptions</code>](#RendererSystemStageOptions) |

<a name="RendererSystem"></a>

## RendererSystem : <code>object</code>

**Kind**: global typedef
**Properties**

| Name                | Type                                                       |
| ------------------- | ---------------------------------------------------------- |
| type                | <code>string</code>                                        |
| cache               | <code>object</code>                                        |
| debug               | <code>boolean</code>                                       |
| flagDefinitions     | <code>Array.&lt;Array&gt;</code>                           |
| update              | [<code>SystemUpdate</code>](#SystemUpdate)                 |
| dispose             | [<code>SystemDispose</code>](#SystemDispose)               |
| render              | [<code>RendererSystemRender</code>](#RendererSystemRender) |
| [renderBackground]  | [<code>RendererSystemStage</code>](#RendererSystemStage)   |
| [renderShadow]      | [<code>RendererSystemStage</code>](#RendererSystemStage)   |
| [renderOpaque]      | [<code>RendererSystemStage</code>](#RendererSystemStage)   |
| [renderTransparent] | [<code>RendererSystemStage</code>](#RendererSystemStage)   |
| [renderPost]        | [<code>RendererSystemStage</code>](#RendererSystemStage)   |

<a name="WorldAdd"></a>

## WorldAdd : <code>function</code>

**Kind**: global typedef

| Param  | Type                           |
| ------ | ------------------------------ |
| entity | [<code>Entity</code>](#Entity) |

<a name="WorldAddSystem"></a>

## WorldAddSystem : <code>function</code>

**Kind**: global typedef

| Param  | Type                           |
| ------ | ------------------------------ |
| system | [<code>System</code>](#System) |

<a name="WorldUpdate"></a>

## WorldUpdate : <code>function</code>

**Kind**: global typedef

| Param       | Type                |
| ----------- | ------------------- |
| [deltaTime] | <code>number</code> |

<a name="World"></a>

## World : <code>object</code>

**Kind**: global typedef
**Properties**

| Name      | Type                                           |
| --------- | ---------------------------------------------- |
| entities  | <code>Array.&lt;object&gt;</code>              |
| systems   | <code>Array.&lt;object&gt;</code>              |
| add       | [<code>WorldAdd</code>](#WorldAdd)             |
| addSystem | [<code>WorldAddSystem</code>](#WorldAddSystem) |
| update    | [<code>WorldUpdate</code>](#WorldUpdate)       |

<a name="RenderGraph"></a>

## RenderGraph : <code>object</code>

**Kind**: global typedef
**Properties**

| Name         | Type                              |
| ------------ | --------------------------------- |
| renderPasses | <code>Array.&lt;object&gt;</code> |
| beginFrame   | <code>function</code>             |
| renderPass   | <code>function</code>             |
| endFrame     | <code>function</code>             |

<a name="ResourceCacheUsage"></a>

## ResourceCacheUsage : <code>&quot;Transient&quot;</code> \| <code>&quot;Retained&quot;</code>

**Kind**: global typedef
<a name="ResourceCache"></a>

## ResourceCache : <code>object</code>

**Kind**: global typedef
**Properties**

| Name       | Type                                                   |
| ---------- | ------------------------------------------------------ |
| beginFrame | <code>function</code>                                  |
| endFrame   | <code>function</code>                                  |
| dispose    | <code>function</code>                                  |
| Usage      | [<code>ResourceCacheUsage</code>](#ResourceCacheUsage) |

<a name="RenderView"></a>

## RenderView : <code>object</code>

**Kind**: global typedef
**Properties**

| Name             | Type                                                 |
| ---------------- | ---------------------------------------------------- |
| camera           | <code>object</code>                                  |
| cameraEntity     | [<code>Entity</code>](#Entity)                       |
| viewport         | <code>module:pex-context/types/types~Viewport</code> |
| [exposure]       | <code>object</code>                                  |
| [outputEncoding] | <code>object</code>                                  |

<!-- api-end -->

## License

MIT. See [license file](https://github.com/pex-gl/pex-renderer/blob/main/LICENSE.md).
