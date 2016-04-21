var Window        = require('pex-sys/Window');
var MouseEvent    = require('pex-sys/MouseEvent');
var Mat4          = require('pex-math/Mat4');
var Vec3          = require('pex-math/Vec3');
var createSphere  = require('primitive-sphere');
var Draw          = require('pex-draw/Draw');
var PerspCamera   = require('pex-cam/PerspCamera');
var Arcball       = require('pex-cam/Arcball');
var AABB          = require('pex-geom/AABB');
var Renderer      = require('../Renderer');
var parseObj      = require('geom-parse-obj');
var createSphere  = require('primitive-sphere');
var createCube    = require('primitive-cube');
var Draw          = require('pex-draw');
var isBrowser     = require('is-browser');
var GUI           = require('pex-gui');
var random        = require('pex-random');
var ASSETS_DIR    = isBrowser ? 'Assets' : __dirname + '/Assets';
var parseHdr      = require('./local_modules/parse-hdr');

Window.create({
    settings: {
        type: '3d',
        width: 1280,
        height: 720,
        fullScreen: isBrowser
    },
    resources: {
       //envMap: { binary: ASSETS_DIR + '/textures/envmaps/Hamarikyu_Bridge_B/Hamarikyu_Bridge_B.hdr' },
       envMap: { binary: ASSETS_DIR + '/textures/envmaps/garage/garage.hdr' },
       //envMap: { binary: ASSETS_DIR + '/textures/envmaps/uffizi/uffizi.hdr' },
       // envMap: { image: ASSETS_DIR + '/textures/envmaps/test/test.png' },
    },
    sunPosition: [0, 5, -5],
    elevation: 65,
    azimuth: 0,
    mie: 0.000021,
    elevationMat: Mat4.create(),
    rotationMat: Mat4.create(),
    init: function() {
        try {
        var res = this.getResources();
        var ctx = this.getContext();
        var gui = this.gui = new GUI(ctx, this.getWidth(), this.getHeight());
        this.addEventListener(gui);
        random.seed(0);

        gui.addParam('Sun Elevation', this, 'elevation', { min: -90, max: 180 }, this.updateSunPosition.bind(this));
        var renderer = this.renderer = new Renderer(ctx, this.getWidth(), this.getHeight());
       
        gui.addParam('Exposure', this.renderer._state, 'exposure', { min: 0.01, max: 5});

        if (res.envMap) {
            if (res.envMap.width) {
                var envMapTex = ctx.createTexture2D(res.envMap);
            }
            else { //binary
                var envMapInfo = parseHdr(res.envMap);
                var envMapTex = ctx.createTexture2D(envMapInfo.data, envMapInfo.shape[0], envMapInfo.shape[1], {
                    type: ctx.FLOAT
                });
            }
            gui.addTexture2D('EnvMap', envMapTex, { hdr: true });
            renderer._state.skyEnvMap = envMapTex;
        }
        gui.addTexture2D('SkyEnvMap', renderer._skyEnvMapTex, { hdr: true });
        gui.addTextureCube('Reflection Map', renderer._reflectionProbe.getReflectionMap(), { hdr: true });
        gui.addTextureCube('Irradiance Map', renderer._reflectionProbe.getIrradianceMap(), { hdr: true });

        this.camera = new PerspCamera(45, this.getAspectRatio(), 0.1, 20.0);;
        this.camera.lookAt([0,0,5], [0,0,0]);
        renderer.createCameraNode(this.camera);

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.addEventListener(this.arcball);

        var sunDir = Vec3.normalize([1, 0.1, 0]);
        this.sunLightNode = renderer.createDirectionalLightNode(sunDir);
        gui.addTexture2D('Shadow Map', this.sunLightNode.light.shadowMap);

        var mesh = this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2));
        //var mesh = this.buildMesh(createSphere(0.2 + Math.random() * 0.3));
        for(var i=0; i<1000; i++) {
            var node = renderer.createMeshNode(mesh)
            var x = Math.random() * 10 - 5;
            var z = Math.random() * 10 - 5;
            node._position[0] = x;
            node._position[2] = z;
            node._position[1] = -0.5 + 2*random.noise2(x/2, z/2) + random.noise2(2*x, 2*z);
            node.material._albedoColor = [0.69,0.69,0.69,1]
            node.material._roughness = 0.7;//Math.random()*0.99 + 0.01;
            node.material._metalness = 0.0;//Math.random();
        }

        var positions = [];
        var p = [0, 0]
        for(var i=0; i<100; i++) {
            var r = 2;
            if (random.chance(0.5)) {
                p[0] += random.float(-r, r);
            }
            else {
                p[1] += random.float(-r, r);
            }
            positions.push([p[0], 0.2, p[1]]);
        }
        var node = renderer.createMeshNode(this.buildMesh({ positions: positions }, ctx.LINE_STRIP))
        node.material._albedoColor = [0.9,0.9,0.2,1]
        node.material._roughness = 1;

        var node = renderer.createMeshNode(this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2)))
        node._position[0] = 2;
        node._position[1] = 1;
        node.material._roughness = 1;

        ctx.setLineWidth(5)

        var floorMesh = this.buildMesh(createCube(14, 0.02, 14));
        var floorNode = renderer.createMeshNode(floorMesh);
        floorNode.material._roughness = 1;
        Vec3.set3(floorNode._position, 0, -.3, 0);

        this.updateSunPosition();
        }
        catch(e) {
            console.log(e);
            console.log(e.stack);
            process.exit(-1);
        }
    },
    updateSunPosition: function() {
        Mat4.setRotation(this.elevationMat, this.elevation/180*Math.PI, [0, 0, 1]);
        Mat4.setRotation(this.rotationMat, this.azimuth/180*Math.PI, [0, 1, 0]);

        //TODO: set sun direction

        Vec3.set3(this.renderer._state.sunPosition, 1, 0, 0);
        Vec3.multMat4(this.renderer._state.sunPosition, this.elevationMat);
        Vec3.multMat4(this.renderer._state.sunPosition, this.rotationMat);
    },
    buildMesh: function(geometry, primitiveType) {
        var ctx = this.getContext();
        sphere = createSphere();
        var attributes = [
            { data: geometry.positions, location: ctx.ATTRIB_POSITION },
            { data: geometry.uvs || geometry.positions, location: ctx.ATTRIB_TEX_COORD_0 },
            { data: geometry.normals || geometry.positions, location: ctx.ATTRIB_NORMAL }
        ];
        var indices = { data: geometry.cells };
        return ctx.createMesh(attributes, geometry.cells ? indices : null, primitiveType);
    },
    draw: function() {
        try {
        this.arcball.apply();
        this.renderer.draw();
        
        var ctx = this.getContext();
        ctx.pushState(ctx.ALL_BIT);
        this.gui.draw()
        ctx.popState();
        }
        catch(e) {
            console.log(e);
            console.log(e.stack);
            process.exit(-1);
        }
    }
})
