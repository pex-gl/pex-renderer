import SHADERS from "../chunks/index.js";

export default /* glsl */ `
// Variables
attribute vec3 aPosition;

#ifdef USE_NORMALS
attribute vec3 aNormal;
#endif

#ifdef USE_TANGENTS
attribute vec4 aTangent;
varying vec4 vTangentView;
#endif

#ifdef USE_TEXCOORD_0
attribute vec2 aTexCoord0;
#endif

#ifdef USE_TEXCOORD_1
attribute vec2 aTexCoord1;
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

#ifdef USE_INSTANCED_COLOR
attribute vec4 aColor;
#endif

#ifdef USE_VERTEX_COLORS
attribute vec4 aVertexColor;
#endif

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
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

uniform float uPointSize;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec2 vTexCoord0;
#ifdef USE_TEXCOORD_1
varying vec2 vTexCoord1;
#endif
varying vec3 vPositionWorld;
varying vec3 vPositionView;

// Includes
${SHADERS.math.transposeMat4}
${SHADERS.math.quatToMat4}

#define HOOK_VERT_DECLARATIONS_END

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

#ifdef USE_TEXCOORD_0
  texCoord = aTexCoord0;
#endif

  vTexCoord0 = texCoord;

#ifdef USE_TEXCOORD_1
  vTexCoord1 = aTexCoord1;
#endif

#define HOOK_VERT_BEFORE_TRANSFORM

#ifdef USE_DISPLACEMENT_MAP
  float h = texture2D(uDisplacementMap, aTexCoord0).r;
  position.xyz += uDisplacement * h * normal;
#endif

#ifndef USE_SKIN
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

  vec4 positionWorld = uModelMatrix * position;
  vNormalView = uNormalMatrix * normal;
#endif

#ifdef USE_SKIN
  vec4 positionWorld = uModelMatrix * position;

  mat4 skinMat =
    aWeight.x * uJointMat[int(aJoint.x)] +
    aWeight.y * uJointMat[int(aJoint.y)] +
    aWeight.z * uJointMat[int(aJoint.z)] +
    aWeight.w * uJointMat[int(aJoint.w)];

  normal = vec3(skinMat * vec4(normal, 0.0));

  positionWorld = skinMat * position;

  #ifdef USE_INSTANCED_SCALE
  positionWorld.xyz *= aScale;
  #endif

  #ifdef USE_INSTANCED_ROTATION
    mat4 rotationMat = quatToMat4(aRotation);
    positionWorld = rotationMat * positionWorld;

    normal = vec3(rotationMat * vec4(normal, 0.0));
  #endif

  #ifdef USE_INSTANCED_OFFSET
  positionWorld.xyz += aOffset;
  #endif

  #ifdef USE_TANGENTS
  tangent = skinMat * vec4(tangent.xyz, 0.0);
  #endif

  vNormalView = vec3(uViewMatrix * vec4(normal, 0.0));
#else

#endif

#if defined(USE_VERTEX_COLORS) && defined(USE_INSTANCED_COLOR)
  vColor = aVertexColor * aColor;
#else
  #ifdef USE_INSTANCED_COLOR
    vColor = aColor;
  #endif

  #ifdef USE_VERTEX_COLORS
    vColor = aVertexColor;
  #endif
#endif


  vNormalWorld = normalize(vec3(uInverseViewMatrix * vec4(vNormalView, 0.0)));

  vec4 positionView = uViewMatrix * positionWorld;
  vec4 positionOut = uProjectionMatrix * positionView;

  vPositionWorld = positionWorld.xyz / positionWorld.w;
  vPositionView = positionView.xyz / positionView.w;
  gl_Position = positionOut;

  #ifdef USE_TANGENTS
    vTangentView.xyz = vec3(uNormalMatrix * tangent.xyz);
    vTangentView.w = tangent.w;
  #endif

  gl_PointSize = uPointSize;
}
`;
