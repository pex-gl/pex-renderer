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

Physically based renderer (PBR) and scene graph for [PEX](https://pex.gl).

![](https://raw.githubusercontent.com/pex-gl/pex-renderer/main/screenshot.jpg)

## Installation

```bash
npm install pex-renderer
```

## Usage

```js
import pexRenderer from "pex-renderer";
console.log(pexRenderer);
```

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
<dt><a href="#module_Entity">Entity</a> ⇒ <code><a href="#Entity">Entity</a></code></dt>
<dd><p>Entity</p>
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
<dt><a href="#MorphComponentOptions">MorphComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#OrbiterComponentOptions">OrbiterComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#OverlayComponentOptions">OverlayComponentOptions</a> : <code>object</code></dt>
<dd></dd>
<dt><a href="#PointLightComponentOptions">PointLightComponentOptions</a> : <code>object</code></dt>
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
<dt><a href="#SystemUpdate">SystemUpdate</a> : <code>function</code></dt>
<dd></dd>
<dt><a href="#System">System</a> : <code>object</code></dt>
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

| Param     | Type                                                               |
| --------- | ------------------------------------------------------------------ |
| [options] | [<code>MaterialComponentOptions</code>](#MaterialComponentOptions) |

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

<a name="module_Entity"></a>

## Entity ⇒ [<code>Entity</code>](#Entity)

Entity

| Param        | Type                | Default         |
| ------------ | ------------------- | --------------- |
| [components] | <code>object</code> | <code>{}</code> |

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

| Name        | Type                              | Default                   |
| ----------- | --------------------------------- | ------------------------- |
| [color]     | <code>Array.&lt;number&gt;</code> | <code>[1, 1, 1, 1]</code> |
| [intensity] | <code>number</code>               | <code>1</code>            |

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

<a name="CameraComponentOptions"></a>

## CameraComponentOptions : <code>object</code>

**Kind**: global typedef
**Properties**

| Name          | Type                                                                          | Default                                                            |
| ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [projection]  | <code>&quot;perspective&quot;</code> \| <code>&quot;orthographic&quot;</code> | <code>&quot;perspective&quot;</code>                               |
| [viewport]    | <code>Array.&lt;number&gt;</code>                                             | <code>[0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]</code> |
| [near]        | <code>number</code>                                                           | <code>0.5</code>                                                   |
| [far]         | <code>number</code>                                                           | <code>1000</code>                                                  |
| [aspect]      | <code>number</code>                                                           | <code>1</code>                                                     |
| [fov]         | <code>number</code>                                                           | <code>Math.PI / 4</code>                                           |
| viewMatrix    | <code>number</code>                                                           |                                                                    |
| invViewMatrix | <code>number</code>                                                           |                                                                    |

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

| Name                      | Type                                                                             | Default                            | Description                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [unlit]                   | <code>boolean</code>                                                             |                                    |                                                                                                                                                             |
| [type]                    | <code>undefined</code> \| <code>&quot;segments&quot;</code>                      | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [baseColor]               | <code>Array.&lt;number&gt;</code>                                                | <code>[1, 1, 1, 1]</code>          |                                                                                                                                                             |
| [emissiveColor]           | <code>Array.&lt;number&gt;</code>                                                | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [emissiveIntensity]       | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [metallic]                | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [roughness]               | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [baseColorMap]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [emissiveColorMap]        | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [normalMap]               | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [roughnessMap]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [metallicMap]             | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [metallicRoughnessMap]    | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [occlusionMap]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [clearCoat]               | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [clearCoatRoughness]      | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [clearCoatMap]            | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [clearCoatRoughnessMap]   | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [clearCoatNormalMap]      | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [clearCoatNormalMapScale] | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [sheenColor]              | <code>Array.&lt;number&gt;</code>                                                |                                    |                                                                                                                                                             |
| [sheenRoughness]          | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [transmission]            | <code>number</code>                                                              |                                    |                                                                                                                                                             |
| [reflectance]             | <code>number</code>                                                              |                                    | Represents a remapping of a percentage of reflectance (with a default of 4%: 0.16 \* pow(0.5, 2) = 0.04) and replaces an explicit index of refraction (IOR) |
| [alphaTest]               | <code>number</code>                                                              | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [alphaMap]                | <code>ctx.texture2D</code> \| [<code>TextureTransform</code>](#TextureTransform) |                                    |                                                                                                                                                             |
| [depthTest]               | <code>boolean</code>                                                             | <code>true</code>                  |                                                                                                                                                             |
| [depthWrite]              | <code>boolean</code>                                                             | <code>true</code>                  |                                                                                                                                                             |
| [depthFunc]               | <code>ctx.DepthFunc</code>                                                       | <code>ctx.DepthFunc.Less</code>    |                                                                                                                                                             |
| [blend]                   | <code>boolean</code>                                                             | <code>false</code>                 |                                                                                                                                                             |
| [blendSrcRGBFactor]       | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [blendSrcAlphaFactor]     | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [blendDstRGBFactor]       | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [blendDstAlphaFactor]     | <code>ctx.BlendFactor</code>                                                     | <code>&quot;undefined&quot;</code> |                                                                                                                                                             |
| [cullFace]                | <code>boolean</code>                                                             | <code>true</code>                  |                                                                                                                                                             |
| [cullFaceMode]            | <code>ctx.Face</code>                                                            | <code>ctx.Face.Back</code>         |                                                                                                                                                             |
| [pointSize]               | <code>number</code>                                                              | <code>1</code>                     |                                                                                                                                                             |
| [castShadows]             | <code>boolean</code>                                                             | <code>false</code>                 |                                                                                                                                                             |
| [receiveShadows]          | <code>boolean</code>                                                             | <code>false</code>                 |                                                                                                                                                             |

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

| Name             | Type                              | Default            |
| ---------------- | --------------------------------- | ------------------ |
| [sunPosition]    | <code>Array.&lt;number&gt;</code> |                    |
| [envMap]         | <code>ctx.texture2D</code>        |                    |
| [rgbm]           | <code>boolean</code>              | <code>false</code> |
| [backgroundBlur] | <code>boolean</code>              | <code>false</code> |

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

<a name="SystemUpdate"></a>

## SystemUpdate : <code>function</code>

**Kind**: global typedef

| Param       | Type                                         |
| ----------- | -------------------------------------------- |
| entities    | [<code>Array.&lt;Entity&gt;</code>](#Entity) |
| [deltaTime] | <code>number</code>                          |

<a name="System"></a>

## System : <code>object</code>

**Kind**: global typedef
**Properties**

| Name   | Type                                       |
| ------ | ------------------------------------------ |
| type   | <code>string</code>                        |
| debug  | <code>boolean</code>                       |
| update | [<code>SystemUpdate</code>](#SystemUpdate) |

<!-- api-end -->

## License

MIT. See [license file](https://github.com/pex-gl/pex-renderer/blob/main/LICENSE.md).
