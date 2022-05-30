import SHADERS from "../chunks/index.js";

export default /* glsl */ `
// https://gist.github.com/fisch0920/6770311
// Updated by marcin.ignac@gmail.com 2017-05-08
#ifdef USE_STANDARD_DERIVATIVES
  #extension GL_OES_standard_derivatives : require
#endif

precision mediump float;

// total number of samples at each fragment
#define NUM_SAMPLES 11

#define NUM_SPIRAL_TURNS 7

#define USE_ACTUAL_NORMALS false

#define VARIATION 1

#define PI 3.14159265359

uniform sampler2D uDepthMap;
uniform sampler2D uNormalMap;
uniform sampler2D uNoiseMap;

uniform float uFOV;
uniform float uIntensity;
uniform vec2  uNoiseScale;
uniform float uSampleRadiusWS;
uniform float uBias;
uniform float uNear;
uniform float uFar;
uniform float uFov;
uniform mat4 viewProjectionInverseMatrix;
uniform mat4 viewMatrix;
uniform vec2 uScreenSize;
uniform vec3 cameraPositionWorldSpace;

// reconstructs view-space unit normal from view-space position
${SHADERS.depthRead}

vec3 getPositionVSOld(vec2 uv) {
  // float depth = decodeGBufferDepth(uDepthMap, uv, clipFar);
  float depth = readDepth(uDepthMap, uv, uNear, uFar);

  vec2 uv2  = uv * 2.0 - vec2(1.0);
  vec4 temp = viewProjectionInverseMatrix * vec4(uv2, -1.0, 1.0);
  vec3 cameraFarPlaneWS = (temp / temp.w).xyz;

  vec3 cameraToPositionRay = normalize(cameraFarPlaneWS - cameraPositionWorldSpace);
  vec3 originWS = cameraToPositionRay * depth + cameraPositionWorldSpace;
  vec3 originVS = (viewMatrix * vec4(originWS, 1.0)).xyz;

  return originVS;
}

vec3 getFarViewDir(vec2 tc) {
  float hfar = 2.0 * tan(uFov/2.0) * uFar;
  float wfar = hfar * uScreenSize.x / uScreenSize.y;
  vec3 dir = (vec3(wfar * (tc.x - 0.5), hfar * (tc.y - 0.5), -uFar));
  return dir;
}

vec3 getViewRay(vec2 tc) {
  vec3 ray = normalize(getFarViewDir(tc));
  return ray;
}


//asumming z comes from depth buffer (ndc coords) and it's not a linear distance from the camera but
//perpendicular to the near/far clipping planes
//http://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/
//assumes z = eye space z
vec3 reconstructPositionFromDepth(vec2 texCoord, float z) {
  vec3 ray = getFarViewDir(texCoord);
  vec3 pos = ray;
  return pos * z / uFar;
}

vec3 getPositionVS(vec2 uv) {
  float depth = readDepth(uDepthMap, uv, uNear, uFar);
  return reconstructPositionFromDepth(uv, depth);
}

// returns a unit vector and a screen-space radius for the tap on a unit disk
// (the caller should scale by the actual disk radius)
vec2 tapLocation(int sampleNumber, float spinAngle, out float radiusSS) {
  // radius relative to radiusSS
  float alpha = (float(sampleNumber) + 0.5) * (1.0 / float(NUM_SAMPLES));
  float angle = alpha * (float(NUM_SPIRAL_TURNS) * 6.28) + spinAngle;

  radiusSS = alpha;
  return vec2(cos(angle), sin(angle));
}

vec3 getOffsetPositionVS(vec2 uv, vec2 unitOffset, float radiusSS) {
  uv = uv + radiusSS * unitOffset * (1.0 / uScreenSize);

  return getPositionVS(uv);
}

float sampleAO(vec2 uv, vec3 positionVS, vec3 normalVS, float sampleRadiusSS,
               int tapIndex, float rotationAngle)
{
  const float epsilon = 0.01;
  float radius2 = uSampleRadiusWS * uSampleRadiusWS;

  // offset on the unit disk, spun for this pixel
  float radiusSS = 0.0;
  vec2 unitOffset = tapLocation(tapIndex, rotationAngle, radiusSS);
  radiusSS *= sampleRadiusSS;

  vec3 Q = getOffsetPositionVS(uv, unitOffset, radiusSS);
  vec3 v = Q - positionVS;

  float vv = dot(v, v);
  float vn = dot(v, normalVS) - uBias;

  // return vv;

#if VARIATION == 0

  // (from the HPG12 paper)
  // Note large epsilon to avoid overdarkening within cracks
  return float(vv < radius2) * max(vn / (epsilon + vv), 0.0);

#elif VARIATION == 1 // default / recommended

  // Smoother transition to zero (lowers contrast, smoothing out corners). [Recommended]
  float f = max(radius2 - vv, 0.0) / radius2;
  // gl_FragColor = vec4(sampleRadiusSS, 0.0, 0.0, 1.0);
  // return vv / 1000.0;
  return f * f * f * max((vn) / (epsilon + vv), 0.0);

#elif VARIATION == 2

  // Medium contrast (which looks better at high radii), no division.  Note that the
  // contribution still falls off with radius^2, but we've adjusted the rate in a way that is
  // more computationally efficient and happens to be aesthetically pleasing.
  float invRadius2 = 1.0 / radius2;
  return 4.0 * max(1.0 - vv * invRadius2, 0.0) * max(vn, 0.0);

#else

  // Low contrast, no division operation
  return 2.0 * float(vv < radius2) * max(vn, 0.0);

#endif
}

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  vec2 vUV = vec2(gl_FragCoord.x / uScreenSize.x, gl_FragCoord.y / uScreenSize.y);
  vec3 originVS = getPositionVS(vUV);

  vec3 normalVS = texture2D(uNormalMap, vUV).rgb * 2.0 - 1.0;

  vec3 sampleNoise = texture2D(uNoiseMap, vUV * uNoiseScale).xyz;

  //float randomPatternRotationAngle = 2.0 * PI * sampleNoise.x;
  float randomPatternRotationAngle = rand(gl_FragCoord.xy) * PI * 2.0 * sampleNoise.x;

  float radiusSS  = 0.0; // radius of influence in screen space
  float radiusWS  = 0.0; // radius of influence in world space
  float occlusion = 0.0;

  // TODO (travis): don't hardcode projScale
  float projScale = 40.0;//1.0 / (2.0 * tan(uFOV * 0.5));
   // Matrix4 P;
    // camera.getProjectUnitMatrix(Rect2D::xywh(0, 0, width, height), P);
    // const Vector4 projConstant
        // (float(-2.0 / (width * P[0][0])),
         // float(-2.0 / (height * P[1][1])),
         // float((1.0 - (double)P[0][2]) / P[0][0]),
         // float((1.0 + (double)P[1][2]) / P[1][1]));

  // float projScale = 4.0 / (2.0 * tan(uFov * 0.5));
  radiusWS = uSampleRadiusWS;
  radiusSS = projScale * radiusWS / originVS.z;// / originVS.y; // WAT?

  for (int i = 0; i < NUM_SAMPLES; ++i) {
    occlusion += sampleAO(vUV, originVS, normalVS, radiusSS, i,
                          randomPatternRotationAngle);
  }

  occlusion = 1.0 - occlusion / (4.0 * float(NUM_SAMPLES));
  occlusion = clamp(pow(occlusion, 1.0 + uIntensity), 0.0, 1.0);
  gl_FragColor = vec4(occlusion, occlusion, occlusion, 1.0);
}
`;
