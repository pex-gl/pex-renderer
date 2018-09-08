const envMapEquirect = require('./lib/glsl-envmap-equirect/index.glsl.js');
const encode = require('./encode.glsl.js')
const decode = require('./decode.glsl.js')
const tonemapUncharted2 = require('./lib/glsl-tonemap-uncharted2/index.glsl.js')

module.exports = `
#ifdef GL_ES
precision highp float;
#ifdef USE_DRAW_BUFFERS
#extension GL_EXT_draw_buffers : require
#endif
#endif

${envMapEquirect}
${encode}
${decode}

#define USE_TONEMAPPING
uniform bool uUseTonemapping;
#ifdef USE_TONEMAPPING
${tonemapUncharted2}
uniform float uExposure;
#endif

//assuming texture in Linear Space
//most likely HDR or Texture2D with sRGB Ext
uniform sampler2D uEnvMap;
uniform int uEnvMapEncoding;
uniform int uOutputEncoding;
uniform float uBackgroundBlur;

varying vec3 wcNormal;

vec2 envMapOctahedral(vec3 dir) {
  dir /= dot(vec3(1.0), abs(dir));
  // Add epsylon to avoid bottom face flickering when sampling irradiance
  dir += 0.00001;
  if (dir.y < 0.0) {
    dir.xy = vec2(1.0 - abs(dir.zx)) * sign(dir.xz);
  }
  else {
    dir.xy = dir.xz;
  }
  dir.xy = dir.xy * 0.5;
  dir.xy += 0.5; // move to center
  // dir.xy = (dir.xy * 64.0 + 1.0) / 66.0;
  return dir.xy;
}

vec3 getIrradiance(vec3 normalWorld) {
  vec2 uv = envMapOctahedral(normalWorld);
  float width = 2048.0;
  float irrSize = 64.0;
  uv += 0.5 / irrSize;
  uv /= irrSize / (irrSize - 1.0);
  uv = (uv * irrSize + vec2(2048.0 - irrSize)) / width;
  return decode(texture2D(uEnvMap, uv), uEnvMapEncoding).rgb;
}

void main() {
    vec3 N = normalize(wcNormal);

    vec4 color = vec4(0.0);
    
    if (uBackgroundBlur <= 0.0) {
      color = decode(texture2D(uEnvMap, envMapEquirect(N)), uEnvMapEncoding);
    } else {
      color = vec4(getIrradiance(N), 1.0);
    }
#ifdef USE_TONEMAPPING
  if (uUseTonemapping) {
    color.rgb *= uExposure;
    color.rgb = tonemapUncharted2(color.rgb);
  }
#endif // USE_TONEMAPPING
    gl_FragData[0] = encode(color, uOutputEncoding);
#ifdef USE_DRAW_BUFFERS
    gl_FragData[1] = vec4(0.0);
#endif
}
`
