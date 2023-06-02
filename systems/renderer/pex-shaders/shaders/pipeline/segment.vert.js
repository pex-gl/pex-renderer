export default /* glsl */ `
attribute vec3 aPosition;
attribute vec3 aPointA;
attribute vec3 aPointB;
attribute vec4 aColorA;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

uniform float uLineWidth;
uniform vec2 uResolution;
uniform float uLineZOffset;

varying vec4 vColor;

#define HOOK_VERT_DECLARATIONS_END

void main() {
  vColor = aColorA;
  vec4 clip0 = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPointA, 1.0);
  vec4 clip1 = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPointB, 1.0);
  vec2 screen0 = uResolution * (0.5 * clip0.xy/clip0.w + 0.5);
  vec2 screen1 = uResolution * (0.5 * clip1.xy/clip1.w + 0.5);

  vec2 xBasis = normalize(screen1 - screen0);
  vec2 yBasis = vec2(-xBasis.y, xBasis.x);
  vec2 pt0 = screen0 + aColorA.a * uLineWidth * (aPosition.x * xBasis + aPosition.y * yBasis);
  vec2 pt1 = screen1 + aColorA.a * uLineWidth * (aPosition.x * xBasis + aPosition.y * yBasis);
  vec2 pt = mix(pt0, pt1, aPosition.z);
  vec4 clip = mix(clip0, clip1, aPosition.z);

  gl_Position = vec4(clip.w * ((2.0 * pt) / uResolution - 1.0), clip.z + uLineZOffset, clip.w);

  if (length(aPointA) == 0.0 || length(aPointB) == 0.0) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  }

  #define HOOK_VERT_END
}
`;
