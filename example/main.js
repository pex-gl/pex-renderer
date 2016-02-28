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

var ASSETS_DIR    = isBrowser ? '' : __dirname + '/';

Window.create({
    settings: {
        type: '3d',
        width: 1280,
        height: 720,
        fullScreen: isBrowser
    },
    sunPosition: [0, 5, -5],
    elevation: 25,
    azimuth: 0,
    elevationMat: Mat4.create(),
    rotationMat: Mat4.create(),
    init: function() {
        var res = this.getResources();
        var ctx = this.getContext();

        var renderer = this.renderer = new Renderer(ctx, this.getWidth(), this.getHeight());
        renderer._state.exposure = 2.0;

        this.camera = new PerspCamera(45, this.getAspectRatio(), 0.001, 100.0);;
        this.camera.lookAt([2.5,0,0], [0,0,0]);
        renderer.createCameraNode(this.camera);

        this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight());
        this.addEventListener(this.arcball);

        var sunDir = Vec3.normalize([1, 0.1, 0]);
        this.sunLightNode = renderer.createDirectionalLightNode(sunDir);

        for(var i=0; i<10; i++) {
            var node = renderer.createMeshNode(this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2)))
            node._position[0] = Math.random() * 2 - 1;
            node._position[2] = Math.random() * 2 - 1;
        }

        var floorMesh = this.buildMesh(createCube(14, 0.02, 44));
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
            { data: geometry.uvs, location: ctx.ATTRIB_TEX_COORD_0 },
            { data: geometry.normals, location: ctx.ATTRIB_NORMAL }
        ];
        var indices = { data: geometry.cells };
        return ctx.createMesh(attributes, indices, primitiveType);
    },
    draw: function() {
        this.arcball.apply();
        this.renderer.draw();
    }
})
