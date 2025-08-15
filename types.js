//TODO: MARCIN: why is this not in each respective file?
// Entity
/**
 * @typedef {object} Entity
 * @property {number} id
 * @property {AmbientLightComponentOptions} [ambientLight]
 * @property {(AnimationComponentOptions | AnimationComponentOptions[])} [animation]
 * @property {AreaLightComponentOptions} [areaLight]
 * @property {AxesHelperComponentOptions} [axesHelper]
 * @property {BoundingBoxHelperComponentOptions} [boundingBoxHelper]
 * @property {CameraHelperComponentOptions} [cameraHelper]
 * @property {CameraComponentOptions} [camera]
 * @property {DirectionalLightComponentOptions} [directionalLight]
 * @property {GeometryComponentOptions} [geometry]
 * @property {GridHelperComponentOptions} [gridHelper]
 * @property {LightHelperComponentOptions} [lightHelper]
 * @property {MaterialComponentOptions} [material]
 * @property {MorphComponentOptions} [morph]
 * @property {OrbiterComponentOptions} [orbiter]
 * @property {OverlayComponentOptions} [overlay]
 * @property {PointLightComponentOptions} [pointLight]
 * @property {PostProcessingComponentOptions} [postProcessing]
 * @property {ReflectionProbeComponentOptions} [reflectionProbe]
 * @property {SkinComponentOptions} [skin]
 * @property {SkyboxComponentOptions} [skybox]
 * @property {SpotLightComponentOptions} [spotLight]
 * @property {TransformComponentOptions} [transform]
 * @property {VertexHelperComponentOptions} [vertexHelper]
 */

// Components
/**
 * @typedef {object} AmbientLightComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 * @property {number} [intensity=1]
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
 * @property {boolean} [disk=false]
 * @property {boolean} [doubleSided=false]
 * @property {number} [bias=0.1]
 * @property {number} [bulbRadius=1]
 * @property {boolean} [castShadows=true]
 * @property {number} [shadowMapSize=2048]
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
 * @typedef {object} CameraView
 * @property {number[]} [totalSize]
 * @property {number[]} [size]
 * @property {number[]} [offset]
 */
/**
 * @typedef {object} CameraComponentOptions
 * @property {"perspective" | "orthographic"} [projection="perspective"]
 * @property {number} [near=0.5]
 * @property {number} [far=1000]
 * @property {number} [aspect=1]
 * @property {import("pex-color").color} [clearColor]
 * @property {mat4} [viewMatrix]
 * @property {mat4} [invViewMatrix]
 * @property {boolean} [culling=false]
 * @property {number} [exposure=1]
 * @property {"aces" | "agx" | "filmic" | "lottes" | "neutral" | "reinhard" | "reinhard2" | "uchimura" | "uncharted2" | "unreal"} [toneMap="aces"]
 * @property {number} [outputEncoding=ctx.Encoding.Gamma]
 * @property {number} [focalLength=50] Focal length of the camera lens [10mm - 200mm] in mm
 * @property {number} [fStop=2.8] Ratio of camera lens opening, f-number, f/N, aperture [1.2 - 32] in mm
 * @property {number} [sensorSize=[36, 24]] Physical camera sensor or film size [sensorWidth, sensorHeight] in mm
 * @property {"vertical" | "horizontal" | "fit" | "overscan" | "vertical"} sensorFit Matching of camera frame to sensor frame
 * @property {CameraView} [view]
 * @property {number} [fov=Math.PI / 4]
 * @property {number} [left=-1]
 * @property {number} [right=1]
 * @property {number} [bottom=-1]
 * @property {number} [top=1]
 * @property {number} [zoom=1]
 */

/**
 * @typedef {object} DirectionalLightComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 * @property {number} [intensity=1]
 * @property {number} [bias=0.1]
 * @property {number} [bulbRadius=1]
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
 * @property {boolean} [culled]
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
 * @property {undefined | "line"} [type="undefined"]
 * @property {number[]} [baseColor=[1, 1, 1, 1]]
 * @property {number[]} [emissiveColor="undefined"]
 * @property {number} [emissiveIntensity=1]
 *
 * @property {number} [metallic=1]
 * @property {number} [roughness=1]
 * @property {number} [ior]
 * @property {number} [specular]
 * @property {ctx.texture2D | TextureTransform} [specularTexture]
 * @property {number[]} [specularColor=[1, 1, 1]]
 * @property {ctx.texture2D | TextureTransform} [specularColorTexture]
 *
 * @property {ctx.texture2D | TextureTransform} [baseColorTexture]
 * @property {ctx.texture2D | TextureTransform} [emissiveColorTexture]
 * @property {ctx.texture2D | TextureTransform} [normalTexture]
 * @property {number} [normalTextureScale=1]
 * @property {ctx.texture2D | TextureTransform} [roughnessTexture]
 * @property {ctx.texture2D | TextureTransform} [metallicTexture]
 * @property {ctx.texture2D | TextureTransform} [metallicRoughnessTexture]
 * @property {ctx.texture2D | TextureTransform} [occlusionTexture]
 *
 * @property {number} [clearCoat]
 * @property {number} [clearCoatRoughness]
 * @property {ctx.texture2D | TextureTransform} [clearCoatTexture]
 * @property {ctx.texture2D | TextureTransform} [clearCoatRoughnessTexture]
 * @property {ctx.texture2D | TextureTransform} [clearCoatNormalTexture]
 * @property {number} [clearCoatNormalTextureScale]
 *
 * @property {number[]} [sheenColor]
 * @property {number} [sheenRoughness]
 *
 * @property {number} [transmission]
 * @property {ctx.texture2D | TextureTransform} [transmissionTexture]
 * @property {number} [dispersion]
 *
 * @property {number} [diffuseTransmission]
 * @property {ctx.texture2D | TextureTransform} [diffuseTransmissionTexture]
 * @property {number} [diffuseTransmissionColor=[1, 1, 1]]
 * @property {ctx.texture2D | TextureTransform} [diffuseTransmissionColorTexture]
 *
 * @property {number} [thickness]
 * @property {ctx.texture2D | TextureTransform} [thicknessTexture]
 * @property {number} [attenuationDistance]
 * @property {number[]} [attenuationColor]
 *
 * @property {number} [alphaTest="undefined"]
 * @property {ctx.texture2D | TextureTransform} [alphaTexture]
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
/**
 * @typedef {object} LineMaterialComponentOptions
 * @property {"line"} [type="line"]
 * @property {number[]} [baseColor=[1, 1, 1, 1]]
 * @property {number} [lineWidth=1]
 * @property {number} [lineResolution=16]
 */
/**
 * @typedef {object} MorphComponentOptions
 * @property {object} sources
 * @property {object} targets
 * @property {object} [current]
 * @property {Array} [weights=[]]
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
 * @property {number} [bulbRadius=1]
 * @property {boolean} [castShadows=true]
 * @property {number} [shadowMapSize=2048]
 */
/**
 * @typedef {object} SSAOComponentOptions
 * @property {"sao" | "gtao"} [type="sao"]
 * @property {boolean} [noiseTexture=true]
 * @property {number} [mix=1]
 * @property {number} [samples="gtao" ? 6 : 11]
 * @property {number} [intensity=2.2]
 * @property {number} [radius=0.5] meters
 * @property {number} [blurRadius=0.5]
 * @property {number} [blurSharpness=10]
 * @property {number} [brightness=0]
 * @property {number} [contrast=1]
 * // SSAO
 * @property {number} [bias=0.001] centimeters
 * @property {number} [spiralTurns=7]
 * // GTAO
 * @property {number} [slices=3]
 * @property {number} [colorBounce=true]
 * @property {number} [colorBounceIntensity=1.0]
 */
/**
 * @typedef {object} DoFComponentOptions
 * @property {"gustafsson" | "upitis"} [type="gustafsson"] Gustafsson uses a spiral pattern while Upitis uses a circular one.
 * @property {boolean} [physical=true] Use camera f-stop and focal length
 * @property {number} [focusDistance=7] The point to focus on in meters.
 * @property {number} [focusScale=1] Non physically based value for artistic control when physical is false, otherwise act as an fStop divider. Larger aperture (ie, smaller f-stop) or larger focal length (smaller fov) = smaller depth of field = more blur.
 * @property {boolean} [focusOnScreenPoint=false] Read the depth buffer to find the first intersecting object to focus on instead of a fixed focus distance.
 * @property {number[]} [screenPoint=[0.5, 0.5]] The normalized screen point to focus on when "focusOnScreenPoint" is true.
 * @property {number} [chromaticAberration=0.7] Amount of RGB separation
 * @property {number} [luminanceThreshold=0.7] Threshold for out of focus hightlights
 * @property {number} [luminanceGain=1] Gain for out of focus hightlights
 * @property {number} [samples=6] Iteration steps. More steps means better blur but also degraded performances.
 * @property {"disk" | "pentagon"} [shape="disk"] The bokeh shape for type "upitis".
 * @property {boolean} [debug=false]
 */
/**
 * @typedef {object} MSAAComponentOptions
 * @property {number} [sampleCount=4] Multisample anti-aliasing samples: 1 or 4.
 */
/**
 * @typedef {object} AAComponentOptions
 * @property {number} [subPixelQuality=0.75] Higher = softer. Helps mitigate fireflies but will blur small details.
 * @property {number} [quality=2] For edge luma threshold: 0 to 4.
 */
/**
 * @typedef {object} FogComponentOptions
 * @property {number[]} [color=[0.5, 0.5, 0.5]]
 * @property {number} [start=5]
 * @property {number} [density=0.15]
 * @property {number[]} [sunPosition=[1, 1, 1]]
 * @property {number} [sunDispertion=0.2]
 * @property {number} [sunIntensity=0.1]
 * @property {number[]} [sunColor=[0.98, 0.98, 0.7]]
 * @property {number[]} [inscatteringCoeffs=[0.3, 0.3, 0.3]]
 */
/**
 * @typedef {object} BloomComponentOptions
 * @property {number} [quality=1] The bloom quality: 0 or 1 (0 is faster but flickers)
 * @property {"luma" | "luminance" | "average"} [colorFunction="luma"] The function used to determine the brightness of a pixel for the threshold.
 * @property {number} [threshold=1] The brightness value at which pixels are filtered out for the threshold.
 * @property {"color" | "emissive"} [source="color"] The source texture for the threshold.
 * @property {number} [intensity=0.1] The strength of the bloom effect.
 * @property {number} [radius=1] The downsampling radius which controls how much glare gets blended in.
 */
/**
 * @typedef {object} LutComponentOptions
 * @property {ctx.texture2D} texture
 */
/**
 * @typedef {object} ColorCorrectionComponentOptions
 * @property {number} [brightness=0]
 * @property {number} [contrast=1]
 * @property {number} [saturation=1]
 * @property {number} [hue=0]
 */
/**
 * @typedef {object} VignetteComponentOptions
 * @property {number} [radius=0.8]
 * @property {number} [intensity=0.2]
 */
/**
 * @typedef {object} FilmGrainComponentOptions
 * @property {number} [quality=2]
 * @property {number} [size=1.6]
 * @property {number} [intensity=0.05]
 * @property {number} [colorIntensity=0.6]
 * @property {number} [luminanceIntensity=1]
 * @property {number} [speed=0.5]
 */
/**
 * @typedef {object} PostProcessingComponentOptions
 * @property {SSAOComponentOptions} [ssao]
 * @property {DoFComponentOptions} [dof]
 * @property {AAComponentOptions} [aa]
 * @property {FogComponentOptions} [fog]
 * @property {BloomComponentOptions} [bloom]
 * @property {LutComponentOptions} [lut]
 * @property {ColorCorrectionComponentOptions} [colorCorrection]
 * @property {VignetteComponentOptions} [vignette]
 * @property {FilmGrainComponentOptions} [filmGrain]
 * @property {number} opacity
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
 * @property {boolean} [backgroundBlur=false]
 * @property {number} [exposure=1]
 * @property {number} [turbidity=10]
 * @property {number} [rayleigh=2]
 * @property {number} [mieCoefficient=0.005]
 * @property {number} [mieDirectionalG=0.8]
 */
/**
 * @typedef {object} SpotLightComponentOptions
 * @property {number[]} [color=[1, 1, 1, 1]]
 * @property {number} [intensity=1]
 * @property {number} [angle=Math.PI / 4]
 * @property {number} [innerAngle=0]
 * @property {number} [range=10]
 * @property {number} [bias=0.1]
 * @property {number} [bulbRadius=1]
 * @property {boolean} [castShadows=true]
 * @property {number} [shadowMapSize=2048]
 */
/**
 * @typedef {object} TransformComponentOptions
 * @property {number[]} [position=[0, 0, 0]]
 * @property {number[]} [rotation=[0, 0, 0, 1]]
 * @property {number[]} [scale=[1, 1, 1]]
 */
/**
 * @typedef {object} VertexHelperComponentOptions
 * @property {number[]} [color=[0, 1, 0, 1]]
 * @property {number[]} [size=1]
 * @property {string} [attribute="normals"]
 */

// System
/**
 * @typedef {object} SystemOptions
 * @property {import("pex-context/types/index.js")} ctx
 * @property {ResourceCache} [resourceCache]
 * @property {RenderGraph} [renderGraph]
 */
/**
 * @callback SystemUpdate
 * @param {Entity[]} entities
 * @param {number} [deltaTime]
 */
/**
 * @callback SystemDispose
 * @param {Entity[]} entities
 */
/**
 * @typedef {object} System
 * @property {string} type
 * @property {object} cache
 * @property {boolean} debug
 * @property {SystemUpdate} update
 * @property {SystemDispose} dispose
 */
/**
 * @typedef RenderEngineOptions
 * @property {number} width
 * @property {number} height
 * @property {System[]} renderers
 * @property {boolean} drawToScreen
 */
/**
 * @callback RenderEngineRender
 * @param {Entity[]} entities
 * @param {Entity[]} cameraEntities
 * @param {RenderEngineOptions} [options={}]
 */
/**
 * @callback RenderEngineDebug
 * @param {boolean} enable
 */
/**
 * @typedef {System} RenderEngine
 * @property {RenderEngineRender} render
 * @property {RenderEngineDebug} debug
 * @property {System[]} systems
 * @property {System[]} renderers
 */
/**
 * @callback RendererSystemRender
 * @param {RenderView} renderView
 * @param {Entity | Entity[]} entities
 * @param {object} [options={}]
 */
/**
 * @typedef {object} RendererSystemStageOptions
 * @property {object} [attachmentsLocations]
 * @property {object} [shadowMappingLight]
 * @property {ctx.texture2D} [backgroundColorTexture]
 * @property {boolean} [renderingToReflectionProbe]
 */
/**
 * @callback RendererSystemStage
 * @param {RenderView[]} renderView
 * @param {Entity[]} entities
 * @param {RendererSystemStageOptions} options
 */
/**
 * @typedef {object} RendererSystem
 * @property {string} type
 * @property {object} cache
 * @property {boolean} debug
 * @property {Array[]} flagDefinitions
 * @property {SystemUpdate} update
 * @property {SystemDispose} dispose
 * @property {RendererSystemRender} render
 * @property {RendererSystemStage} [renderBackground]
 * @property {RendererSystemStage} [renderShadow]
 * @property {RendererSystemStage} [renderOpaque]
 * @property {RendererSystemStage} [renderTransparent]
 * @property {RendererSystemStage} [renderPost]
 */

// World
/**
 * @callback WorldAdd
 * @param {Entity} entity
 */
/**
 * @callback WorldAddSystem
 * @param {System} system
 */
/**
 * @callback WorldUpdate
 * @param {number} [deltaTime]
 */
/**
 * @typedef {object} World
 * @property {object[]} entities
 * @property {object[]} systems
 * @property {WorldAdd} add
 * @property {WorldAddSystem} addSystem
 * @property {WorldUpdate} update
 */

// Others
/**
 * @typedef {object} RenderGraph
 * @property {object[]} renderPasses
 * @property {Function} beginFrame
 * @property {Function} renderPass
 * @property {Function} endFrame
 */
/**
 * @typedef {"Transient" | "Retained"} ResourceCacheUsage
 */
/**
 * @typedef {object} ResourceCache
 * @property {Function} beginFrame
 * @property {Function} endFrame
 * @property {Function} dispose
 * @property {ResourceCacheUsage} Usage
 */
/**
 * @typedef {object} RenderView
 * @property {object} camera
 * @property {Entity} cameraEntity
 * @property {import("pex-context/types/types").Viewport} viewport
 * @property {object} [exposure]
 * @property {object} [outputEncoding]
 */

export {};
