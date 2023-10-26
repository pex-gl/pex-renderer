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
<dt><a href="#module_AmbientLightComponent">AmbientLightComponent</a> ⇒ <code>object</code></dt>
<dd><p>Ambient light component</p>
</dd>
<dt><a href="#module_AnimationComponent">AnimationComponent</a> ⇒ <code>object</code></dt>
<dd><p>Animation component</p>
</dd>
<dt><a href="#module_AreaLightComponent">AreaLightComponent</a> ⇒ <code>object</code></dt>
<dd><p>Area light component</p>
</dd>
<dt><a href="#module_AxesHelperComponent">AxesHelperComponent</a> ⇒ <code>object</code></dt>
<dd><p>Axes helper component</p>
</dd>
<dt><a href="#module_BoundingBoxHelperComponent">BoundingBoxHelperComponent</a> ⇒ <code>object</code></dt>
<dd><p>Bounding box helper component</p>
</dd>
<dt><a href="#module_CameraHelperComponent">CameraHelperComponent</a> ⇒ <code>object</code></dt>
<dd><p>Camera helper component</p>
</dd>
<dt><a href="#module_CameraComponent">CameraComponent</a> ⇒ <code>object</code></dt>
<dd><p>Camera component</p>
</dd>
<dt><a href="#module_DirectionalLightComponent">DirectionalLightComponent</a> ⇒ <code>object</code></dt>
<dd><p>Directional light component</p>
</dd>
<dt><a href="#module_GeometryComponent">GeometryComponent</a> ⇒ <code>object</code></dt>
<dd><p>Geometry component</p>
</dd>
<dt><a href="#module_GridHelperComponent">GridHelperComponent</a> ⇒ <code>object</code></dt>
<dd><p>Grid helper component</p>
</dd>
<dt><a href="#module_LightHelperComponent">LightHelperComponent</a> ⇒ <code>object</code></dt>
<dd><p>Light helper component</p>
</dd>
<dt><a href="#module_MaterialComponent">MaterialComponent</a> ⇒ <code>object</code></dt>
<dd><p>Material component</p>
</dd>
<dt><a href="#module_MorphComponent">MorphComponent</a> ⇒ <code>object</code></dt>
<dd><p>Morph component</p>
</dd>
<dt><a href="#module_OrbiterComponent">OrbiterComponent</a> ⇒ <code>object</code></dt>
<dd><p>Orbiter component</p>
</dd>
<dt><a href="#module_OverlayComponent">OverlayComponent</a> ⇒ <code>object</code></dt>
<dd><p>Overlay component</p>
</dd>
<dt><a href="#module_PointLightComponent">PointLightComponent</a> ⇒ <code>object</code></dt>
<dd><p>Point light component</p>
</dd>
<dt><a href="#module_PostProcessingComponent">PostProcessingComponent</a> ⇒ <code>object</code></dt>
<dd><p>Post Processing component</p>
</dd>
<dt><a href="#module_ReflectionProbeComponent">ReflectionProbeComponent</a> ⇒ <code>object</code></dt>
<dd><p>Reflection probe component</p>
</dd>
<dt><a href="#module_SkinComponent">SkinComponent</a> ⇒ <code>object</code></dt>
<dd><p>Skin component</p>
</dd>
<dt><a href="#module_SkyboxComponent">SkyboxComponent</a> ⇒ <code>object</code></dt>
<dd><p>Skybox component</p>
</dd>
<dt><a href="#module_SpotLightComponent">SpotLightComponent</a> ⇒ <code>object</code></dt>
<dd><p>Spot light component</p>
</dd>
<dt><a href="#module_TransformComponent">TransformComponent</a> ⇒ <code>object</code></dt>
<dd><p>Transform component</p>
</dd>
<dt><a href="#module_VertexHelperComponent">VertexHelperComponent</a> ⇒ <code>object</code></dt>
<dd><p>Vertex helper component</p>
</dd>
<dt><a href="#module_Entity">Entity</a> ⇒ <code><a href="#Entity">Entity</a></code></dt>
<dd><p>Entity</p>
</dd>
<dt><a href="#module_pex-renderer">pex-renderer</a></dt>
<dd></dd>
</dl>

## Functions

<dl>
<dt><a href="#default">default()</a> ⇒ <code><a href="#System">System</a></code></dt>
<dd><p>Camera system</p>
<p>Adds:</p>
<ul>
<li>&quot;_orbiter&quot; to orbiter components</li>
</ul>
</dd>
<dt><a href="#default">default(options)</a> ⇒ <code><a href="#System">System</a></code></dt>
<dd><p>Geometry system</p>
<p>Adds:</p>
<ul>
<li>&quot;bounds&quot; to geometry components</li>
<li>&quot;_geometry&quot; to entities as reference to internal cache</li>
</ul>
</dd>
<dt><a href="#default">default()</a> ⇒ <code><a href="#System">System</a></code></dt>
<dd><p>Light system</p>
<p>Adds:</p>
<ul>
<li>&quot;_projectionMatrix&quot; and &quot;_viewMatrix&quot; to light components</li>
<li>&quot;_direction&quot; to directional and spot light components</li>
</ul>
</dd>
<dt><a href="#default">default(options)</a> ⇒ <code><a href="#System">System</a></code></dt>
<dd><p>Reflection Probe system</p>
<p>Adds:</p>
<ul>
<li>&quot;_reflectionProbe&quot; to reflectionProbe components</li>
</ul>
</dd>
<dt><a href="#default">default()</a> ⇒ <code><a href="#System">System</a></code></dt>
<dd><p>Render pipeline system</p>
<p>Adds:</p>
<ul>
<li>&quot;_near&quot;, &quot;_far&quot;, &quot;_radiusUV&quot; and &quot;_sceneBboxInLightSpace&quot; to light components that cast shadows</li>
<li>&quot;_shadowCubemap&quot; to pointLight components and &quot;_shadowMap&quot; to other light components</li>
<li>&quot;_targets&quot; to postProcessing components</li>
</ul>
</dd>
<dt><a href="#default">default()</a> ⇒ <code><a href="#System">System</a></code></dt>
<dd><p>Create a shadow mapping object to compose with a render-pipeline-system</p>
<p>Adds:</p>
<ul>
<li>&quot;directionalLight&quot;, &quot;spotLight&quot; and &quot;pointLight&quot; method to create shadow map render passes
Requires:</li>
<li>this.drawMeshes()</li>
<li>this.descriptors</li>
</ul>
</dd>
<dt><a href="#default">default(options)</a> ⇒ <code><a href="#RendererSystem">RendererSystem</a></code></dt>
<dd><p>Skybox renderer</p>
<p>Renders a skybox (envMap or _skyTexture) to screen or to reflection probes.</p>
</dd>
<dt><a href="#default">default(options)</a> ⇒ <code><a href="#System">System</a></code></dt>
<dd><p>Skybox system</p>
<p>Adds:</p>
<ul>
<li>&quot;_skyTexture&quot; to skybox components with no envMap for skybox-renderer to render</li>
</ul>
</dd>
<dt><a href="#default">default()</a> ⇒ <code><a href="#System">System</a></code></dt>
<dd><p>Transform system</p>
<p>Adds:</p>
<ul>
<li>&quot;worldBounds&quot;, &quot;dirty&quot; and &quot;aabbDirty&quot; to transform components</li>
<li>&quot;_transform&quot; to entities as reference to internal cache</li>
</ul>
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
<dt><a href="#RendererSystemStages">RendererSystemStages</a> : <code>object</code></dt>
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

<a name="module_AmbientLightComponent"></a>

## AmbientLightComponent ⇒ <code>object</code>

Ambient light component

| Param     | Type                                                                       |
| --------- | -------------------------------------------------------------------------- |
| [options] | [<code>AmbientLightComponentOptions</code>](#AmbientLightComponentOptions) |

<a name="module_AnimationComponent"></a>

## AnimationComponent ⇒ <code>object</code>

Animation component

| Param     | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| [options] | [<code>AnimationComponentOptions</code>](#AnimationComponentOptions) |

<a name="module_AreaLightComponent"></a>

## AreaLightComponent ⇒ <code>object</code>

Area light component

| Param     | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| [options] | [<code>AreaLightComponentOptions</code>](#AreaLightComponentOptions) |

<a name="module_AxesHelperComponent"></a>

## AxesHelperComponent ⇒ <code>object</code>

Axes helper component

| Param     | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| [options] | [<code>AxesHelperComponentOptions</code>](#AxesHelperComponentOptions) |

<a name="module_BoundingBoxHelperComponent"></a>

## BoundingBoxHelperComponent ⇒ <code>object</code>

Bounding box helper component

| Param     | Type                                                                                 |
| --------- | ------------------------------------------------------------------------------------ |
| [options] | [<code>BoundingBoxHelperComponentOptions</code>](#BoundingBoxHelperComponentOptions) |

<a name="module_CameraHelperComponent"></a>

## CameraHelperComponent ⇒ <code>object</code>

Camera helper component

| Param     | Type                                                                       |
| --------- | -------------------------------------------------------------------------- |
| [options] | [<code>CameraHelperComponentOptions</code>](#CameraHelperComponentOptions) |

<a name="module_CameraComponent"></a>

## CameraComponent ⇒ <code>object</code>

Camera component

| Param     | Type                                                           |
| --------- | -------------------------------------------------------------- |
| [options] | [<code>CameraComponentOptions</code>](#CameraComponentOptions) |

<a name="module_DirectionalLightComponent"></a>

## DirectionalLightComponent ⇒ <code>object</code>

Directional light component

| Param     | Type                                                                               |
| --------- | ---------------------------------------------------------------------------------- |
| [options] | [<code>DirectionalLightComponentOptions</code>](#DirectionalLightComponentOptions) |

<a name="module_GeometryComponent"></a>

## GeometryComponent ⇒ <code>object</code>

Geometry component

| Param     | Type                                                               |
| --------- | ------------------------------------------------------------------ |
| [options] | [<code>GeometryComponentOptions</code>](#GeometryComponentOptions) |

<a name="module_GridHelperComponent"></a>

## GridHelperComponent ⇒ <code>object</code>

Grid helper component

| Param     | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| [options] | [<code>GridHelperComponentOptions</code>](#GridHelperComponentOptions) |

<a name="module_LightHelperComponent"></a>

## LightHelperComponent ⇒ <code>object</code>

Light helper component

| Param     | Type                                                                     |
| --------- | ------------------------------------------------------------------------ |
| [options] | [<code>LightHelperComponentOptions</code>](#LightHelperComponentOptions) |

<a name="module_MaterialComponent"></a>

## MaterialComponent ⇒ <code>object</code>

Material component

| Param     | Type                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [options] | [<code>MaterialComponentOptions</code>](#MaterialComponentOptions) \| [<code>LineMaterialComponentOptions</code>](#LineMaterialComponentOptions) |

<a name="module_MorphComponent"></a>

## MorphComponent ⇒ <code>object</code>

Morph component

| Param   | Type                                                         |
| ------- | ------------------------------------------------------------ |
| options | [<code>MorphComponentOptions</code>](#MorphComponentOptions) |

<a name="module_OrbiterComponent"></a>

## OrbiterComponent ⇒ <code>object</code>

Orbiter component

| Param   | Type                                                             |
| ------- | ---------------------------------------------------------------- |
| options | [<code>OrbiterComponentOptions</code>](#OrbiterComponentOptions) |

<a name="module_OverlayComponent"></a>

## OverlayComponent ⇒ <code>object</code>

Overlay component

| Param     | Type                                                             |
| --------- | ---------------------------------------------------------------- |
| [options] | [<code>OverlayComponentOptions</code>](#OverlayComponentOptions) |

<a name="module_PointLightComponent"></a>

## PointLightComponent ⇒ <code>object</code>

Point light component

| Param     | Type                                                                   |
| --------- | ---------------------------------------------------------------------- |
| [options] | [<code>PointLightComponentOptions</code>](#PointLightComponentOptions) |

<a name="module_PostProcessingComponent"></a>

## PostProcessingComponent ⇒ <code>object</code>

Post Processing component

| Param     | Type                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| [options] | [<code>PostProcessingComponentOptions</code>](#PostProcessingComponentOptions) |

<a name="module_ReflectionProbeComponent"></a>

## ReflectionProbeComponent ⇒ <code>object</code>

Reflection probe component

| Param     | Type                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| [options] | [<code>ReflectionProbeComponentOptions</code>](#ReflectionProbeComponentOptions) |

<a name="module_SkinComponent"></a>

## SkinComponent ⇒ <code>object</code>

Skin component

| Param     | Type                                                       |
| --------- | ---------------------------------------------------------- |
| [options] | [<code>SkinComponentOptions</code>](#SkinComponentOptions) |

<a name="module_SkyboxComponent"></a>

## SkyboxComponent ⇒ <code>object</code>

Skybox component

| Param     | Type                                                           |
| --------- | -------------------------------------------------------------- |
| [options] | [<code>SkyboxComponentOptions</code>](#SkyboxComponentOptions) |

<a name="module_SpotLightComponent"></a>

## SpotLightComponent ⇒ <code>object</code>

Spot light component

| Param     | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| [options] | [<code>SpotLightComponentOptions</code>](#SpotLightComponentOptions) |

<a name="module_TransformComponent"></a>

## TransformComponent ⇒ <code>object</code>

Transform component

| Param     | Type                                                                 |
| --------- | -------------------------------------------------------------------- |
| [options] | [<code>TransformComponentOptions</code>](#TransformComponentOptions) |

<a name="module_VertexHelperComponent"></a>

## VertexHelperComponent ⇒ <code>object</code>

Vertex helper component

| Param     | Type                                                                       |
| --------- | -------------------------------------------------------------------------- |
| [options] | [<code>VertexHelperComponentOptions</code>](#VertexHelperComponentOptions) |

<a name="module_Entity"></a>

## Entity ⇒ [<code>Entity</code>](#Entity)

Entity

| Param        | Type                | Default         |
| ------------ | ------------------- | --------------- |
| [components] | <code>object</code> | <code>{}</code> |

<a name="module_pex-renderer"></a>

## pex-renderer

- [pex-renderer](#module_pex-renderer)
  - [.components](#module_pex-renderer.components) : <code>object</code>
  - [.systems](#module_pex-renderer.systems) : <code>object</code>
  - [.world()](#module_pex-renderer.world) ⇒ [<code>World</code>](#World)
  - [.entity()](#module_pex-renderer.entity) ⇒ [<code>Entity</code>](#Entity)
  - [.renderEngine()](#module_pex-renderer.renderEngine) ⇒ [<code>RenderEngine</code>](#RenderEngine)
  - [.renderGraph(ctx)](#module_pex-renderer.renderGraph) ⇒ [<code>RenderGraph</code>](#RenderGraph)
  - [.resourceCache(ctx)](#module_pex-renderer.resourceCache) ⇒ [<code>ResourceCache</code>](#ResourceCache)

<a name="module_pex-renderer.components"></a>

### pex-renderer.components : <code>object</code>

All components as a function returning a component with default values.

**Kind**: static property of [<code>pex-renderer</code>](#module_pex-renderer)
<a name="module_pex-renderer.systems"></a>

### pex-renderer.systems : <code>object</code>

All systems as a function returning a system with a type property and an update function.

**Kind**: static property of [<code>pex-renderer</code>](#module_pex-renderer)
<a name="module_pex-renderer.world"></a>

### pex-renderer.world() ⇒ [<code>World</code>](#World)

Create a world object to store entities and systems

**Kind**: static method of [<code>pex-renderer</code>](#module_pex-renderer)
<a name="module_pex-renderer.entity"></a>

### pex-renderer.entity() ⇒ [<code>Entity</code>](#Entity)

Create an entity from an object of plain data components

**Kind**: static method of [<code>pex-renderer</code>](#module_pex-renderer)
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

<a name="default"></a>

## default() ⇒ [<code>System</code>](#System)

Camera system

Adds:

- "\_orbiter" to orbiter components

**Kind**: global function
<a name="default"></a>

## default(options) ⇒ [<code>System</code>](#System)

Geometry system

Adds:

- "bounds" to geometry components
- "\_geometry" to entities as reference to internal cache

**Kind**: global function

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="default"></a>

## default() ⇒ [<code>System</code>](#System)

Light system

Adds:

- "\_projectionMatrix" and "\_viewMatrix" to light components
- "\_direction" to directional and spot light components

**Kind**: global function
<a name="default"></a>

## default(options) ⇒ [<code>System</code>](#System)

Reflection Probe system

Adds:

- "\_reflectionProbe" to reflectionProbe components

**Kind**: global function

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="default"></a>

## default() ⇒ [<code>System</code>](#System)

Render pipeline system

Adds:

- "\_near", "\_far", "\_radiusUV" and "\_sceneBboxInLightSpace" to light components that cast shadows
- "\_shadowCubemap" to pointLight components and "\_shadowMap" to other light components
- "\_targets" to postProcessing components

**Kind**: global function
<a name="default"></a>

## default() ⇒ [<code>System</code>](#System)

Create a shadow mapping object to compose with a render-pipeline-system

Adds:

- "directionalLight", "spotLight" and "pointLight" method to create shadow map render passes
  Requires:
- this.drawMeshes()
- this.descriptors

**Kind**: global function
<a name="default"></a>

## default(options) ⇒ [<code>RendererSystem</code>](#RendererSystem)

Skybox renderer

Renders a skybox (envMap or \_skyTexture) to screen or to reflection probes.

**Kind**: global function

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="default"></a>

## default(options) ⇒ [<code>System</code>](#System)

Skybox system

Adds:

- "\_skyTexture" to skybox components with no envMap for skybox-renderer to render

**Kind**: global function

| Param   | Type                                         |
| ------- | -------------------------------------------- |
| options | [<code>SystemOptions</code>](#SystemOptions) |

<a name="default"></a>

## default() ⇒ [<code>System</code>](#System)

Transform system

Adds:

- "worldBounds", "dirty" and "aabbDirty" to transform components
- "\_transform" to entities as reference to internal cache

**Kind**: global function
<a name="Entity"></a>

## Entity : <code>object</code>

**Kind**: global typedef
**Properties**

| Name | Type                |
| ---- | ------------------- |
| id   | <code>number</code> |

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

| Name                          | Type                                                                             | Default                            | Description                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [unlit]                       | <code>boolean</code>                                                             |                                    |                                                                                                                                                             |
| [type]                        | <code>undefined</code> \| <code>&quot;line&quot;</code>                          | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [baseColor]                   | <code>Array.&lt;number&gt;</code>                                                | <code>[1, 1, 1, 1]</code>          |                                                                                                                                                             |
| [emissiveColor]               | <code>Array.&lt;number&gt;</code>                                                | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [emissiveIntensity]           | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [metallic]                    | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [roughness]                   | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [baseColorTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [emissiveColorTexture]        | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [normalTexture]               | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [normalTextureScale]          | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [roughnessTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [metallicTexture]             | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [metallicRoughnessTexture]    | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [occlusionTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [clearCoat]                   | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [clearCoatRoughness]          | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [clearCoatTexture]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [clearCoatRoughnessTexture]   | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [clearCoatNormalTexture]      | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [clearCoatNormalTextureScale] | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [sheenColor]                  | <code>Array.&lt;number&gt;</code>                                                |                                    |                                                                                                                                                             |
| [sheenRoughness]              | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [transmission]                | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [reflectance]                 | <code>number</code>                                                              |                                    | Represents a remapping of a percentage of reflectance (with a default of 4%: 0.16 \* pow(0.5, 2) = 0.04) and replaces an explicit index of refraction (IOR) |
| [alphaTest]                   | <code>number</code>                                                              | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [alphaTexture]                | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [depthTest]                   | <code>boolean</code>                                                             | <code>true</code>                  |                                                                                                                                                             |
| [depthWrite]                  | <code>boolean</code>                                                             | <code>true</code>                  |                                                                                                                                                             |
| [depthFunc]                   | <code>ctx.DepthFunc</code>                                                       | <code>ctx.DepthFunc.Less</code>    |                                                                                                                                                             |
| [blend]                       | <code>boolean</code>                                                             | <code>false</code>                 |                                                                                                                                                             |
| [blendSrcRGBFactor]           | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [blendSrcAlphaFactor]         | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [blendDstRGBFactor]           | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [blendDstAlphaFactor]         | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [cullFace]                    | <code>boolean</code>                                                             | <code>true</code>                  |                                                                                                                                                             |
| [cullFaceMode]                | <code>ctx.Face</code>                                                            | <code>ctx.Face.Back</code>         |                                                                                                                                                             |
| [pointSize]                   | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [castShadows]                 | <code>boolean</code>                                                             | <code>false</code>                 |                                                                                                                                                             |
| [receiveShadows]              | <code>boolean</code>                                                             | <code>false</code>                 |                                                                                                                                                             |

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
| [castShadows]   | <code>boolean</code>              | <code>true</code>         |
| [shadowMapSize] | <code>number</code>               | <code>2048</code>         |

<a name="PostProcessingComponentOptions"></a>

## PostProcessingComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name              | Type                |
| ----------------- | ------------------- |
| [dof]             | <code>object</code> |
| [aa]              | <code>object</code> |
| [fog]             | <code>object</code> |
| [bloom]           | <code>object</code> |
| [lut]             | <code>object</code> |
| [colorCorrection] | <code>object</code> |
| [vignette]        | <code>object</code> |

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

| Name | Type                                           |
| ---- | ---------------------------------------------- |
| ctx  | <code>module:pex-context/types/index.js</code> |

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
| renderView | [<code>Array.&lt;RenderView&gt;</code>](#RenderView)                           |                 |
| entities   | [<code>Entity</code>](#Entity) \| [<code>Array.&lt;Entity&gt;</code>](#Entity) |                 |
| [options]  | <code>object</code>                                                            | <code>{}</code> |

<a name="RendererSystemStages"></a>

## RendererSystemStages : <code>object</code>

**Kind**: global typedef
**Properties**

| Name          | Type                  |
| ------------- | --------------------- |
| [background]  | <code>function</code> |
| [shadow]      | <code>function</code> |
| [opaque]      | <code>function</code> |
| [transparent] | <code>function</code> |
| [post]        | <code>function</code> |

<a name="RendererSystem"></a>

## RendererSystem : <code>object</code>

**Kind**: global typedef
**Properties**

| Name            | Type                                                       |
| --------------- | ---------------------------------------------------------- |
| type            | <code>string</code>                                        |
| cache           | <code>object</code>                                        |
| debug           | <code>boolean</code>                                       |
| update          | [<code>SystemUpdate</code>](#SystemUpdate)                 |
| dispose         | [<code>SystemDispose</code>](#SystemDispose)               |
| render          | [<code>RendererSystemRender</code>](#RendererSystemRender) |
| flagDefinitions | <code>Array.&lt;Array&gt;</code>                           |
| renderStages    | [<code>RendererSystemStages</code>](#RendererSystemStages) |

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
