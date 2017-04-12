#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: sky = require('../local_modules/glsl-sky')
#pragma glslify: atmosphere = require(glsl-atmosphere) 

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
  float v = vTexCoord0.y;

  float tx = 2.0 * u - 1.0;
  float ty = 2.0 * v - 1.0;

  float theta = -tx * PI;
  float phi = ty * PI / 2.0;

  float x = cos(phi) * cos(theta);
  float y = sin(phi);
  float z = cos(phi) * sin(theta);

  vec3 N = vec3(x,y,z);
 
  vec3 color = sky(uSunPosition, N);

  gl_FragColor.rgb = color;
  gl_FragColor.a = 1.0;
}
