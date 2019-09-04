const SHADERS = require('../chunks/index.js')
module.exports = /* glsl */ `
// based on Bokeh depth of field in a single pass
// http://blog.tuxedolabs.com/2018/05/04/bokeh-depth-of-field-in-single-pass.html
precision highp float;

varying vec2 vTexCoord0;
uniform sampler2D image; //Image to be processed
uniform vec2 imageSize;
uniform sampler2D depthMap; //Linear depth, where 1.0 == far plane

uniform vec2 uPixelSize; //The size of a pixel: vec2(1.0/width, 1.0/height)
uniform float uFar; // Far plane
uniform float uNear;
uniform float uFocusDistance;
uniform float uFStop;
uniform float uFocalLength;
uniform bool uDOFDebug;
uniform float uSensorHeight;

const float GOLDEN_ANGLE = 2.39996323;  // rad
const float MAX_BLUR_SIZE = 30.0;
const float RAD_SCALE = 1.0; // Smaller = nicer blur, larger = faster
const float NUM_ITERATIONS = 50.0;

${SHADERS.depthRead}

float getCoCSize(float depth, float focusDistance, float maxCoC) {
  float coc = clamp((1.0 - focusDistance / depth) * maxCoC, -1.0, 1.0); // (1 - mm/mm) * mm = mm
  return abs(coc) * MAX_BLUR_SIZE;
}

vec3 depthOfField(vec2 texCoord, float focusDistance, float maxCoC) {
  float resolutionScale = imageSize.y / 1080.0;

  float centerDepth = readDepth(depthMap, texCoord, uNear, uFar) * 1000.0; //m -> mm
  float centerSize = getCoCSize(centerDepth, focusDistance, maxCoC);

  if (uDOFDebug && texCoord.x > 0.5) {
    float coc = (1.0 - focusDistance / centerDepth) * maxCoC;
    if (texCoord.x > 0.90) {
      float depth = texCoord.y * 1000.0 * 100.0; //100m
      if (texCoord.x <= 0.95) { 
        float t = (texCoord.x - 0.9) * 20.0;
        float coc = (1.0 - focusDistance / depth) * maxCoC * 10.0;
        coc = abs(coc);
        if (coc > t) return vec3(1.0);
        return vec3(0.0);
      }
      if (texCoord.x > 0.97) {
        if (depth > focusDistance - 250.0 && depth < focusDistance + 250.0) {
          return vec3(1.0, 1.0, 0.0);
        }
        return vec3(floor(texCoord.y * 10.0)) / 10.0;
      }
      float c = 0.03; //0.03mm for 35mm format
      float H = uFocalLength * uFocalLength / (uFStop * c); //mm
      float Dn = H * focusDistance / (H + focusDistance);
      float Df = H * focusDistance / (H - focusDistance);
      if (depth > H - 250.0 && depth < H + 250.0) return vec3(1.0, 1.0, 0.0);
      if (depth < Dn) return vec3(1.0, 0.0, 0.0);
      if (depth > Df) return vec3(1.0, 0.0, 0.0);
      return vec3(0.0, 1.0, 0.0);
    }
    return vec3(floor(abs(coc) / 0.1 * 100.0) / 100.0, 0.0, 0.0);

    float c = abs(coc);
    c = c / (1.0 + c); // tonemapping to avoid burning the color
    c = pow(c, 2.2); // gamma to linear

    if (coc > 0.0) return vec3(c, 0.0, 0.0);
    else return vec3(0.0, 0.0, c);
  }
  vec3 color = texture2D(image, vTexCoord0).rgb;
  float tot = 1.0;
  float radius = RAD_SCALE;
  for (float ang = 0.0; ang < GOLDEN_ANGLE * NUM_ITERATIONS; ang += GOLDEN_ANGLE){
    vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * uPixelSize * radius * resolutionScale;
    vec3 sampleColor = texture2D(image, tc).rgb;
    float sampleDepth = readDepth(depthMap, tc, uNear, uFar) * 1000.0; //m -> mm;
    float sampleSize = getCoCSize(sampleDepth, focusDistance, maxCoC);
    if (sampleDepth > centerDepth)
      sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
    color += mix(color/tot, sampleColor, m);
    tot += 1.0;
    radius += RAD_SCALE / radius;

    // Not sure if this ever happens as we exit after 50 iterations anyway
    if (radius > MAX_BLUR_SIZE) {
       break;
    }
  }
  return color /= tot;
}

void main () {
  float F = uFocalLength;

  float A = F / uFStop;
  float focusDistance = uFocusDistance * 1000.0; // m -> mm
  float maxCoC = A * F / (focusDistance - F); //mm * mm / mm = mm

  vec3 color = depthOfField(vTexCoord0, focusDistance, maxCoC);
  gl_FragColor = vec4(color, 1.0);
}


`
