module.exports = /* glsl */ `
#if !defined(USE_TANGENTS) && (defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP))
  //http://www.thetenthplanet.de/archives/1180
  mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
    // get edge vectors of the pixel triangle
    highp vec3 dp1 = dFdx(p);
    highp vec3 dp2 = dFdy(p);
    highp vec2 duv1 = dFdx(uv);
    highp vec2 duv2 = dFdy(uv);

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
#endif
`
