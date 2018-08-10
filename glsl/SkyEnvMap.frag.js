const sky = require('./lib/glsl-sky/index.glsl.js')
const encodeRGBM = require('./lib/glsl-rgbm/encode.glsl.js')
const atmosphere = require('./lib/glsl-atmosphere/index.glsl.js')

module.exports = `
#ifdef GL_ES
precision highp float;
#endif

${sky}
${encodeRGBM}
${atmosphere}

#ifndef PI
#define PI 3.141592653589793
#endif

uniform vec3 uSunPosition;

varying vec2 vTexCoord0;

void main() {
  //Texture coordinates to Normal is Based on
  //http://gl.ict.usc.edu/Data/HighResProbes/
  // u=[0,2], v=[0,1],
  // theta=pi*(u-1), phi=pi*v
  // (Dx,Dy,Dz) = (sin(phi)*sin(theta), cos(phi), -sin(phi)*cos(theta)).

  float u = vTexCoord0.x;
  float v = 1.0 - vTexCoord0.y; // uv's a Y flipped in WebGL

  float theta = PI * (u * 2.0 - 1.0);
  float phi = PI * v;

  float x = sin(phi) * sin(theta);
  float y = cos(phi);
  float z = -sin(phi) * cos(theta);

  vec3 N = vec3(x, y, z);

  vec3 color = sky(uSunPosition, N);

  // if (uRGBM) {
    // gl_FragColor = encodeRGBM(color);
  // } else {
    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
  // }
}
`
