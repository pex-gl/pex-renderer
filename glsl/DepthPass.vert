attribute vec3 aPosition;

#ifdef USE_INSTANCED_OFFSET
attribute vec3 aOffset;
#endif
#ifdef USE_INSTANCED_SCALE
attribute vec3 aScale;
#endif
#ifdef USE_INSTANCED_ROTATION
attribute vec4 aRotation;
#endif

#ifdef USE_SKIN
attribute vec4 aJoint;
attribute vec4 aWeight;
uniform mat4 uJointMat[NUM_JOINTS];
#endif

#ifdef USE_DISPLACEMENT_MAP
uniform sampler2D uDisplacementMap;
uniform float uDisplacement;
attribute vec2 aTexCoord0;
attribute vec3 aNormal;
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

float uDisplacementShadowStretch = 1.3;

void main() {
    vec3 position = aPosition;
#ifdef USE_DISPLACEMENT_MAP
    vec3 normal = aNormal;
    float h = texture2D(uDisplacementMap, aTexCoord0).r;
    position.xyz += uDisplacement * h * normal * uDisplacementShadowStretch; 
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

#ifdef USE_SKIN
     mat4 skinMat =
        aWeight.x * uJointMat[int(aJoint.x)] +
        aWeight.y * uJointMat[int(aJoint.y)] +
        aWeight.z * uJointMat[int(aJoint.z)] +
        aWeight.w * uJointMat[int(aJoint.w)];

    gl_Position = uProjectionMatrix * uViewMatrix * skinMat * vec4(position, 1.0);
#else
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
#endif
}
