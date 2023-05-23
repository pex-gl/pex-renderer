// Components
/**
 * @typedef {object} AmbientLightComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 */
/**
 * @typedef {object} AnimationComponentOptions
 * @property {boolean} [playing=false]
 * @property {boolean} [loop=false]
 * @property {number} [time=0]
 * @property {Array} [channels=[]]
 */
/**
 * @typedef {object} AreaLightComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 * @property {number} [intensity=1]
 */
/**
 * @typedef {object} AxesHelperComponentOptions
 */
/**
 * @typedef {object} BoundingBoxHelperComponentOptions
 * @property {number[]} [color=[1, 0, 0, 1]]
 */
/**
 * @typedef {object} CameraHelperComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 */
/**
 * @typedef {object} CameraComponentOptions
 * @property {"perspective" | "orthographic"} [projection="perspective"]
 * @property {number[]} [viewport=[0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]]
 * @property {number} [near=0.5]
 * @property {number} [far=1000]
 * @property {number} [aspect=1]
 * @property {number} [fov=Math.PI / 4]
 * @property {number} viewMatrix
 * @property {number} invViewMatrix
 */
// * @property {number} [exposure=1]
// * @property {number} [left=-1]
// * @property {number} [right=1]
// * @property {number} [top=1]
// * @property {number} [bottom=-1]
// * @property {number} [zoom=1]
// * @property {number} [focalLength=50] Focal length of the camera lens [10mm - 200mm] in mm
// * @property {number} [fStop=2.8] Ratio of camera lens opening, f-number, f/N, aperture [1.2 - 32] in mm
// * @property {number} [sensorSize=[36, 24]] Physical camera sensor or film size [sensorWidth, sensorHeight] in mm
// * @property {"vertical" | "horizontal" | "fit" | "overscan" | "vertical"} sensorFit How the camera frame matches sensor frame

/**
 * @typedef {object} DirectionalLightComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 * @property {number} [intensity=1]
 * @property {number} [bias=0.1]
 * @property {boolean} [castShadows=true]
 * @property {number} [shadowMapSize=2048]
 */
/**
 * @typedef {object} GeometryComponentOptions
 * @property {Float32Array} [positions]
 * @property {Float32Array} [normals]
 * @property {Float32Array} [uvs] Alias: texCoords/texCoords0
 * @property {Float32Array} [uvs1] Alias: texCoords1
 * @property {Float32Array} [vertexColors]
 * @property {(Uint16Array|Uint32Array)} [cells]
 * @property {Float32Array} [weights]
 * @property {Float32Array} [joints]
 * @property {Float32Array} [offsets] Instanced
 * @property {Float32Array} [rotations] Instanced
 * @property {Float32Array} [scales] Instanced
 * @property {Float32Array} [colors] Instanced
 * @property {number} [count]
 * @property {object} [multiDraw]
 * @property {ctx.Primitive} [primitive=ctx.Primitive.Triangles]
 */
/**
 * @typedef {object} GridHelperComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 * @property {number[]} [size=10]
 */
/**
 * @typedef {object} LightHelperComponentOptions
 */
/**
 * @typedef {object} TextureTransform
 * @property {number[]} [offset] [x, y]
 * @property {number} [rotation] angle in radians
 * @property {number[]} [scales] [x, y]
 */
/**
 * @typedef {object} MaterialComponentOptions
 * @property {boolean} [unlit]
 * @property {undefined | "segments"} [type="undefined"]
 * @property {number[]} [baseColor=[1, 1, 1, 1]]
 * @property {number[]} [emissiveColor="undefined"]
 * @property {number} [emissiveIntensity=1]
 *
 * @property {number} [metallic=1]
 * @property {number} [roughness=1]
 *
 * @property {ctx.texture2D | TextureTransform} [baseColorMap]
 * @property {ctx.texture2D | TextureTransform} [emissiveColorMap]
 * @property {ctx.texture2D | TextureTransform} [normalMap]
 * @property {ctx.texture2D | TextureTransform} [roughnessMap]
 * @property {ctx.texture2D | TextureTransform} [metallicMap]
 * @property {ctx.texture2D | TextureTransform} [metallicRoughnessMap]
 * @property {ctx.texture2D | TextureTransform} [occlusionMap]
 *
 * @property {number} [clearCoat]
 * @property {number} [clearCoatRoughness]
 * @property {ctx.texture2D | TextureTransform} [clearCoatMap]
 * @property {ctx.texture2D | TextureTransform} [clearCoatRoughnessMap]
 * @property {ctx.texture2D | TextureTransform} [clearCoatNormalMap]
 * @property {number} [clearCoatNormalMapScale]
 *
 * @property {number[]} [sheenColor]
 * @property {number} [sheenRoughness]
 *
 * @property {number} [transmission]
 * @property {number} [reflectance] Represents a remapping of a percentage of reflectance (with a default of 4%: 0.16 * pow(0.5, 2) = 0.04) and replaces an explicit index of refraction (IOR)
 *
 * @property {number} [alphaTest="undefined"]
 * @property {ctx.texture2D | TextureTransform} [alphaMap]
 * @property {boolean} [depthTest=true]
 * @property {boolean} [depthWrite=true]
 * @property {ctx.DepthFunc} [depthFunc=ctx.DepthFunc.Less]
 *
 * @property {boolean} [blend=false]
 * @property {ctx.BlendFactor} [blendSrcRGBFactor="undefined"]
 * @property {ctx.BlendFactor} [blendSrcAlphaFactor="undefined"]
 * @property {ctx.BlendFactor} [blendDstRGBFactor="undefined"]
 * @property {ctx.BlendFactor} [blendDstAlphaFactor="undefined"]
 * @property {boolean} [cullFace=true]
 * @property {ctx.Face} [cullFaceMode=ctx.Face.Back]
 * @property {number} [pointSize=1]
 *
 * @property {boolean} [castShadows=false]
 * @property {boolean} [receiveShadows=false]
 */
// * @property {number} [normalMapScale=1]
/**
 * @typedef {object} MorphComponentOptions
 * @property {Array} sources
 * @property {Array} [weights=[]]
 * @property {Array} [current=[]]
 */
/**
 * @typedef {object} OrbiterComponentOptions
 * @property {HTMLElement} [element=document.body]
 * @property {number[]} [target=[0, 0, 0]]
 * @property {number} [lat=0]
 * @property {number} [lon=0]
 * @property {number} [distance=0]
 */
/**
 * @typedef {object} OverlayComponentOptions
 */
/**
 * @typedef {object} PointLightComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 * @property {number} [intensity=1]
 * @property {number} [range=10]
 * @property {boolean} [castShadows=true]
 * @property {number} [shadowMapSize=2048]
 */
/**
 * @typedef {object} ReflectionProbeComponentOptions
 * @property {number} [size=1024]
 */
/**
 * @typedef {object} SkinComponentOptions
 */
/**
 * @typedef {object} SkyboxComponentOptions
 * @property {number[]} [sunPosition]
 * @property {ctx.texture2D} [envMap]
 * @property {boolean} [rgbm=false]
 * @property {boolean} [backgroundBlur=false]
 */
/**
 * @typedef {object} SpotLightComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 * @property {number} [intensity=1]
 * @property {number} [angle=Math.PI / 4]
 * @property {number} [innerAngle=0]
 * @property {number} [range=10]
 * @property {number} [bias=0.1]
 * @property {boolean} [castShadows=true]
 * @property {number} [shadowMapSize=2048]
 */
/**
 * @typedef {object} TransformComponentOptions
 * @property {number[]} [position=[0, 0, 0]]
 * @property {number[]} [rotation=[0, 0, 0, 1]]
 * @property {number[]} [scale=[1, 1, 1]]
 */

export {};
