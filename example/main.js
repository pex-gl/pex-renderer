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

Window.create({
    settings: {
        type: '3d',
        width: 1280,
        height: 720,
        fullScreen: isBrowser
    },
    resources: {
        envMap: { image: ASSETS_DIR + '/textures/envmaps/Hamarikyu_Bridge_B/Hamarikyu_Bridge_B.jpg' },
        envMapTest: { image: ASSETS_DIR +'/textures/envmaps/test/test.png' }
    },
    sunPosition: [0, 5, -5],
    elevation: 65,
    azimuth: 0,
    mie: 0.000021,
    elevationMat: Mat4.create(),
    rotationMat: Mat4.create(),
    init: function() {
        var res = this.getResources();
        var ctx = this.getContext();
        var gui = this.gui = new GUI(ctx, this.getWidth(), this.getHeight());

        random.seed(0);

        var envMapTex = ctx.createTexture2D(res.envMap);
        var envMapTestTex = ctx.createTexture2D(res.envMapTest);

        gui.addParam('Sun Elevation', this, 'elevation', { min: -90, max: 180 }, this.updateSunPosition.bind(this));
        gui.addParam('Sun Mie', this, 'mie', { min: 0.00001, max: 0.00005 }, this.updateSunPosition.bind(this));
        gui.addTexture2D('EnvMap', envMapTex);
        gui.addTexture2D('EnvMap Test', envMapTestTex);
        this.addEventListener(gui);

        var renderer = this.renderer = new Renderer(ctx, this.getWidth(), this.getHeight());
        renderer._state.exposure = 2.0;
        //renderer._state.skyEnvMap = envMapTex;
        gui.addTexture2D('SkyEnvMap', renderer._skyEnvMapTex, { hdr: true });
        gui.addTextureCube('Reflection Map', renderer._reflectionProbe.getReflectionMap(), { hdr: true });
        //gui.addTextureCube('Reflection Map 64', renderer._reflectionProbe._reflectionMap64, { hdr: true });
        //gui.addTextureCube('Reflection Map 32', renderer._reflectionProbe._reflectionMap32, { hdr: true });
        gui.addTextureCube('Irradiance Map', renderer._reflectionProbe.getIrradianceMap(), { hdr: true });

        this.camera = new PerspCamera(45, this.getAspectRatio(), 0.001, 100.0);;
        this.camera.lookAt([0,0,5], [0,0,0]);
        renderer.createCameraNode(this.camera);

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.addEventListener(this.arcball);

        var sunDir = Vec3.normalize([1, 0.1, 0]);
        this.sunLightNode = renderer.createDirectionalLightNode(sunDir);
        gui.addTexture2D('Shadow Map', this.sunLightNode.light.shadowMap);

        // for(var i=0; i<10; i++) {
        //     var node = renderer.createMeshNode(this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2)))
        //     node._position[0] = Math.random() * 2 - 1;
        //     node._position[2] = Math.random() * 2 - 1;
        // }
        var mesh = this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2));
        for(var i=0; i<1000; i++) {
            var node = renderer.createMeshNode(mesh)
            var x = Math.random() * 10 - 5;
            var z = Math.random() * 10 - 5;
            node._position[0] = x;
            node._position[2] = z;
            node._position[1] = -0.5 + 2*random.noise2(x/2, z/2) + random.noise2(2*x, 2*z);
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

        var node = renderer.createMeshNode(this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2)))
        node._position[0] = 2;
        node._position[1] = 1;

        ctx.setLineWidth(5)

        var floorMesh = this.buildMesh(createCube(14, 0.02, 14));
        var floorNode = renderer.createMeshNode(floorMesh);
        Vec3.set3(floorNode._position, 0, -.3, 0);

        this.updateSunPosition();
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
        this.arcball.apply();
        this.renderer.draw();
        
        var ctx = this.getContext();
        ctx.pushState(ctx.ALL_BIT);
        this.gui.draw()
        ctx.popState();

    }
})
