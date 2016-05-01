var Vec3 = require('pex-math/Vec3');
var Vec4 = require('pex-math/Vec4');
var Quat = require('pex-math/Quat');
var Mat4 = require('pex-math/Mat4');
var Draw = require('pex-draw/Draw');
var PerspCamera = require('pex-cam/PerspCamera');
var renderToCubemap = require('./local_modules/pex-render-to-cubemap');
var downsampleCubemap = require('./local_modules/pex-downsample-cubemap');
var convolveCubemap = require('./local_modules/pex-convolve-cubemap');
var fx = require('pex-fx');
var random = require('pex-random');
var MathUtils = require('pex-math/Utils')
var flatten = require('flatten')
var SSAOv2          = require('./SSAO')
var Postprocess = require('./Postprocess');
var SkyEnvMap = require('./SkyEnvMap');
var Skybox = require('./Skybox');
var ReflectionProbe = require('./ReflectionProbe');
var Texture2D     = require('pex-context/Texture2D');
var TextureCube   = require('pex-context/TextureCube');
var lookup = require('gl-constants/lookup');
var fs = require('fs');

var SOLID_COLOR_VERT           = fs.readFileSync(__dirname + '/glsl/SolidColor.vert', 'utf8');
var SOLID_COLOR_VERT           = fs.readFileSync(__dirname + '/glsl/SolidColor.vert', 'utf8');
var SOLID_COLOR_FRAG           = fs.readFileSync(__dirname + '/glsl/SolidColor.frag', 'utf8');
var SHOW_COLORS_VERT           = fs.readFileSync(__dirname + '/glsl/ShowColors.vert', 'utf8');
var SHOW_COLORS_FRAG           = fs.readFileSync(__dirname + '/glsl/ShowColors.frag', 'utf8');
var OVERLAY_VERT               = fs.readFileSync(__dirname + '/glsl/Overlay.vert', 'utf8');
var OVERLAY_FRAG               = fs.readFileSync(__dirname + '/glsl/Overlay.frag', 'utf8');

var State = {
    backgroundColor : [0.1, 0.1, 0.1, 1],
    sunPosition: [3, 0, 0],
    sunColor: [1,1,1,1],
    prevSunPosition: [0, 0, 0],
    exposure: 1,
    dirtySky: true,
    frame: 0,
    ssao: true,
    shadows: true,
    shadowQuality: 3,
    bias: 0.1
}

function Renderer(ctx, width, height) {
    this._ctx = ctx;
    this._width = width;
    this._height = height;

    this._debugDraw = new Draw(ctx);
    this._debug = false;

    this._materials = [];
    this._nodes = [];

    this.initMaterials();
    this.initSkybox();
    this.initShadowmaps();
    this.initPostproces();

    this._state = State;
}


Renderer.prototype.initMaterials = function() {
    var ctx = this._ctx;
    this._solidColorProgram = ctx.createProgram(SOLID_COLOR_VERT, SOLID_COLOR_FRAG);
    this._showColorsProgram = ctx.createProgram(SHOW_COLORS_VERT, SHOW_COLORS_FRAG);
}

Renderer.prototype.initShadowmaps = function() {
    var ctx = this._ctx;
    this._shadowMapFbo = ctx.createFramebuffer();
}

Renderer.prototype.initPostproces = function() {
    var ctx = this._ctx;

    var fsqPositions = [[-1,-1],[1,-1], [1,1],[-1,1]];
    var fsqFaces = [ [0, 1, 2], [0, 2, 3]];
    var fsqAttributes = [
        { data: fsqPositions, location: ctx.ATTRIB_POSITION },
    ];
    var fsqIndices = { data: fsqFaces };
    this._fsqMesh = ctx.createMesh(fsqAttributes, fsqIndices);

    this._frameColorTex = ctx.createTexture2D(null, this._width, this._height, { type: ctx.HALF_FLOAT });
    this._frameNormalTex = ctx.createTexture2D(null, this._width, this._height, { type: ctx.HALF_FLOAT });
    this._frameDepthTex = ctx.createTexture2D(null, this._width, this._height, { format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT });
    this._frameFbo = ctx.createFramebuffer([ { texture: this._frameColorTex }, { texture: this._frameNormalTex} ], { texture: this._frameDepthTex});

    this._overlayProgram = ctx.createProgram(OVERLAY_VERT, OVERLAY_FRAG);

    this._fx = fx(ctx);

    var ssaoKernel = [];
    for(var i=0; i<64; i++) {
        var sample = [
            random.float() * 2 - 1,
            random.float() * 2 - 1,
            random.float(),
            1
        ]
        Vec3.normalize(sample)
        var scale = random.float()
        scale = MathUtils.lerp(0.1, 1.0, scale * scale);
        Vec3.scale(sample, scale)
        ssaoKernel.push(sample)
    }
    var ssaoKernelData = new Float32Array(flatten(ssaoKernel))

    var ssaoNoise = [];
    for(var i=0; i<64; i++) {
        var sample = [
            random.float() * 2 - 1,
            random.float() * 2 - 1,
            0,
            1
        ]
        ssaoNoise.push(sample)
    }
    var ssaoNoiseData = new Float32Array(flatten(ssaoNoise))

    this.ssaoKernelMap = ctx.createTexture2D(ssaoKernelData, 8, 8, { format: ctx.RGBA, type: ctx.FLOAT, minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, repeat: true });
    this.ssaoNoiseMap = ctx.createTexture2D(ssaoNoiseData, 4, 4, { format: ctx.RGBA, type: ctx.FLOAT, minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, repeat: true });
}

Renderer.prototype.initSkybox = function() {
    var ctx = this._ctx;
    
    this._skyEnvMapTex = new SkyEnvMap(ctx, State.sunPosition);
    this._skybox = new Skybox(ctx, this._skyEnvMap);
    this._reflectionProbe = new ReflectionProbe(ctx, [0, 0, 0]);
}

Renderer.prototype.addNode = function(node) {
    this._nodes.push(node);
    return node;
}

Renderer.prototype.addMaterial = function(material) {
    this._materials.push(material);
    return material;
}

Renderer.prototype.createNode = function(props) {
    var node = {};
    for(var propName in props) {
        node[propName] = props[propName];
    }
    this.initNode(node);
    return this.addNode(node); //TODO: don't add newly created node, e.g. gltfl loader would like to first create nodes then add them
}

Renderer.prototype.initNode = function(node) {
    var ctx = this._ctx;

    node._parent = null;
    node._children = [];
    node._localTransform = Mat4.create();
    node._globalTransform = Mat4.create();

    if (!node.position) node.position = [0,0,0];
    if (!node.scale) node.scale = [1,1,1];
    if (!node.rotation) node.rotation = [0,0,0,1];

    if (node.mesh) {
        var material = node.material
        if (!material) { material = node.material = {} }
        if (!material.baseColorMap && (material.baseColor === undefined)) { material.baseColor = [0.95, 0.95, 0.95, 1] } 
        if (!material.metallicMap && (material.metallic === undefined)) { material.metallic = 0.0 } 
        if (!material.roughnessMap && (material.roughness === undefined)) { material.roughness = 0.5 } 
        if (!material._uniforms) { material._uniforms = {}}
    }
    if (node.light) {
        if (node.light.type == 'directional') {
            if (node.light.shadows === undefined) { node.light.shadows = true; }
            node.light._colorMap = ctx.createTexture2D(null, 1024, 1024); //TODO: remove this
            node.light._shadowMap = ctx.createTexture2D(null, 1024, 1024, { format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT});
            node.light._viewMatrix = Mat4.create();
            node.light._projectionMatrix = Mat4.create();
        }
        else {
            throw new Error('Renderer.initNode unknown light type ' + node.light.type);
        }
    }
}

Renderer.prototype.getNodes = function(type) {
    return this._nodes.filter(function(node) { return node[type] != null; });
}

Renderer.prototype.getMeshNodes = function() {
    return this.getNodes('mesh');
}

Renderer.prototype.getCameraNodes = function() {
    return this.getNodes('camera');
}

Renderer.prototype.getLightNodes = function() {
    return this.getNodes('light');
}

Renderer.prototype.getOverlays = function() {
    return this.getNodes('overlay');
}

Renderer.prototype.updateShadowmaps = function() {
    var ctx = this._ctx;
    var lightNodes = this.getLightNodes();

    ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.VIEWPORT_BIT);
    ctx.bindFramebuffer(this._shadowMapFbo);

    lightNodes.forEach(function(lightNode) {
        var light = lightNode.light;

        light._near = 4;//-8;
        light._far = 25;
        Mat4.lookAt(light._viewMatrix, [State.sunPosition[0]*7.5, State.sunPosition[1]*7.5, State.sunPosition[2]*7.5], [0,-2,0], [0, 1, 0]);
        Mat4.perspective(light._projectionMatrix, 90, 1, light._near, light._far);
        Mat4.ortho(light._projectionMatrix, -6, 6, -6, 6, light._near, light._far);
        ctx.setViewMatrix(light._viewMatrix);
        ctx.setProjectionMatrix(light._projectionMatrix);
        this._shadowMapFbo.setColorAttachment(0, light._colorMap.getTarget(), light._colorMap.getHandle(), 0);
        this._shadowMapFbo.setDepthAttachment(light._shadowMap.getTarget(), light._shadowMap.getHandle(), 0);


        var points = [[5,0,0], [0,0,0], [-5,0,0]];
        points.forEach(function(p) {
            var tmp = [p[0], p[1], p[2], 1];
            Vec4.multMat4(Vec4.multMat4(tmp, light._viewMatrix), light._projectionMatrix);
        });
        this._shadowMap = light._shadowMap;

        ctx.setViewport(0, 0, light._shadowMap.getWidth(), light._shadowMap.getHeight())

        ctx.setDepthTest(true);
        ctx.setClearColor(0, 0, 0, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        ctx.setColorMask(0,0,0,0);
        this.drawMeshes();
        ctx.setColorMask(1,1,1,1);
    }.bind(this));

    ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.VIEWPORT_BIT);
}

var Vert = fs.readFileSync(__dirname + '/glsl/PBR.vert', 'utf8');
var Frag = fs.readFileSync(__dirname + '/glsl/PBR.frag', 'utf8');

Renderer.prototype.getMeshProgram = function(meshMaterial) {
    var USE_BASE_COLOR_MAP = 1 << 0;
    var USE_METALLIC_MAP   = 1 << 1;
    var USE_ROUGHNESS_MAP  = 1 << 2;
    var USE_NORMAL_MAP     = 1 << 3;

    var ctx = this._ctx;

    var flags = [];
    flags.push('#define SHADOW_QUALITY_' + State.shadowQuality);

    if (meshMaterial.baseColorMap) {
        flags.push('#define USE_BASE_COLOR_MAP');
    }
    if (meshMaterial.metallicMap) {
        flags.push('#define USE_METALLIC_MAP');
    }
    if (meshMaterial.roughnessMap) {
        flags.push('#define USE_ROUGHNESS_MAP');
    }
    if (meshMaterial.normalMap) {
        flags.push('#define USE_NORMAL_MAP');
    }
    flags = flags.join('\n') + '\n';

    if (!this._programCache) {
        this._programCache = {};
    }

    var program = this._programCache[flags];
    if (!program) {
        program = this._programCache[flags] = ctx.createProgram(Vert, flags + Frag);
    }
    return program;
}

Renderer.prototype.drawMeshes = function() {
    var meshNodes = this.getMeshNodes();
    var lightNodes = this.getLightNodes();

    var ctx = this._ctx;

    ctx.setDepthTest(true);

    //TODO: optimize this
    this._nodes.forEach(function(node) {
        Mat4.identity(node._localTransform)
        Mat4.translate(node._localTransform, node.position);
        Mat4.mult(node._localTransform, Mat4.fromQuat(Mat4.create(), node.rotation));
        Mat4.scale(node._localTransform, node.scale);

        if (node.transform) { //TODO: required for GLTF
            Mat4.mult(node._localTransform, node.transform);
        }
    }.bind(this))

    this._nodes.forEach(function(node) {
        Mat4.identity(node._globalTransform)

        var parent = node._parent;
        var stack = [ node._localTransform ]
        while (parent) {
            stack.push(parent._localTransform)
            parent = parent._parent;
        }
        stack.reverse()
        stack.forEach(function(mat) {
            Mat4.mult(node._globalTransform, mat)
        })
    })

    ctx.bindTexture(this._reflectionProbe.getIrradianceMap());
    ctx.bindTexture(lightNodes[0].light.shadowMap, 1);

    var sharedUniforms = {
        uSunPosition: State.sunPosition,
        uSunColor: State.sunColor,
        uLightProjectionMatrix: lightNodes[0].light._projectionMatrix,
        uLightViewMatrix: lightNodes[0].light._viewMatrix,
        uLightNear: lightNodes[0].light._near,
        uLightFar: lightNodes[0].light._far,
        uShadowMap: lightNodes[0].light._shadowMap,
        uShadowMapSize: [lightNodes[0].light._shadowMap.getWidth(), lightNodes[0].light._shadowMap.getHeight()],
        uShadowQuality: State.shadows ? State.shadowQuality : 0,
        uBias: State.bias,
		uReflectionMap: this._reflectionProbe.getReflectionMap(),
        uIrradianceMap: this._reflectionProbe.getIrradianceMap()
    };

    meshNodes.forEach(function(meshNode) {
        var meshUniforms = {
            uIor: 1.4,
            uBaseColor: meshNode.material.baseColor || [0.9,0.9,0.9,0.9],
            uBaseColorMap: meshNode.material.baseColorMap,
            uMetallic: meshNode.material.metallic || 0.1,
            uMetallicMap: meshNode.material.metallicMap,
            uRoughness: meshNode.material.roughness || 1,
            uRoughnessMap: meshNode.material.roughnessMap,
            uNormalMap: meshNode.material.normalMap
        }

        Object.assign(meshNode.material._uniforms, sharedUniforms, meshUniforms);
        var meshUniforms = meshNode.material._uniforms;
        
        var meshProgram = this.getMeshProgram(meshNode.material);

        var numTextures = 0;
		ctx.bindProgram(meshProgram);
		for(var uniformName in meshUniforms) {
			var value = meshUniforms[uniformName];
            if (value === null || value === undefined) {
                if (meshProgram._uniforms[uniformName]) {
                    throw new Error('Null uniform value for ' + uniformName + ' in PBRMaterial');
                }
                else {
                    continue;
                }
            }
			if (value.getTarget && (value.getTarget() == ctx.TEXTURE_2D || value.getTarget() == ctx.TEXTURE_CUBE_MAP)) {
                ctx.bindTexture(value, numTextures);
				value = numTextures++;
			}
			if (meshProgram.hasUniform(uniformName)) {
				meshProgram.setUniform(uniformName, value)
			}
			else {
				//console.log('unknown uniformName', uniformName);
			}
		}
        //if (meshNode.mesh._hasDivisor) {
            //ctx.bindProgram(this._standardInstancedProgram);
            //this._standardInstancedProgram.setUniform('uAlbedoColor', meshNode.material._albedoColor);
            //program = this._standardInstancedProgram;
        //}
        //else if (meshNode.material._albedoColorTexture) {
            //ctx.bindProgram(this._standardProgramTextured);
            //this._standardProgramTextured.setUniform('uAlbedoColorTex', 2);
            //ctx.bindTexture(meshNode.material._albedoColorTexture, 2)
            //program = this._standardProgramTextured;
        //}
        //else {
            //ctx.bindProgram(this._standardProgram);
            //this._standardProgram.setUniform('uAlbedoColor', meshNode.material._albedoColor);
            //program = this._standardProgram;
        //}


        var isVertexArray = meshNode.primitiveType && meshNode.count;

        if (isVertexArray) {
            ctx.bindVertexArray(meshNode.mesh);
        }
        else {
            ctx.bindMesh(meshNode.mesh);
        }

        ctx.pushModelMatrix();
        if (meshNode._globalTransform) {
            ctx.loadIdentity();
            ctx.multMatrix(meshNode._globalTransform)
        }
        else if (meshNode._localTransform) {
            ctx.multMatrix(meshNode._localTransform)
        }
        else {
            ctx.translate(meshNode.position);
            ctx.rotateQuat(meshNode.rotation);
            ctx.scale(meshNode.scale);
        }
        if (isVertexArray) {
            ctx.drawElements(meshNode.primitiveType, meshNode.count, 0);
        }
        else if (meshNode.mesh._hasDivisor) {
            ctx.drawMesh(meshNode.mesh.getAttribute(ctx.ATTRIB_CUSTOM_0).data.length);
        }
        else {
            ctx.drawMesh();
        }
        ctx.popModelMatrix();
    }.bind(this))

    ctx.bindProgram(this._solidColorProgram);
    this._solidColorProgram.setUniform('uColor', [1,0,0,1])

    this._nodes.forEach(function(node) {
        ctx.pushModelMatrix();
        if (node._globalTransform) {
            ctx.loadIdentity();
            ctx.multMatrix(node._globalTransform)
        }
        if (this._debug && node._bbox) {
            this._debugDraw.debugAABB(node._bbox)
        }
        ctx.popModelMatrix();
    }.bind(this));
}

Renderer.prototype.draw = function() {
    var ctx = this._ctx;

    var flags = 0;
    flags |= ctx.COLOR_BIT | ctx.DEPTH_BIT | ctx.BLEND_BIT;
    flags |= ctx.MATRIX_PROJECTION_BIT | ctx.MATRIX_VIEW_BIT | ctx.MATRIX_MODEL_BIT
    flags |= ctx.PROGRAM_BIT | ctx.MESH_BIT;
    //ctx.pushState(flags);

    ctx.setClearColor(State.backgroundColor[0], State.backgroundColor[1], State.backgroundColor[2], State.backgroundColor[3]);
    ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

    var cameraNodes = this._nodes.filter(function(node) { return node.camera != null; });
    var meshNodes = this._nodes.filter(function(node) { return node.mesh != null; });
    var lightNodes = this._nodes.filter(function(node) { return node.light != null; });

    var cameraNodes = this.getCameraNodes();
    if (cameraNodes.length == 0) {
        console.log('WARN: Renderer.draw no cameras found');
        return;
    }

    if (!Vec3.equals(State.prevSunPosition, State.sunPosition) || State.dirtySky) {
        State.dirtySky = false;
        //TODO: update sky only if it's used
        this._skyEnvMapTex.setSunPosition(State.sunPosition);
        this._skybox.setEnvMap(State.skyEnvMap || this._skyEnvMapTex);
        Vec3.set(State.prevSunPosition, State.sunPosition);
        this._reflectionProbe.update(function() {
            this._skybox.draw();
        }.bind(this));
        this.updateShadowmaps();
    }

    //draw scene

    ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.VIEWPORT_BIT);
    ctx.bindFramebuffer(this._frameFbo);
    ctx.setViewport(0, 0, this._width, this._height);

    ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

    var currentCamera = this.getCameraNodes()[0].camera;
    ctx.setViewMatrix(currentCamera.getViewMatrix());
    ctx.setProjectionMatrix(currentCamera.getProjectionMatrix());

    this._skybox.draw();
    this.drawMeshes();

    ctx.popState();
    var W = this._width;
    var H = this._height;

    var root = this._fx.reset();
    var color = root.asFXStage(this._frameColorTex, 'img');
    var final = color;
    if (State.ssao) {
        var ssao = root.ssao({ depthMap: this._frameDepthTex, normalMap: this._frameNormalTex, kernelMap: this.ssaoKernelMap, noiseMap: this.ssaoNoiseMap, camera: currentCamera, width: W/2, height: H/2 });
        ssao = ssao.blur3().blur3();
        //TODO: this is incorrect, AO influences only indirect diffuse (irradiance) and indirect specular reflections
        //this will also influence direct lighting (lights, sun)
        final = color.mult(ssao, { bpp: 16 });
    }
    final = final.postprocess({ exposure: State.exposure })
    final = final.fxaa()
    var viewport = ctx.getViewport();
    final.blit({ x: viewport[0], y: viewport[1], width: viewport[2], height: viewport[3]});

    //overlays

    ctx.bindProgram(this._overlayProgram);
    this._overlayProgram.setUniform('uScreenSize', [this._width, this._height]);
    this._overlayProgram.setUniform('uOverlay', 0);
    ctx.bindMesh(this._fsqMesh);
    ctx.setDepthTest(false);
    ctx.setBlend(true);
    ctx.setBlendFunc(ctx.ONE, ctx.ONE);
    this.getOverlays().forEach(function(overlayNode) {
        ctx.bindTexture(overlayNode.overlay);
        ctx.drawMesh();
    }.bind(this));

    ctx.setBlend(false);
    //ctx.popState(flags);

    if (this._debug) {
        ctx.bindProgram(this._showColorsProgram);
        this._debugDraw.setColor([1,0,0,1]);
        var lightNodes = this.getLightNodes();

        this._debugDraw.setLineWidth(2);
        lightNodes.forEach(function(lightNode) {
            var light = lightNode.light;
            var invProj = Mat4.invert(Mat4.copy(light.projectionMatrix));
            var invView = Mat4.invert(Mat4.copy(light.viewMatrix));
            var corners = [[-1, -1, 1, 1], [1, -1, 1,1], [1, 1, 1,1], [-1, 1, 1,1], [-1, -1, -1,1], [1, -1, -1,1], [1, 1, -1,1], [-1, 1, -1,1]].map(function(p) {
                var v = Vec4.multMat4(Vec4.multMat4(Vec4.copy(p), invProj), invView); 
                Vec3.scale(v, 1/v[3]);
                return v;
            });
            
            var position = Vec3.scale(Vec3.copy(State.sunPosition),7.5);
            this._debugDraw.drawLine(position, corners[0+4]);
            this._debugDraw.drawLine(position, corners[1+4]);
            this._debugDraw.drawLine(position, corners[2+4]);
            this._debugDraw.drawLine(position, corners[3+4]);
            this._debugDraw.drawLine(corners[3], corners[0]);
            this._debugDraw.drawLine(corners[0], corners[1]);
            this._debugDraw.drawLine(corners[1], corners[2]);
            this._debugDraw.drawLine(corners[2], corners[3]);
            this._debugDraw.drawLine(corners[3], corners[4+3]);
            this._debugDraw.drawLine(corners[0], corners[4+0]);
            this._debugDraw.drawLine(corners[1], corners[4+1]);
            this._debugDraw.drawLine(corners[2], corners[4+2]);
            this._debugDraw.drawLine(corners[4+3], corners[4+0]);
            this._debugDraw.drawLine(corners[4+0], corners[4+1]);
            this._debugDraw.drawLine(corners[4+1], corners[4+2]);
            this._debugDraw.drawLine(corners[4+2], corners[4+3]);
        }.bind(this));
    }
}

module.exports = Renderer;
