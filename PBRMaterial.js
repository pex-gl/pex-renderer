var glslify        = require('glslify-sync');
var isBrowser      = require('is-browser');
var fs             = require('fs');
var Texture2D      = require('pex-context/Texture2D');

var Vert = fs.readFileSync(__dirname + '/glsl/PBR.vert', 'utf8');
var Frag = fs.readFileSync(__dirname + '/glsl/PBR.frag', 'utf8');

function PBRMaterial(ctx, uniforms, watch) {
    uniforms = uniforms || {};
    this.ctx = ctx;
    this.uniforms = Object.assign({
        uBaseColor: [0,0,0,1],
        uBaseColorMap: null,
        uMetallic: 0.0,
        uMetallicMap: null,
        uRoughness: 0.5,
        uRoughnessMap: null,
        uExposure: 0.5,
        uLightPos: [10, 10, 0],
        uReflectionMap: null,
        uIrradianceMap: null,
        uNormalMap: null,
        uLightColor: [1,1,1,1],
        uIor: 1.4,
        uTexCoord0Scale: 1,
        uTexCoord0Offset: [0, 0],
        shadowQuality: 3
    }, uniforms)

    this.name = uniforms.name || 'PBR';

    this.compile();

    if (!isBrowser && watch) {
        this.watch();
    }
}

PBRMaterial.prototype.watch = function() {
    console.log('PBRMaterial.watch', __dirname + '/glsl/PBR.frag');
    fs.watchFile(__dirname + '/glsl/PBR.frag', function() {
        console.log('PBRMaterial.watch', __dirname + '/glsl/PBR.frag', 'changed');
        this.reload();
    }.bind(this));
}

PBRMaterial.prototype.reload = function() {
    console.log('PBRMaterial.reload');
    Frag = fs.readFileSync(__dirname + '/glsl/PBR.frag', 'utf8');
    this.compile();
}

PBRMaterial.prototype.compile = function() {
    var ctx = this.ctx;

    var uniforms = this.uniforms;

    var flags = [];

    flags.push('#define SHADOW_QUALITY_' + uniforms.shadowQuality);

    if (uniforms.uBaseColorMap && uniforms.uBaseColorMap.getTarget && (uniforms.uBaseColorMap.getTarget() == ctx.TEXTURE_2D)) {
        flags.push('#define USE_BASE_COLOR_MAP');
    }
    if (uniforms.uMetallicMap && uniforms.uMetallicMap.getTarget && (uniforms.uMetallicMap.getTarget() == ctx.TEXTURE_2D)) {
        flags.push('#define USE_METALLIC_MAP');
    }
    if (uniforms.uRoughnessMap && uniforms.uRoughnessMap.getTarget && (uniforms.uRoughnessMap.getTarget() == ctx.TEXTURE_2D)) {
        flags.push('#define USE_ROUGHNESS_MAP');
    }
    if (uniforms.uNormalMap && uniforms.uNormalMap.getTarget && (uniforms.uNormalMap.getTarget() == ctx.TEXTURE_2D)) {
        flags.push('#define USE_NORMAL_MAP');
    }
    flags = flags.join('\n') + '\n';

    try {
        this.program = ctx.createProgram(Vert, flags + Frag);
    }
    catch(e) {
        console.log(e);
    }
}

module.exports = PBRMaterial;
