attribute vec3 aPosition;
#ifdef USE_NORMALS
attribute vec3 aNormal;
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
uniform float uTexCoord0Scale;
uniform vec2 uTexCoord0Offset;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec3 vEyeDirWorld;
varying vec3 vEyeDirView;
varying vec2 vTexCoord0;
varying vec3 vPositionWorld;
varying vec3 vPositionView;

#ifdef GL_ES
mat4 transpose(mat4 m) {
  return mat4(
    m[0][0], m[1][0], m[2][0], m[3][0],
    m[0][1], m[1][1], m[2][1], m[3][1],
    m[0][2], m[1][2], m[2][2], m[3][2],
    m[0][3], m[1][3], m[2][3], m[3][3]
  );
}
#endif

mat4 quatToMat4(vec4 q) {
    float xs = q.x + q.x;
    float ys = q.y + q.y;
    float zs = q.z + q.z;
    float wx = q.w * xs;
    float wy = q.w * ys;
    float wz = q.w * zs;
    float xx = q.x * xs;
    float xy = q.x * ys;
    float xz = q.x * zs;
    float yy = q.y * ys;
    float yz = q.y * zs;
    float zz = q.z * zs;
    return transpose(
        mat4(
            1.0 - (yy + zz), xy - wz, xz + wy, 0.0,
            xy + wz, 1.0 - (xx + zz), yz - wx, 0.0,
            xz - wy, yz + wx, 1.0 - (xx + yy), 0.0,
            0.0, 0.0, 0.0, 1.0
        )
    );
}

void main() {
    vec4 position = vec4(aPosition, 1.0);
    vec3 normal = vec3(0.0, 0.0, 0.0);
    vec2 texCoord = vec2(0.0, 0.0);
#ifdef USE_NORMALS
    normal = aNormal;
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
#ifdef USE_INSTANCED_COLOR
    vColor = aColor; 
#endif
    vPositionWorld = vec3(uModelMatrix * position);
    vPositionView = vec3(uViewMatrix * vec4(vPositionWorld, 1.0));

    vNormalView = vec3(uNormalMatrix * normal);
    vNormalWorld = normalize(vec3(uInverseViewMatrix * vec4(vNormalView, 0.0)));

    vEyeDirView = normalize(vec3(0.0, 0.0, 0.0) - vPositionView);
    vEyeDirWorld = vec3(uInverseViewMatrix * vec4(vEyeDirView, 0.0));

#ifdef USE_SKIN
     mat4 skinMat =
        aWeight.x * uJointMat[int(aJoint.x)] +
        aWeight.y * uJointMat[int(aJoint.y)] +
        aWeight.z * uJointMat[int(aJoint.z)] +
        aWeight.w * uJointMat[int(aJoint.w)];

    gl_Position = uProjectionMatrix * uViewMatrix * skinMat * position;
#else
    gl_Position = uProjectionMatrix * vec4(vPositionView, 1.0);
#endif

    //vTexCoord0 = fract(aTexCoord0 * uTexCoord0Scale * vec2(1.0, 0.5) + uTexCoord0Offset);

}
