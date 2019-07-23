module.exports = /* glsl */ `
precision highp float;

varying vec2 vTexCoord0;
uniform sampler2D image; //Image to be processed 
uniform sampler2D depthMap; //Linear depth, where 1.0 == far plane 

uniform vec2 uPixelSize; //The size of a pixel: vec2(1.0/width, 1.0/height) 
uniform float uFar; // Far plane  
uniform float uNear;
uniform float uFocusPoint;
uniform float uFocusScale;

const float GOLDEN_ANGLE = 2.39996323; 
const float MAX_BLUR_SIZE = 20.0; 
const float RAD_SCALE = 0.5; // Smaller = nicer blur, larger = faster


float readDepth(const in sampler2D depthMap, const in vec2 coord, const in float near, const in float far) {
    float z_b = texture2D(depthMap, coord).r;
    float z_n = 2.0 * z_b - 1.0;
    float z_e = 2.0 * near * far / (far + near - z_n * (far - near));
    return z_e;
}

float getBlurSize(float depth, float focusPoint, float focusScale)
{
float coc = clamp((1.0 / focusPoint - 1.0 / depth)*focusScale, -1.0, 1.0);
return abs(coc) * MAX_BLUR_SIZE;
}

vec3 depthOfField(vec2 texCoord, float focusPoint, float focusScale)
{
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
    vec3 color = depthOfField(vTexCoord0,uFocusPoint,uFocusScale);
    gl_FragColor = vec4(color,1);
}

`