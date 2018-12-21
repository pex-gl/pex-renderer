const SHADERS = require('../chunks/index.js')

module.exports = /* glsl */`
// Variables
attribute vec3 aPosition;

#ifdef USE_NORMALS
attribute vec3 aNormal;
#endif

#ifdef USE_TANGENTS
attribute vec4 aTangent;
varying vec4 vTangentView;
#endif

#ifdef USE_TEX_COORDS
attribute vec2 aTexCoord0;
#endif

#ifdef USE_INSTANCED_OFFSET
attribute vec3 aOffset;
#endif

#ifdef USE_INSTANCED_SCALE
attribute vec3 aScale;
#endif

#ifdef USE_INSTANCED_ROTATION
attribute vec4 aRotation;
#endif

#ifdef USE_VERTEX_COLORS
attribute vec4 aVertexColor;
varying vec4 vColor;
#endif

#ifdef USE_INSTANCED_COLOR
attribute vec4 aColor;
varying vec4 vColor;
#endif

#ifdef USE_DISPLACEMENT_MAP
uniform sampler2D uDisplacementMap;
uniform mediump float uDisplacement;
#endif

#ifdef USE_SKIN
attribute vec4 aJoint;
attribute vec4 aWeight;
uniform mat4 uJointMat[NUM_JOINTS];
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;
uniform mat4 uInverseViewMatrix;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec2 vTexCoord0;
varying vec3 vPositionWorld;
varying vec3 vPositionView;

// Includes
${SHADERS.math.transposeMat4}
${SHADERS.math.quatToMat4}

void main() {
  vec4 position = vec4(aPosition, 1.0);
  vec3 normal = vec3(0.0, 0.0, 0.0);
  vec2 texCoord = vec2(0.0, 0.0);

#ifdef USE_NORMALS
  normal = aNormal;
#endif

#ifdef USE_TANGENTS
  vec4 tangent = aTangent;
#endif

#ifdef USE_TEX_COORDS
  texCoord = aTexCoord0;
#endif

  vTexCoord0 = texCoord;

#ifdef USE_DISPLACEMENT_MAP
  float h = texture2D(uDisplacementMap, aTexCoord0).r;
  position.xyz += uDisplacement * h * normal;
#endif

#ifdef USE_INSTANCED_SCALE
  position.xyz *= aScale;
#endif

#ifdef USE_INSTANCED_ROTATION
  mat4 rotationMat = quatToMat4(aRotation);
  position = rotationMat * position;

  normal = vec3(rotationMat * vec4(normal, 0.0));
#endif

#ifdef USE_INSTANCED_OFFSET
  position.xyz += aOffset;
#endif

#ifdef USE_VERTEX_COLORS
  vColor = aVertexColor;
#endif

#ifdef USE_INSTANCED_COLOR
  vColor = aColor;
#endif

  vPositionWorld = vec3(uModelMatrix * position);
  vPositionView = vec3(uViewMatrix * vec4(vPositionWorld, 1.0));

#ifdef USE_SKIN
   mat4 skinMat =
    aWeight.x * uJointMat[int(aJoint.x)] +
    aWeight.y * uJointMat[int(aJoint.y)] +
    aWeight.z * uJointMat[int(aJoint.z)] +
    aWeight.w * uJointMat[int(aJoint.w)];

  vNormalView = vec3(uViewMatrix * skinMat * vec4(normal, 0.0));

  #ifdef USE_TANGENTS
    vTangentView.xyz = vec4(uViewMatrix * skinMat * vec4(tangent, 0.0));
    vTangentView.w = tangent.w;
  #endif

  vNormalWorld = normalize(vec3(uInverseViewMatrix * vec4(vNormalView, 0.0)));

  gl_Position = uProjectionMatrix * uViewMatrix * skinMat * position;
#else
  vNormalView = vec3(uNormalMatrix * normal);

  #ifdef USE_TANGENTS
    vTangentView.xyz = vec3(uNormalMatrix * tangent.xyz);
    vTangentView.w = tangent.w;
  #endif

  vNormalWorld = normalize(vec3(uInverseViewMatrix * vec4(vNormalView, 0.0)));

  gl_Position = uProjectionMatrix * vec4(vPositionView, 1.0);
#endif
}
`
