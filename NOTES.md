TODO:
- [ ] automatically add directional light for sun, remove that
- [ ] check if resource creation modifies state
- [ ] how vulkan binds textures to uniforms and framebuffers?
- [ ] move SSAO init to pex-fx/ssao
- [ ] move debug drawing to a separate file

Context state mapping to Command properties

### Possible Context states and equivalent Command properties

2016-06-23

If I rename color to clearColor and depth to clearDepth i can get rid of `createClearCommand` all together

Questions:
- would it be good idea to replace viewport: [l,r,b,t] with [x,y,w,h]? What do regl and THREE.js do?
- framebuffer attachments are ugly

```javascript
DEPTH_BIT
setDepthTest -> depthTest : Boolean
setDepthMask -> depthMask : Integer
setDepthFunc -> depthFunc : Enum
setClearDepth -> clearDepth : Integer

COLOR_BIT
setClearColor -> clearColor
setColorMask -> colorMask : [r:Number, g:Number, b:Number, a:Number]

STENCIL_BIT
setStencilTest -> stencilTest : Boolean
setStencilFunc -> stencilFunc : ?
setStencilFuncSeparate -> stencilFuncSeparate : ?
setStencilOp -> stencilOp : ?
setStencilOpSeparate -> stencilOpSeparate : ?
setDepthRange -> depthRange : ?
setPolygonOffset -> polygonOffset ?

VIEWPORT_BIT
setViewport -> viewport: [left:Integer, right:Integer, bottom: Integer, top:Integer]

SCISSOR_BIT
setScissorTest -> scissorTest: Boolean
setScissor -> scissor: ?
setScissorOp? -> ?

CULL_BIT
setCullFace -> cullFace: Boolean
setCullFaceMode -> cullFaceMode: Enum

BLEND_BIT
setBlend -> blend: Boolean
setBlendColor? -> blendColor : [r:Number, g:Number, b:Number, a:Number]
setBlendEquation -> blendEquation : ?
setBlendEquationSeparate -> blendEquationSeparate : ?
setBlendFunc -> blendFunc : [src:Enum, dst:Enum]
setBlendFuncSeparate -> blendFuncSeparate : [src:Enum, dst:Enum, srcAlpha:Enum, dstAlpha:Enum]

LINE_WIDTH_BIT
setLineWidth -> lineWidth : Number

MATRIX_PROJECTION_BIT
setProjectionMatrix -> projectionMatrix : Mat4

MATRIX_VIEW_BIT
setViewMatrix -> viewMatrix : Mat4

MATRIX_MODEL_BIT
setModelMatrix -> modelMatrix : Mat4

FRAMEBUFFER_BIT
bindFramebuffer -> framebuffer : Framebuffer:w
							     framebufferColorAttachments : Object { idx:  { target: Enum, handle: TextureObject }
									 framebufferDepthAttachment : Object { target: Enum, handle: TextureObject }

VERTEX_ARRAY_BIT
bindVertexArray -> vertexVrray : VertexArray
   								 mode? : Enum
								   count? : Integer
								   primitiveCount? : Integer //instance count

PROGRAM_BIT
bindProgram -> program : Program
							 uniforms : Object { uniform: value : Number / Array }

TEXTURE_BIT
bindTexture -> uniforms : Object { samplerUniform: Texture2D / TextureCube }

MESH_BIT
bindMesh -> mesh : Mesh
```

### WebGL2 TODO

```
SAMPLER_BIT ?
bindSampler?

TRANSFORM_FEEDBACK_BIT ?
bindTransformFeedback?

FRAMEBUFFER_BIT
renderbuffersAttachment?
blit multisampled renderbuffer to texture

TEXTURE_BIT
Texture3D
```

### List of defines

- USE_NORMALS
- USE_TANGENTS
- USE_TEX_COORDS
- USE_INSTANCED_OFFSET
- USE_INSTANCED_SCALE
- USE_INSTANCED_ROTATION
- USE_VERTEX_COLORS
- USE_INSTANCED_COLOR
- USE_BASE_COLOR_MAP
- USE_EMISSIVE_COLOR_MAP
- USE_NORMAL_MAP
- USE_DISPLACEMENT_MAP
- USE_AO
- USE_OCCLUSION_MAP
- USE_ALPHA_TEST
- USE_ALPHA_MAP
- USE_SKIN
- USE_REFLECTION_PROBES
- USE_BLEND
- USE_TONEMAPPING
- USE_UNLIT_WORKFLOW
- USE_METALLIC_ROUGHNESS_WORKFLOW
- USE_METALLIC_ROUGHNESS_MAP
- USE_METALLIC_MAP
- USE_ROUGHNESS_MAP
- USE_SPECULAR_GLOSSINESS_WORKFLOW
- USE_DIFFUSE_MAP
- USE_SPECULAR_GLOSSINESS_MAP
- DEPTH_PASS_ONLY
- DEPTH_PRE_PASS_ONLY
- SHADOW_QUALITY
- USE_DRAW_BUFFERS
- NUM_AMBIENT_LIGHTS
- NUM_DIRECTIONAL_LIGHTS
- NUM_POINT_LIGHTS
- NUM_SPOT_LIGHTS
- NUM_ARE_LIGHTS
