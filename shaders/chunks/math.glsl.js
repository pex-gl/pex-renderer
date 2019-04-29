const PI = /* glsl */`
const float PI = 3.14159265359;
`
const TWO_PI = /* glsl */`
const float TWO_PI = 6.28318530718;
`

const saturate = /* glsl */`
#define MEDIUMP_FLT_MAX    65504.0
#define MEDIUMP_FLT_MIN    0.00006103515625

#ifdef TARGET_MOBILE
#define FLT_EPS            MEDIUMP_FLT_MIN
#define saturateMediump(x) min(x, MEDIUMP_FLT_MAX)
#else
#define FLT_EPS            1e-5
#define saturateMediump(x) x
#endif

#define saturate(x) clamp(x, 0.0, 1.0)
`

const quatToMat4 = /* glsl */`
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
`

// Transpose
// const transposeFloat = /* glsl */`
// float transpose(float m) {
//   return m;
// }`

// const transposeMat2 = /* glsl */`
// mat2 transpose(mat2 m) {
//   return mat2(m[0][0], m[1][0],
//               m[0][1], m[1][1]);
// }`

const transposeMat3 = /* glsl */`
mat3 transpose(mat3 m) {
  return mat3(m[0][0], m[1][0], m[2][0],
              m[0][1], m[1][1], m[2][1],
              m[0][2], m[1][2], m[2][2]);
}`

const transposeMat4 = /* glsl */`
mat4 transpose(mat4 m) {
  return mat4(
    m[0][0], m[1][0], m[2][0], m[3][0],
    m[0][1], m[1][1], m[2][1], m[3][1],
    m[0][2], m[1][2], m[2][2], m[3][2],
    m[0][3], m[1][3], m[2][3], m[3][3]
  );
}
`

// Inverse
// const inverseFloat = /* glsl */`
// float inverse(float m) {
//   return 1.0 / m;
// }`

// const inverseMat2 = /* glsl */`
// mat2 inverse(mat2 m) {
//   return mat2(m[1][1],-m[0][1],
//              -m[1][0], m[0][0]) / (m[0][0]*m[1][1] - m[0][1]*m[1][0]);
// }`

// const inverseMat3 = /* glsl */`
// mat3 inverse(mat3 m) {
//   float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
//   float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
//   float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];

//   float b01 = a22 * a11 - a12 * a21;
//   float b11 = -a22 * a10 + a12 * a20;
//   float b21 = a21 * a10 - a11 * a20;

//   float det = a00 * b01 + a01 * b11 + a02 * b21;

//   return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
//               b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
//               b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;
// }`

const inverseMat4 = /* glsl */`
mat4 inverse(mat4 m) {
  float
      a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],
      a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],
      a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],
      a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],

      b00 = a00 * a11 - a01 * a10,
      b01 = a00 * a12 - a02 * a10,
      b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11,
      b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30,
      b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31,
      b10 = a21 * a33 - a23 * a31,
      b11 = a22 * a33 - a23 * a32,

      det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  return mat4(
      a11 * b11 - a12 * b10 + a13 * b09,
      a02 * b10 - a01 * b11 - a03 * b09,
      a31 * b05 - a32 * b04 + a33 * b03,
      a22 * b04 - a21 * b05 - a23 * b03,
      a12 * b08 - a10 * b11 - a13 * b07,
      a00 * b11 - a02 * b08 + a03 * b07,
      a32 * b02 - a30 * b05 - a33 * b01,
      a20 * b05 - a22 * b02 + a23 * b01,
      a10 * b10 - a11 * b08 + a13 * b06,
      a01 * b08 - a00 * b10 - a03 * b06,
      a30 * b04 - a31 * b02 + a33 * b00,
      a21 * b02 - a20 * b04 - a23 * b00,
      a11 * b07 - a10 * b09 - a12 * b06,
      a00 * b09 - a01 * b07 + a02 * b06,
      a31 * b01 - a30 * b03 - a32 * b00,
      a20 * b03 - a21 * b01 + a22 * b00) / det;
}`

module.exports = {
  PI,
  TWO_PI,
  saturate,
  transposeMat4,
  quatToMat4,
  transposeMat3,
  inverseMat4
}
