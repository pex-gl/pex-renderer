var Vec3 = require('pex-math/Vec3');
var Quat = require('pex-math/Quat');
var Mat4 = require('pex-math/Mat4');
var Draw = require('pex-draw/Draw');
var PerspCamera = require('pex-cam/PerspCamera');
var Node = require('./Node');
var Material = require('./Material');
var glslify = require('glslify-sync');
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
var PBRMaterial = require('./PBRMaterial');
var Texture2D     = require('pex-context/Texture2D');
var TextureCube   = require('pex-context/TextureCube');
var lookup = require('gl-constants/lookup');

var SOLID_COLOR_VERT           = glslify(__dirname + '/glsl/SolidColor.vert');
var SOLID_COLOR_VERT           = glslify(__dirname + '/glsl/SolidColor.vert');
var SOLID_COLOR_FRAG           = glslify(__dirname + '/glsl/SolidColor.frag');
var SHOW_COLORS_VERT           = glslify(__dirname + '/glsl/ShowColors.vert');
var SHOW_COLORS_FRAG           = glslify(__dirname + '/glsl/ShowColors.frag');
var OVERLAY_VERT               = glslify(__dirname + '/glsl/Overlay.vert');
var OVERLAY_FRAG               = glslify(__dirname + '/glsl/Overlay.frag');

var State = {
    backgroundColor : [0.1, 0.1, 0.1, 1],
    sunPosition: [3, 0, 0],
    prevSunPosition: [0, 0, 0],
    exposure: 1.5,
    dirtySky: true,
    frame: 0,
    ssao: true,
    shadows: true,
    shadowQuality: 3
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

    this.createCameraNode();

    this.updateSky();

    this._state = State;
}


Renderer.prototype.initMaterials = function() {
    var ctx = this._ctx;
    this._solidColorProgram = ctx.createProgram(SOLID_COLOR_VERT, SOLID_COLOR_FRAG);
    this._showColorsProgram = ctx.createProgram(SHOW_COLORS_VERT, SHOW_COLORS_FRAG);
    this._pbrMaterial = new PBRMaterial(ctx, {}, true);
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

Renderer.prototype.createNode = function() {
    return this.addNode(new Node()); //TODO: don't add newly created node, e.g. gltfl loader would like to first create nodes then add them
}

Renderer.prototype.createMaterial = function() {
    return this.addMaterial(new Material());
}

Renderer.prototype.createMeshNode = function(mesh, material) {
    var node = this.createNode();
    node.mesh = mesh;
    node.material = material || this.createMaterial();
    return node;
}

Renderer.prototype.createOverlayNode = function(overlay) {
    var node = this.createNode();
    node.overlay = overlay;
    return node;
}

Renderer.prototype.createDirectionalLightNode = function(direction) {
    var ctx = this._ctx;

    var node = this.createNode();

    node.light = {
        type: 'directional',
        direction: direction,
        shadows: true,
        colorMap: ctx.createTexture2D(null, 1024, 1024),
        shadowMap: ctx.createTexture2D(null, 1024, 1024, { format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT}),
        viewMatrix: Mat4.create(),
        projectionMatrix: Mat4.create()
    }
    return node;
}

Renderer.prototype.createCameraNode = function(camera) {
    var node = this.createNode();
    node.camera = camera;
    return node;
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

Renderer.prototype.updateSky = function() {
    var ctx = this._ctx;
}

Renderer.prototype.updateShadowmaps = function() {
    var ctx = this._ctx;
    var lightNodes = this.getLightNodes();

    ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.VIEWPORT_BIT);
    ctx.bindFramebuffer(this._shadowMapFbo);

    lightNodes.forEach(function(lightNode) {
        var light = lightNode.light;

        light.near = 2;
        light.far = 12;
        Mat4.lookAt(light.viewMatrix, [State.sunPosition[0]*7.5, State.sunPosition[1]*7.5, State.sunPosition[2]*7.5], [0,-2,0], [0, 1, 0]);
        Mat4.perspective(light.projectionMatrix, 90, 1, light.near, light.far);
        ctx.setViewMatrix(light.viewMatrix);
        ctx.setProjectionMatrix(light.projectionMatrix);
        this._shadowMapFbo.setColorAttachment(0, light.colorMap.getTarget(), light.colorMap.getHandle(), 0);
        this._shadowMapFbo.setDepthAttachment(light.shadowMap.getTarget(), light.shadowMap.getHandle(), 0);

        this._shadowMap = light.shadowMap;

        ctx.setViewport(0, 0, light.shadowMap.getWidth(), light.shadowMap.getHeight())

        ctx.setDepthTest(true);
        ctx.setClearColor(0, 0, 0, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

        this.drawMeshes();
    }.bind(this));

    ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.VIEWPORT_BIT);
}

Renderer.prototype.drawMeshes = function() {
    var meshNodes = this.getMeshNodes();
    var lightNodes = this.getLightNodes();

    var ctx = this._ctx;

    ctx.setDepthTest(true);

    //TODO: optimize this
    this._nodes.forEach(function(node) {
        Mat4.identity(node._localTransform)
        Mat4.translate(node._localTransform, node._position);
        Mat4.mult(node._localTransform, Mat4.fromQuat(Mat4.create(), node._rotation));
        Mat4.scale(node._localTransform, node._scale);

        if (node._transform) { //TODO: required for GLTF
            Mat4.mult(node._localTransform, node._transform);
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

    ctx.bindProgram(this._standardProgram);


    meshNodes.forEach(function(meshNode) {
        var material = this._pbrMaterial;

		material.uniforms.uReflectionMap = this._reflectionProbe.getReflectionMap();
		material.uniforms.uIrradianceMap = this._reflectionProbe.getIrradianceMap();
        material.uniforms.uAlbedoColor = meshNode.material._albedoColor;

        var program = material.program;
		var numTextures = 0;
		ctx.bindProgram(program);
		for(var uniformName in material.uniforms) {
			var value = material.uniforms[uniformName];
            if (!value) {
                throw new Error('Null uniform value for ' + uniformName + ' in PBRMaterial');
            }
			if (value.getTarget && (value.getTarget() == ctx.TEXTURE_2D || value.getTarget() == ctx.TEXTURE_CUBE_MAP)) {
                ctx.bindTexture(value, numTextures);
				value = numTextures++;
			}
			if (material.program.hasUniform(uniformName)) {
				material.program.setUniform(uniformName, value)
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

        //program.setUniform('uSkyIrradianceMap', 0);
        //program.setUniform('uSunPosition', State.sunPosition);
        //program.setUniform('uLightViewMatrix', lightNodes[0].light.viewMatrix);
        //program.setUniform('uLightProjectionMatrix', lightNodes[0].light.projectionMatrix);
        //program.setUniform('uShadowMap', 1);
        //program.setUniform('uShadowMapSize', [lightNodes[0].light.shadowMap.getWidth(), lightNodes[0].light.shadowMap.getHeight()]);
        //program.setUniform('uShadowQuality', State.shadows ? State.shadowQuality : 0 );
        //program.setUniform('uBias', 0.05);
        //program.setUniform('uLightNear', lightNodes[0].light.near);
        //program.setUniform('uLightFar', lightNodes[0].light.far);

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
            ctx.translate(meshNode._position);
            ctx.rotateQuat(meshNode._rotation);
            ctx.scale(meshNode._scale);
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
        this._skyEnvMapTex.setSunPosition(State.sunPosition);
        this._skybox.setEnvMap(State.skyEnvMap || this._skyEnvMapTex);
        Vec3.set(State.prevSunPosition, State.sunPosition);
        this._reflectionProbe.update(function() {
            this._skybox.draw();
        }.bind(this));
        this.updateShadowmaps();
    }



    //draw scene

    ctx.pushState(ctx.FRAMEBUFFER_BIT);
    ctx.bindFramebuffer(this._frameFbo);

    ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

    var currentCamera = this.getCameraNodes()[0].camera;
    ctx.setViewMatrix(currentCamera.getViewMatrix());
    ctx.setProjectionMatrix(currentCamera.getProjectionMatrix());

    this._skybox.draw();
    this.drawMeshes();

    ctx.popState(ctx.FRAMEBUFFER_BIT);

    var W = this._width;
    var H = this._height;

    var root = this._fx.reset();
    var color = root.asFXStage(this._frameColorTex, 'img');//.fxaa()
    var final = color;
    if (State.ssao || true) {
        var ssao = root.ssao({ depthMap: this._frameDepthTex, normalMap: this._frameNormalTex, kernelMap: this.ssaoKernelMap, noiseMap: this.ssaoNoiseMap, camera: currentCamera, width: W/2, height: H/2 }).blur3().blur3();
        final = color.mult(ssao);
    }
    final = final.postprocess({ exposure: State.exposure })
    final = final.fxaa()
    final.blit();

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
}

module.exports = Renderer;
