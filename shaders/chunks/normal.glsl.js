module.exports = /* glsl */`
#ifdef USE_NORMAL_MAP
uniform sampler2D uNormalMap;
uniform float uNormalScale;

#ifdef USE_NORMAL_MAP_TEX_COORD_TRANSFORM
  uniform mat3 uNormalMapTexCoordTransform;
#endif

//http://www.thetenthplanet.de/archives/1180
mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
  // get edge vectors of the pixel triangle
  vec3 dp1 = dFdx(p);
  vec3 dp2 = dFdy(p);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);

  // solve the linear system
  vec3 dp2perp = cross(dp2, N);
  vec3 dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

  // construct a scale-invariant frame
  float invmax = 1.0 / sqrt(max(dot(T,T), dot(B,B)));
  return mat3(normalize(T * invmax), normalize(B * invmax), N);
}

vec3 perturb(vec3 map, vec3 N, vec3 V, vec2 texcoord) {
  mat3 TBN = cotangentFrame(N, -V, texcoord);
  return normalize(TBN * map);
}

void getNormal(inout PBRData data) {
  #ifdef USE_NORMAL_MAP_TEX_COORD_TRANSFORM
    vec2 texCoord = getTextureCoordinates(data, NORMAL_MAP_TEX_COORD_INDEX, uNormalMapTexCoordTransform);
  #else
    vec2 texCoord = getTextureCoordinates(data, NORMAL_MAP_TEX_COORD_INDEX);
  #endif

  vec3 normalRGB = texture2D(uNormalMap, texCoord).rgb;
  vec3 normalMap = normalRGB * 2.0 - 1.0;
  normalMap.y *= uNormalScale;
  normalMap = normalize(normalMap);

  vec3 N = normalize(data.normalView);
  vec3 V = normalize(data.eyeDirView);

  vec3 normalView;

  #ifdef USE_TANGENTS
    vec3 bitangent = cross(N, data.tangentView.xyz) * sign(data.tangentView.w);
    mat3 TBN = mat3(data.tangentView.xyz, bitangent, N);
    normalView = normalize(TBN * normalMap);
  #else
    // make the output normalView match glTF expected right handed orientation
    normalMap.y *= -1.0;
    normalView = perturb(normalMap, N, V, texCoord);
  #endif

  vec3 normalWorld = vec3(data.inverseViewMatrix * vec4(normalView, 0.0));
  data.normalWorld = normalize(normalWorld);
}
// #elif defined(USE_DISPLACEMENT_MAP)
//   uniform sampler2D uDisplacementMap;
//   uniform float uDisplacement;
//   uniform float uDisplacementNormalScale;

//   vec3 getNormal() {
//     float scale = uDisplacement * uDisplacementNormalScale;
//     float h = scale * texture2D(uDisplacementMap, texCoord).r;
//     float hx = scale * texture2D(uDisplacementMap, texCoord + vec2(1.0 / 2048.0, 0.0)).r;
//     float hz = scale * texture2D(uDisplacementMap, texCoord + vec2(0.0, 1.0 / 2048.0)).r;
//     float meshSize = 20.0;
//     vec3 a = vec3(0.0, h, 0.0);
//     vec3 b = vec3(1.0 / 2048.0 * meshSize, hx, 0.0);
//     vec3 c = vec3(0.0, hz, 1.0 / 2048.0 * meshSize);
//     vec3 N = normalize(cross(normalize(c - a), normalize(b - a)));
//     // FIXME: this is model space normal, need to multiply by modelWorld
//     // N = mat3(uModelMatrix) * N;
//     return N;
//   }
#else
void getNormal(inout PBRData data) {
  // NOP
}
#endif
`
