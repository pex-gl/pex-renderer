attribute vec4 aColor;
attribute vec4 aPosition;
attribute vec3 aNormal;
attribute vec3 aCustom0; //offset
attribute vec4 aCustom1; //rotation
attribute vec3 aCustom2; //scale
attribute vec4 aCustom3; //color

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;
uniform float uPointSize;

varying vec3 ecNormal;
varying vec3 vWorldPosition;
varying vec4 vColor;

mat4 transpose(mat4 m) {
  return mat4(
    m[0][0], m[1][0], m[2][0], m[3][0],
    m[0][1], m[1][1], m[2][1], m[3][1],
    m[0][2], m[1][2], m[2][2], m[3][2],
    m[0][3], m[1][3], m[2][3], m[3][3]
  );
}

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
    vec3 pos = aPosition.xyz;
    pos *= aCustom2;
    mat4 rotMat = quatToMat4(aCustom1);
    vec4 worldPosition = uModelMatrix * rotMat * vec4(pos, 1.0);
    worldPosition.xyz += aCustom0;
    vWorldPosition = vec3(worldPosition);

    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    gl_PointSize = uPointSize;

    vColor = aCustom3;

    ecNormal = mat3(rotMat) * uNormalMatrix * aNormal;
}
