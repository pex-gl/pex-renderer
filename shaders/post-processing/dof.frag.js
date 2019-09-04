const SHADERS = require('../chunks/index.js')
module.exports = /* glsl */ `
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

const float GOLDEN_ANGLE = 2.39996323; 
const float MAX_BLUR_SIZE = 20.0; 
const float RAD_SCALE = 0.5; // Smaller = nicer blur, larger = faster

${SHADERS.depthRead}

float getCoCSize(float depth, float focusDistance, float maxCoC) {
    float coc = (1.0 - focusDistance / depth) * maxCoC; // (1 - mm/mm) * mm = mm

    // comment out for new
    // return abs(coc);

    // coc = coc / uSensorHeight; //CoC as % of sensor height // mm / mm
    // coc *= imageSize.y; //CoC in pixels
    return abs(coc) * MAX_BLUR_SIZE;
}

vec3 cosPalette(  float t,  vec3 a,  vec3 b,  vec3 c, vec3 d ){
    float t2 = 0.3 + 0.7 * (1.0 - t);
    return a + b*cos( 6.28318*(c*t2+d) );
}

vec3 depthOfField(vec2 texCoord, float focusDistance, float maxCoC) {
    float resolutionScale = imageSize.y / 1080.0;

    // TODO: is this in meters?
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
          if (depth > focusDistance - 250.0 && depth < focusDistance + 250.0) return vec3(1.0, 1.0, 0.0);
          return vec3(floor(texCoord.y * 10.0)) / 10.0;
        }
        // float centerDepth = readDepth(depthMap, vec2(0.5, texCoord.y), uNear, uFar) * 1000.0; //m -> mm
        float c = 0.025; //0.03mm for 35mm format
        float H = uFocalLength * uFocalLength / (uFStop * c); //mm
        float Dn = H * focusDistance / (H + focusDistance);
        float Df = H * focusDistance / (H - focusDistance);
        if (depth > H - 250.0 && depth < H + 250.0) return vec3(1.0, 1.0, 0.0);
        if (depth < Dn) return vec3(1.0, 0.0, 0.0);
        if (depth > Df) return vec3(1.0, 0.0, 0.0);
        return vec3(0.0, 1.0, 0.0);
        // float val = depth / 1000.0 / 100.0;
        // val = pow(val, 2.2);
        // return vec3(val, 0.0, val);
      }
      // return pow(
        // cosPalette(
          // clamp(abs(coc) * 20.0, 0.0, 1.0),
          // vec3(0.500,0.500,0.500),
          // vec3(0.500,0.500,0.500),
          // vec3(1.000,1.000,1.000),
          // vec3(0.000,0.333,0.667)
        // ),
        // vec3(2.2)
      // );
      // return pow(cosPalette(clamp(abs(coc) * 20.0, 0.0, 1.0), vec3(0.650,0.500,0.310),vec3(-0.650,0.500,0.600),vec3(0.333,0.278,0.278),vec3(0.660,0.000,0.667)), vec3(2.2));
      return vec3(floor(abs(coc) / 0.1 * 100.0) / 100.0, 0.0, 0.0);

      float c = abs(coc);
      c = c / (1.0 + c); // tonemapping to avoid burning the color
      c = pow(c, 2.2); // gamma to linear

      if (coc > 0.0) return vec3(c, 0.0, 0.0);
      else return vec3(0.0, 0.0, c);
    }
    vec3 color = texture2D(image, vTexCoord0).rgb;
    float tot = 1.0;
    float radius = RAD_SCALE; // we have bigger radius but also iterate faster
    // return vec3(centerSize / 0.1, 0.0, 0.0);
    // return vec3(floor(abs(centerSize) / 0.1 * 20.0) / 20.0, 0.0, 0.0);
    
    // setting new to true enables simple blur that behaves better when it comes to f-stop and focal length
    // impact on the blurrines espectially behind the focus in respect to hyperfocal distance (H) plane
    bool new = false;
    for (float ang = 0.0; ang < 180.0; ang += GOLDEN_ANGLE){
        vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * uPixelSize * radius * resolutionScale;
        if (new) {
          vec3 sampleColor = texture2D(image, tc).rgb;
          color += sampleColor;
          tot += 1.0;
          radius += RAD_SCALE/radius;
          if (tot > centerSize * 100.0) {
            break;
          }
        } else {
        vec3 sampleColor = texture2D(image, tc).rgb;
        float sampleDepth = readDepth(depthMap, tc, uNear, uFar) * 1000.0; //m -> mm;
        float sampleSize = getCoCSize(sampleDepth, focusDistance, maxCoC);
        if (sampleDepth > centerDepth)
            sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
        float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
        color += mix(color/tot, sampleColor, m);
        tot += 1.0;
        radius += RAD_SCALE/radius;
        // if (radius * resolutionScale > MAX_BLUR_SIZE * resolutionScale) {
            // break;
        // }
        }
    }
    // return vec3(tot / 100.0);
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
