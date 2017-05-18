attribute vec3 aPosition;

#ifdef USE_INSTANCED_OFFSET
attribute vec3 aOffset;
#endif

#ifdef USE_SKIN
attribute vec4 aJoint;
attribute vec4 aWeight;
uniform mat4 uJointMat[NUM_JOINTS];
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

void main() {
    vec3 position = aPosition;
#ifdef USE_INSTANCED_OFFSET
    position += aOffset; 
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
