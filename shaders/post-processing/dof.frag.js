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
uniform float uAperture;
uniform float uFocalLength;
uniform bool uDOFDebug;
uniform float uSensorHeight;

const float GOLDEN_ANGLE = 2.39996323; 
const float MAX_BLUR_SIZE = 20.0; 
const float RAD_SCALE = 0.5; // Smaller = nicer blur, larger = faster

${SHADERS.depthRead}

float getCoCSize(float depth, float focusDistance, float maxCoC) {
    float coc = (1.0 - focusDistance / depth) * maxCoC;
    coc = coc / uSensorHeight;
    return abs(coc) * MAX_BLUR_SIZE;
}

vec3 depthOfField(vec2 texCoord, float focusDistance, float maxCoC) {
    //TODO: decide on width vs height depending on aspect ratio
    float screenScale = imageSize.y / 1000.0;

    // TODO: is this in meters?
    float centerDepth = readDepth(depthMap, texCoord,uNear,uFar) / 1000.0;
    float centerSize = getCoCSize(centerDepth, focusDistance, maxCoC);


    if (uDOFDebug && texCoord.x > 0.5) {
      float coc = (1.0 - focusDistance / centerDepth) * maxCoC;
      coc = coc / uSensorHeight;
      coc *= MAX_BLUR_SIZE;

      float c = abs(coc);
      c = c / (1.0 + c); // tonemapping to avoid burning the color
      c = pow(c, 2.2); // gamma to linear

      if (coc > 0.0) return vec3(c, 0.0, 0.0);
      else return vec3(0.0, 0.0, c);
    }
    vec3 color = texture2D(image, vTexCoord0).rgb;
    float tot = 1.0;
    float radius = RAD_SCALE; // we have bigger radius but also iterate faster
    for (float ang = 0.0; ang < 180.0; ang += GOLDEN_ANGLE){
        vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * uPixelSize * radius * screenScale;
        
        vec3 sampleColor = texture2D(image, tc).rgb;
        float sampleDepth = readDepth(depthMap, tc, uNear, uFar) / 1000.0;
        float sampleSize = getCoCSize(sampleDepth, focusDistance, maxCoC);
        if (sampleDepth > centerDepth)
            sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
        float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
        color += mix(color/tot, sampleColor, m);
        tot += 1.0;   
        radius += RAD_SCALE/radius;
        if (radius * screenScale > MAX_BLUR_SIZE * screenScale) {
            break;
        }
    }
    return color /= tot;
}

void main () {

    float F = uFocalLength;

    // uAperture is actually F-Stop, so aperture as a diameter is 1 / uAperture
    float fStop = uAperture;
    float A = uFocalLength / fStop;
    float focusDistance = uFocusDistance / 1000.0; // m -> mm
    float maxCoC = A * F / (focusDistance - F);

    vec3 color = depthOfField(vTexCoord0, focusDistance, maxCoC);
    gl_FragColor = vec4(color, 1.0);
}

`
