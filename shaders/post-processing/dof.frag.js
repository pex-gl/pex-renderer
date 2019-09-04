const SHADERS = require('../chunks/index.js')
module.exports = /* glsl */ `
precision highp float;

varying vec2 vTexCoord0;
uniform sampler2D image; //Image to be processed 
uniform sampler2D depthMap; //Linear depth, where 1.0 == far plane 

uniform vec2 uPixelSize; //The size of a pixel: vec2(1.0/width, 1.0/height) 
uniform float uFar; // Far plane  
uniform float uNear;
uniform float uFocusDistance;
uniform float uAperture;

const float GOLDEN_ANGLE = 2.39996323; 
const float MAX_BLUR_SIZE = 20.0; 
const float RAD_SCALE = 0.5; // Smaller = nicer blur, larger = faster


${SHADERS.depthRead}

float getBlurSize(float depth, float focusPoint, float focusScale) {
    float coc = clamp((1.0 / focusPoint - 1.0 / depth) * focusScale, -1.0, 1.0);
    return abs(coc) * MAX_BLUR_SIZE;
}

vec3 depthOfField(vec2 texCoord, float focusPoint, float focusScale) {
    float centerDepth = readDepth(depthMap, texCoord,uNear,uFar);
    float centerSize = getBlurSize(centerDepth, focusPoint, focusScale);
    //return vec3(centerSize/2.0);
    vec3 color = texture2D(image, vTexCoord0).rgb;
    float tot = 1.0;
    float radius = RAD_SCALE;
    for (float ang = 0.0; ang < 180.0; ang += GOLDEN_ANGLE){
        vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * uPixelSize * radius;
        vec3 sampleColor = texture2D(image, tc).rgb;
        float sampleDepth = readDepth(depthMap, tc,uNear,uFar);
        float sampleSize = getBlurSize(sampleDepth, focusPoint, focusScale);
        if (sampleDepth > centerDepth)
            sampleSize = clamp(sampleSize, 0.0, centerSize*2.0);
        float m = smoothstep(radius-0.5, radius+0.5, sampleSize);
        color += mix(color/tot, sampleColor, m);
        tot += 1.0;   
        radius += RAD_SCALE/radius;
        if(radius > MAX_BLUR_SIZE){
            break;
        }
    }
    return color /= tot;
}

void main () {
    // remap 1..32 to 32..0
    float focusScale = 32.0 * clamp(1.0 - (uAperture - 1.0) / 32.0, 0.0, 1.0);
    vec3 color = depthOfField(vTexCoord0, uFocusDistance, focusScale);
    gl_FragColor = vec4(color, 1.0);
}

`
