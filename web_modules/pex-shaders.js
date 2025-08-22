import { a as alpha_glsl, c as ambientOcclusion_glsl, d as baseColor_glsl, e as brdf_glsl, f as clearCoat_glsl, g as depthPack_glsl, h as depthRead_glsl, i as depthUnpack_glsl, j as direct_glsl, k as emissiveColor_glsl, l as encodeDecode_glsl, m as indirect_glsl, n as irradiance_glsl, o as lightAmbient_glsl, p as lightArea_glsl, q as lightDirectional_glsl, r as lightPoint_glsl, s as lightSpot_glsl, t as math_glsl, u as metallicRoughness_glsl, v as normal_glsl, w as normalPerturb_glsl, x as octMap_glsl, y as output_glsl, z as pcf_glsl, A as pcss_glsl, B as shadowing_glsl, C as sheenColor_glsl, D as specular_glsl, E as specularGlossiness_glsl, F as textureCoordinates_glsl, G as transmission_glsl, H as frag, I as assignment, J as saturate, T as TWO_PI, K as random, P as PI, L as glslToneMap, M as vert, N as round, O as HALF_PI, Q as inverseMat4, R as transposeMat3 } from './_chunks/index-IVey3wE5.js';
export { S as pipeline } from './_chunks/index-IVey3wE5.js';

/**
 * Reference Implementation: https://github.com/stegu/webgl-noise
 *
 * Copyright (C) 2011 by Ashima Arts (Simplex noise)
 * Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)
 *
 * @alias module:chunks.noise
 * @type {object}
 */ const common = /* glsl */ `
float mod289(float x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

float permute(float x) {
  return mod289(((x * 34.0) + 10.0) * x);
}
vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}
vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}

float taylorInvSqrt(float r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}
vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec2 fade(vec2 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
vec3 fade(vec3 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
vec4 fade(vec4 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;

  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;

  return p;
}

// (sqrt(5) - 1)/4 = F4, used once below
#define F4 0.309016994374947451
`;
const perlin = /* glsl */ `
// 2D
// Classic Perlin noise
float cnoise(vec2 P)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi); // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;
  g01 *= norm.y;
  g10 *= norm.z;
  g11 *= norm.w;

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

// Classic Perlin noise, periodic variant
float pnoise(vec2 P, vec2 rep)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod(Pi, rep.xyxy); // To create noise with explicit period
  Pi = mod289(Pi);        // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;
  g01 *= norm.y;
  g10 *= norm.z;
  g11 *= norm.w;

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

// 3D
// Classic Perlin noise
float cnoise(vec3 P)
{
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

// Classic Perlin noise, periodic variant
float pnoise(vec3 P, vec3 rep)
{
  vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}
// 4D
// Classic Perlin noise
float cnoise(vec4 P)
{
  vec4 Pi0 = floor(P); // Integer part for indexing
  vec4 Pi1 = Pi0 + 1.0; // Integer part + 1
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec4 Pf0 = fract(P); // Fractional part for interpolation
  vec4 Pf1 = Pf0 - 1.0; // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = vec4(Pi0.zzzz);
  vec4 iz1 = vec4(Pi1.zzzz);
  vec4 iw0 = vec4(Pi0.wwww);
  vec4 iw1 = vec4(Pi1.wwww);

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 ixy00 = permute(ixy0 + iw0);
  vec4 ixy01 = permute(ixy0 + iw1);
  vec4 ixy10 = permute(ixy1 + iw0);
  vec4 ixy11 = permute(ixy1 + iw1);

  vec4 gx00 = ixy00 * (1.0 / 7.0);
  vec4 gy00 = floor(gx00) * (1.0 / 7.0);
  vec4 gz00 = floor(gy00) * (1.0 / 6.0);
  gx00 = fract(gx00) - 0.5;
  gy00 = fract(gy00) - 0.5;
  gz00 = fract(gz00) - 0.5;
  vec4 gw00 = vec4(0.75) - abs(gx00) - abs(gy00) - abs(gz00);
  vec4 sw00 = step(gw00, vec4(0.0));
  gx00 -= sw00 * (step(0.0, gx00) - 0.5);
  gy00 -= sw00 * (step(0.0, gy00) - 0.5);

  vec4 gx01 = ixy01 * (1.0 / 7.0);
  vec4 gy01 = floor(gx01) * (1.0 / 7.0);
  vec4 gz01 = floor(gy01) * (1.0 / 6.0);
  gx01 = fract(gx01) - 0.5;
  gy01 = fract(gy01) - 0.5;
  gz01 = fract(gz01) - 0.5;
  vec4 gw01 = vec4(0.75) - abs(gx01) - abs(gy01) - abs(gz01);
  vec4 sw01 = step(gw01, vec4(0.0));
  gx01 -= sw01 * (step(0.0, gx01) - 0.5);
  gy01 -= sw01 * (step(0.0, gy01) - 0.5);

  vec4 gx10 = ixy10 * (1.0 / 7.0);
  vec4 gy10 = floor(gx10) * (1.0 / 7.0);
  vec4 gz10 = floor(gy10) * (1.0 / 6.0);
  gx10 = fract(gx10) - 0.5;
  gy10 = fract(gy10) - 0.5;
  gz10 = fract(gz10) - 0.5;
  vec4 gw10 = vec4(0.75) - abs(gx10) - abs(gy10) - abs(gz10);
  vec4 sw10 = step(gw10, vec4(0.0));
  gx10 -= sw10 * (step(0.0, gx10) - 0.5);
  gy10 -= sw10 * (step(0.0, gy10) - 0.5);

  vec4 gx11 = ixy11 * (1.0 / 7.0);
  vec4 gy11 = floor(gx11) * (1.0 / 7.0);
  vec4 gz11 = floor(gy11) * (1.0 / 6.0);
  gx11 = fract(gx11) - 0.5;
  gy11 = fract(gy11) - 0.5;
  gz11 = fract(gz11) - 0.5;
  vec4 gw11 = vec4(0.75) - abs(gx11) - abs(gy11) - abs(gz11);
  vec4 sw11 = step(gw11, vec4(0.0));
  gx11 -= sw11 * (step(0.0, gx11) - 0.5);
  gy11 -= sw11 * (step(0.0, gy11) - 0.5);

  vec4 g0000 = vec4(gx00.x,gy00.x,gz00.x,gw00.x);
  vec4 g1000 = vec4(gx00.y,gy00.y,gz00.y,gw00.y);
  vec4 g0100 = vec4(gx00.z,gy00.z,gz00.z,gw00.z);
  vec4 g1100 = vec4(gx00.w,gy00.w,gz00.w,gw00.w);
  vec4 g0010 = vec4(gx10.x,gy10.x,gz10.x,gw10.x);
  vec4 g1010 = vec4(gx10.y,gy10.y,gz10.y,gw10.y);
  vec4 g0110 = vec4(gx10.z,gy10.z,gz10.z,gw10.z);
  vec4 g1110 = vec4(gx10.w,gy10.w,gz10.w,gw10.w);
  vec4 g0001 = vec4(gx01.x,gy01.x,gz01.x,gw01.x);
  vec4 g1001 = vec4(gx01.y,gy01.y,gz01.y,gw01.y);
  vec4 g0101 = vec4(gx01.z,gy01.z,gz01.z,gw01.z);
  vec4 g1101 = vec4(gx01.w,gy01.w,gz01.w,gw01.w);
  vec4 g0011 = vec4(gx11.x,gy11.x,gz11.x,gw11.x);
  vec4 g1011 = vec4(gx11.y,gy11.y,gz11.y,gw11.y);
  vec4 g0111 = vec4(gx11.z,gy11.z,gz11.z,gw11.z);
  vec4 g1111 = vec4(gx11.w,gy11.w,gz11.w,gw11.w);

  vec4 norm00 = taylorInvSqrt(vec4(dot(g0000, g0000), dot(g0100, g0100), dot(g1000, g1000), dot(g1100, g1100)));
  g0000 *= norm00.x;
  g0100 *= norm00.y;
  g1000 *= norm00.z;
  g1100 *= norm00.w;

  vec4 norm01 = taylorInvSqrt(vec4(dot(g0001, g0001), dot(g0101, g0101), dot(g1001, g1001), dot(g1101, g1101)));
  g0001 *= norm01.x;
  g0101 *= norm01.y;
  g1001 *= norm01.z;
  g1101 *= norm01.w;

  vec4 norm10 = taylorInvSqrt(vec4(dot(g0010, g0010), dot(g0110, g0110), dot(g1010, g1010), dot(g1110, g1110)));
  g0010 *= norm10.x;
  g0110 *= norm10.y;
  g1010 *= norm10.z;
  g1110 *= norm10.w;

  vec4 norm11 = taylorInvSqrt(vec4(dot(g0011, g0011), dot(g0111, g0111), dot(g1011, g1011), dot(g1111, g1111)));
  g0011 *= norm11.x;
  g0111 *= norm11.y;
  g1011 *= norm11.z;
  g1111 *= norm11.w;

  float n0000 = dot(g0000, Pf0);
  float n1000 = dot(g1000, vec4(Pf1.x, Pf0.yzw));
  float n0100 = dot(g0100, vec4(Pf0.x, Pf1.y, Pf0.zw));
  float n1100 = dot(g1100, vec4(Pf1.xy, Pf0.zw));
  float n0010 = dot(g0010, vec4(Pf0.xy, Pf1.z, Pf0.w));
  float n1010 = dot(g1010, vec4(Pf1.x, Pf0.y, Pf1.z, Pf0.w));
  float n0110 = dot(g0110, vec4(Pf0.x, Pf1.yz, Pf0.w));
  float n1110 = dot(g1110, vec4(Pf1.xyz, Pf0.w));
  float n0001 = dot(g0001, vec4(Pf0.xyz, Pf1.w));
  float n1001 = dot(g1001, vec4(Pf1.x, Pf0.yz, Pf1.w));
  float n0101 = dot(g0101, vec4(Pf0.x, Pf1.y, Pf0.z, Pf1.w));
  float n1101 = dot(g1101, vec4(Pf1.xy, Pf0.z, Pf1.w));
  float n0011 = dot(g0011, vec4(Pf0.xy, Pf1.zw));
  float n1011 = dot(g1011, vec4(Pf1.x, Pf0.y, Pf1.zw));
  float n0111 = dot(g0111, vec4(Pf0.x, Pf1.yzw));
  float n1111 = dot(g1111, Pf1);

  vec4 fade_xyzw = fade(Pf0);
  vec4 n_0w = mix(vec4(n0000, n1000, n0100, n1100), vec4(n0001, n1001, n0101, n1101), fade_xyzw.w);
  vec4 n_1w = mix(vec4(n0010, n1010, n0110, n1110), vec4(n0011, n1011, n0111, n1111), fade_xyzw.w);
  vec4 n_zw = mix(n_0w, n_1w, fade_xyzw.z);
  vec2 n_yzw = mix(n_zw.xy, n_zw.zw, fade_xyzw.y);
  float n_xyzw = mix(n_yzw.x, n_yzw.y, fade_xyzw.x);
  return 2.2 * n_xyzw;
}

// Classic Perlin noise, periodic version
float pnoise(vec4 P, vec4 rep)
{
  vec4 Pi0 = mod(floor(P), rep); // Integer part modulo rep
  vec4 Pi1 = mod(Pi0 + 1.0, rep); // Integer part + 1 mod rep
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec4 Pf0 = fract(P); // Fractional part for interpolation
  vec4 Pf1 = Pf0 - 1.0; // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = vec4(Pi0.zzzz);
  vec4 iz1 = vec4(Pi1.zzzz);
  vec4 iw0 = vec4(Pi0.wwww);
  vec4 iw1 = vec4(Pi1.wwww);

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 ixy00 = permute(ixy0 + iw0);
  vec4 ixy01 = permute(ixy0 + iw1);
  vec4 ixy10 = permute(ixy1 + iw0);
  vec4 ixy11 = permute(ixy1 + iw1);

  vec4 gx00 = ixy00 * (1.0 / 7.0);
  vec4 gy00 = floor(gx00) * (1.0 / 7.0);
  vec4 gz00 = floor(gy00) * (1.0 / 6.0);
  gx00 = fract(gx00) - 0.5;
  gy00 = fract(gy00) - 0.5;
  gz00 = fract(gz00) - 0.5;
  vec4 gw00 = vec4(0.75) - abs(gx00) - abs(gy00) - abs(gz00);
  vec4 sw00 = step(gw00, vec4(0.0));
  gx00 -= sw00 * (step(0.0, gx00) - 0.5);
  gy00 -= sw00 * (step(0.0, gy00) - 0.5);

  vec4 gx01 = ixy01 * (1.0 / 7.0);
  vec4 gy01 = floor(gx01) * (1.0 / 7.0);
  vec4 gz01 = floor(gy01) * (1.0 / 6.0);
  gx01 = fract(gx01) - 0.5;
  gy01 = fract(gy01) - 0.5;
  gz01 = fract(gz01) - 0.5;
  vec4 gw01 = vec4(0.75) - abs(gx01) - abs(gy01) - abs(gz01);
  vec4 sw01 = step(gw01, vec4(0.0));
  gx01 -= sw01 * (step(0.0, gx01) - 0.5);
  gy01 -= sw01 * (step(0.0, gy01) - 0.5);

  vec4 gx10 = ixy10 * (1.0 / 7.0);
  vec4 gy10 = floor(gx10) * (1.0 / 7.0);
  vec4 gz10 = floor(gy10) * (1.0 / 6.0);
  gx10 = fract(gx10) - 0.5;
  gy10 = fract(gy10) - 0.5;
  gz10 = fract(gz10) - 0.5;
  vec4 gw10 = vec4(0.75) - abs(gx10) - abs(gy10) - abs(gz10);
  vec4 sw10 = step(gw10, vec4(0.0));
  gx10 -= sw10 * (step(0.0, gx10) - 0.5);
  gy10 -= sw10 * (step(0.0, gy10) - 0.5);

  vec4 gx11 = ixy11 * (1.0 / 7.0);
  vec4 gy11 = floor(gx11) * (1.0 / 7.0);
  vec4 gz11 = floor(gy11) * (1.0 / 6.0);
  gx11 = fract(gx11) - 0.5;
  gy11 = fract(gy11) - 0.5;
  gz11 = fract(gz11) - 0.5;
  vec4 gw11 = vec4(0.75) - abs(gx11) - abs(gy11) - abs(gz11);
  vec4 sw11 = step(gw11, vec4(0.0));
  gx11 -= sw11 * (step(0.0, gx11) - 0.5);
  gy11 -= sw11 * (step(0.0, gy11) - 0.5);

  vec4 g0000 = vec4(gx00.x,gy00.x,gz00.x,gw00.x);
  vec4 g1000 = vec4(gx00.y,gy00.y,gz00.y,gw00.y);
  vec4 g0100 = vec4(gx00.z,gy00.z,gz00.z,gw00.z);
  vec4 g1100 = vec4(gx00.w,gy00.w,gz00.w,gw00.w);
  vec4 g0010 = vec4(gx10.x,gy10.x,gz10.x,gw10.x);
  vec4 g1010 = vec4(gx10.y,gy10.y,gz10.y,gw10.y);
  vec4 g0110 = vec4(gx10.z,gy10.z,gz10.z,gw10.z);
  vec4 g1110 = vec4(gx10.w,gy10.w,gz10.w,gw10.w);
  vec4 g0001 = vec4(gx01.x,gy01.x,gz01.x,gw01.x);
  vec4 g1001 = vec4(gx01.y,gy01.y,gz01.y,gw01.y);
  vec4 g0101 = vec4(gx01.z,gy01.z,gz01.z,gw01.z);
  vec4 g1101 = vec4(gx01.w,gy01.w,gz01.w,gw01.w);
  vec4 g0011 = vec4(gx11.x,gy11.x,gz11.x,gw11.x);
  vec4 g1011 = vec4(gx11.y,gy11.y,gz11.y,gw11.y);
  vec4 g0111 = vec4(gx11.z,gy11.z,gz11.z,gw11.z);
  vec4 g1111 = vec4(gx11.w,gy11.w,gz11.w,gw11.w);

  vec4 norm00 = taylorInvSqrt(vec4(dot(g0000, g0000), dot(g0100, g0100), dot(g1000, g1000), dot(g1100, g1100)));
  g0000 *= norm00.x;
  g0100 *= norm00.y;
  g1000 *= norm00.z;
  g1100 *= norm00.w;

  vec4 norm01 = taylorInvSqrt(vec4(dot(g0001, g0001), dot(g0101, g0101), dot(g1001, g1001), dot(g1101, g1101)));
  g0001 *= norm01.x;
  g0101 *= norm01.y;
  g1001 *= norm01.z;
  g1101 *= norm01.w;

  vec4 norm10 = taylorInvSqrt(vec4(dot(g0010, g0010), dot(g0110, g0110), dot(g1010, g1010), dot(g1110, g1110)));
  g0010 *= norm10.x;
  g0110 *= norm10.y;
  g1010 *= norm10.z;
  g1110 *= norm10.w;

  vec4 norm11 = taylorInvSqrt(vec4(dot(g0011, g0011), dot(g0111, g0111), dot(g1011, g1011), dot(g1111, g1111)));
  g0011 *= norm11.x;
  g0111 *= norm11.y;
  g1011 *= norm11.z;
  g1111 *= norm11.w;

  float n0000 = dot(g0000, Pf0);
  float n1000 = dot(g1000, vec4(Pf1.x, Pf0.yzw));
  float n0100 = dot(g0100, vec4(Pf0.x, Pf1.y, Pf0.zw));
  float n1100 = dot(g1100, vec4(Pf1.xy, Pf0.zw));
  float n0010 = dot(g0010, vec4(Pf0.xy, Pf1.z, Pf0.w));
  float n1010 = dot(g1010, vec4(Pf1.x, Pf0.y, Pf1.z, Pf0.w));
  float n0110 = dot(g0110, vec4(Pf0.x, Pf1.yz, Pf0.w));
  float n1110 = dot(g1110, vec4(Pf1.xyz, Pf0.w));
  float n0001 = dot(g0001, vec4(Pf0.xyz, Pf1.w));
  float n1001 = dot(g1001, vec4(Pf1.x, Pf0.yz, Pf1.w));
  float n0101 = dot(g0101, vec4(Pf0.x, Pf1.y, Pf0.z, Pf1.w));
  float n1101 = dot(g1101, vec4(Pf1.xy, Pf0.z, Pf1.w));
  float n0011 = dot(g0011, vec4(Pf0.xy, Pf1.zw));
  float n1011 = dot(g1011, vec4(Pf1.x, Pf0.y, Pf1.zw));
  float n0111 = dot(g0111, vec4(Pf0.x, Pf1.yzw));
  float n1111 = dot(g1111, Pf1);

  vec4 fade_xyzw = fade(Pf0);
  vec4 n_0w = mix(vec4(n0000, n1000, n0100, n1100), vec4(n0001, n1001, n0101, n1101), fade_xyzw.w);
  vec4 n_1w = mix(vec4(n0010, n1010, n0110, n1110), vec4(n0011, n1011, n0111, n1111), fade_xyzw.w);
  vec4 n_zw = mix(n_0w, n_1w, fade_xyzw.z);
  vec2 n_yzw = mix(n_zw.xy, n_zw.zw, fade_xyzw.y);
  float n_xyzw = mix(n_yzw.x, n_yzw.y, fade_xyzw.x);
  return 2.2 * n_xyzw;
}
`;
const simplex = /* glsl */ `
// 2D
float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// 3D
float snoise(vec3 v)
  {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

// 4D
float snoise(vec4 v)
  {
  const vec4  C = vec4( 0.138196601125011,  // (5 - sqrt(5))/20  G4
                        0.276393202250021,  // 2 * G4
                        0.414589803375032,  // 3 * G4
                       -0.447213595499958); // -1 + 4 * G4

// First corner
  vec4 i  = floor(v + dot(v, vec4(F4)) );
  vec4 x0 = v -   i + dot(i, C.xxxx);

// Other corners

// Rank sorting originally contributed by Bill Licea-Kane, AMD (formerly ATI)
  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
//  i0.x = dot( isX, vec3( 1.0 ) );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
//  i0.y += dot( isYZ.xy, vec2( 1.0 ) );
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;

  // i0 now contains the unique values 0,1,2,3 in each channel
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

  //  x0 = x0 - 0.0 + 0.0 * C.xxxx
  //  x1 = x0 - i1  + 1.0 * C.xxxx
  //  x2 = x0 - i2  + 2.0 * C.xxxx
  //  x3 = x0 - i3  + 3.0 * C.xxxx
  //  x4 = x0 - 1.0 + 4.0 * C.xxxx
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;

// Permutations
  i = mod289(i);
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));

// Gradients: 7x7x6 points over a cube, mapped onto a 4-cross polytope
// 7*7*6 = 294, which is close to the ring size 17*17 = 289.
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);

// Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));

// Mix contributions from the five corners
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;

}
`;

var noise_glsl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  common: common,
  perlin: perlin,
  simplex: simplex
});

// ITU-R BT.601
// Assumes linear color
var luma_glsl = /* glsl */ `
float luma(in vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}
`;

// ITU-R BT.709-2
var luminance_glsl = /* glsl */ `
float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}
`;

var average_glsl = /* glsl */ `
float average(vec3 color) {
  return (color.r + color.g + color.b) / 3.0;
}
`;

// Based on http://http.developer.nvidia.com/GPUGems/gpugems_ch17.html and http://gl.ict.usc.edu/Data/HighResProbes/
// flipEnvMap:
// - -1.0 for left handed coorinate system oriented texture (usual case)
// - 1.0 for right handed coorinate system oriented texture
//
// I assume envMap texture has been flipped the WebGL way (pixel 0,0 is a the bottom)
// therefore we flip wcNorma.y as acos(1) = 0
var envMapEquirect_glsl = /* glsl */ `
vec2 envMapEquirect(vec3 wcNormal) {
  float flipEnvMap = -1.0;
  float phi = acos(-wcNormal.y);
  float theta = atan(wcNormal.x, flipEnvMap * wcNormal.z) + PI;
  return vec2(theta / TWO_PI, phi / PI);
}
`;

var octMapUvToDir_glsl = /* glsl */ `
vec2 signed(vec2 v) {
  return step(0.0, v) * 2.0 - 1.0;
}

// size = target octMap size
vec3 octMapUVToDir (vec2 uv, float size) {
  // center pixels with texels
  // https://msdn.microsoft.com/en-us/library/windows/desktop/bb219690(v=vs.85).aspx
  // creates 2 pixel border on the seams so the texture will filter properly
  // uv = (uv * size - 0.5) / (size - 1.0); // THIS!!!

  // float uBorder = 5.0;
  // uv = uv * 2.0 - 1.0;
  // uv *= (size + uBorder) / size;
  // uv = (uv + 1.0) / 2.0;

  // if (uv.x < 0.0) { uv.x *= -1.0; uv.y = 1.0 - uv.y; }
  // else if (uv.x > 1.0) { uv.x = 2.0 - uv.x; uv.y = 1.0 - uv.y; }
  // if (uv.y < 0.0) { uv.y *= -1.0; uv.x = 1.0 - uv.x; }
  // else if (uv.y > 1.0) { uv.y = 2.0 - uv.y; uv.x = 1.0 - uv.x; }

  uv = uv * 2.0 - 1.0;

  vec2 auv = abs(uv);
  float len = dot(auv, vec2(1.0));

  if (len > 1.0) {
    //y < 0 case
    uv = (auv.yx - 1.0) * -1.0 * signed(uv);
  }
  return normalize(vec3(uv.x, 1.0 - len, uv.y));
}

// size = target octMap size
vec3 octMapUVToDir (vec2 uv) {
  // center pixels with texels
  // https://msdn.microsoft.com/en-us/library/windows/desktop/bb219690(v=vs.85).aspx
  // uv = (uv * size - 0.5) / (size - 1.0); // THIS!!!

  // uv = uv * 2.0 - 1.0;
  // uv *= (uTextureSize + uBorder) / uTextureSize;
  // uv = (uv + 1.0) / 2.0;

  // if (uv.x < 0.0) { uv.x *= -1.0; uv.y = 1.0 - uv.y; }
  // else if (uv.x > 1.0) { uv.x = 2.0 - uv.x; uv.y = 1.0 - uv.y; }
  // if (uv.y < 0.0) { uv.y *= -1.0; uv.x = 1.0 - uv.x; }
  // else if (uv.y > 1.0) { uv.y = 2.0 - uv.y; uv.x = 1.0 - uv.x; }

  uv = uv * 2.0 - 1.0;

  vec2 auv = abs(uv);
  float len = dot(auv, vec2(1.0));

  if (len > 1.0) {
    //y < 0 case
    uv = (auv.yx - 1.0) * -1.0 * signed(uv);
  }
  return normalize(vec3(uv.x, 1.0 - len, uv.y));
}
`;

// reconstructPositionFromDepth:
// asumming z comes from depth buffer (ndc coords) and it's not a linear distance from the camera but
// perpendicular to the near/far clipping planes
// http://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/
// assumes z = eye space z
var depthPosition_glsl = /* glsl */ `
vec3 getFarViewDir(vec2 texCoord) {
  float hfar = 2.0 * tan(uFov/2.0) * uFar;
  float wfar = hfar * uViewportSize.x / uViewportSize.y;
  vec3 dir = (vec3(wfar * (texCoord.x - 0.5), hfar * (texCoord.y - 0.5), -uFar));
  return dir;
}

vec3 getViewRay(vec2 texCoord) {
  return normalize(getFarViewDir(texCoord));
}

vec3 reconstructPositionFromDepth(vec2 texCoord, float z) {
  vec3 ray = getFarViewDir(texCoord);
  vec3 pos = ray;
  return pos * z / uFar;
}
`;

/**
 * Fog
 *
 * Adapted from from Iñigo Quilez article: https://iquilezles.org/articles/fog/
 * @alias module:chunks.fog
 * @type {string}
 */ var fog_glsl = /* glsl */ `
uniform float uFogDensity;

uniform vec3 uSunColor;
uniform float uSunDispertion;
uniform float uSunIntensity;
uniform vec3 uInscatteringCoeffs;
uniform vec3 uFogColor;

vec3 fog(vec3 rgb, float dist, vec3 rayDir, vec3 sunDir) {
  vec3 sunColor = toLinear(uSunColor).rgb;
  vec3 fogColor = toLinear(uFogColor).rgb;

  float minSc         = 0.02;
  float density       = -(dist+1.0) * uFogDensity * 0.15 - dist * 0.0025;
  float sunAmount     = pow(max(dot(rayDir, sunDir), 0.0), 1.0 / (0.008 + uSunDispertion*3.0));
  sunAmount           = uSunIntensity * 10.0 * pow(sunAmount,10.0);
  sunAmount           = max(0.0, min(sunAmount, 1.0));
  vec3 sunFogColor    = mix(fogColor, sunColor, sunAmount);
  vec3 insColor       = vec3(1.0) - saturate( vec3(
        exp(density*(uInscatteringCoeffs.x+minSc)),
        exp(density*(uInscatteringCoeffs.y+minSc)),
        exp(density*(uInscatteringCoeffs.z+minSc)))
      );

  return mix(rgb, sunFogColor, insColor);
}
`;

// TODO: precompute luma in color attachment
// TODO: don't apply where there is strong motion blur or depth of field.
/**
 * FXAA
 *
 * Paper:
 * - https://developer.download.nvidia.com/assets/gamedev/files/sdk/11/FXAA_WhitePaper.pdf
 *
 * Reference Implementations:
 * - https://blog.simonrodriguez.fr/articles/2016/07/implementing_fxaa.html
 * - https://gist.github.com/kosua20/0c506b81b3812ac900048059d2383126
 *
 * Updates: Damien Seguin (2023-10)
 * @alias module:chunks.fxaa
 * @type {string}
 */ var fxaa_glsl = /* glsl */ `
#ifndef AA_QUALITY
  #define AA_QUALITY 2
#endif
#if AA_QUALITY == 0
  // Low
  #define FXAA_EDGE_THRESHOLD_MIN 0.0833 // 1 / 12
  #define FXAA_EDGE_THRESHOLD_MAX 0.250 // 1 / 4
#elif AA_QUALITY == 1
  // Medium
  #define FXAA_EDGE_THRESHOLD_MIN 0.0625 // 1 / 16
  #define FXAA_EDGE_THRESHOLD_MAX 0.166 // 1 / 6
#elif AA_QUALITY == 2
  // High
  #define FXAA_EDGE_THRESHOLD_MIN 0.0312 // 1 / 32
  #define FXAA_EDGE_THRESHOLD_MAX 0.125 // 1 / 8
#elif AA_QUALITY == 3
  // Ultra
  #define FXAA_EDGE_THRESHOLD_MIN 0.0156 // 1 / 64
  #define FXAA_EDGE_THRESHOLD_MAX 0.063 // 1 / 16
#elif AA_QUALITY == 4
  // Extreme
  #define FXAA_EDGE_THRESHOLD_MIN 0.0078 // 1 / 128
  #define FXAA_EDGE_THRESHOLD_MAX 0.031 // 1 / 32
#endif

#define FXAA_QUALITY(q) ((q) < 5 ? 1.0 : ((q) > 5 ? ((q) < 10 ? 2.0 : ((q) < 11 ? 4.0 : 8.0)) : 1.5))
#define FXAA_ITERATIONS 12

#define FXAA_ONE_OVER_TWELVE 1.0 / 12.0

// Approximation for linear color
float fxaaRgbToLuma(vec3 rgb){
  return sqrt(luma(rgb));
}

// Read texture as LDR
vec3 fxaaTexture(sampler2D tex, vec2 uv) {
  return reinhard(texture2D(tex, uv).xyz);
}
float fxaaGetLuma(sampler2D tex, vec2 uv) {
  return fxaaRgbToLuma(fxaaTexture(tex, uv));
}

// Performs FXAA post-process anti-aliasing as described in the Nvidia FXAA white paper and the associated shader code.
vec4 fxaa(
  sampler2D screenTexture, // HDR
  vec2 uv,
  vec2 uvLeftUp,
  vec2 uvRightUp,
  vec2 uvLeftDown,
  vec2 uvRightDown,
  vec2 uvDown,
  vec2 uvUp,
  vec2 uvLeft,
  vec2 uvRight,
  vec2 texelSize,
  float subPixelQuality
) {
  vec4 colorCenter = texture2D(screenTexture, uv);

  // Luma at the current fragment
  float lumaCenter = fxaaRgbToLuma(reinhard(colorCenter.xyz));

  // Luma at the four direct neighbours of the current fragment.
  float lumaDown = fxaaGetLuma(screenTexture, uvDown);
  float lumaUp = fxaaGetLuma(screenTexture, uvUp);
  float lumaLeft = fxaaGetLuma(screenTexture, uvLeft);
  float lumaRight = fxaaGetLuma(screenTexture, uvRight);

  // Find the maximum and minimum luma around the current fragment.
  float lumaMin = min(lumaCenter, min(min(lumaDown, lumaUp), min(lumaLeft, lumaRight)));
  float lumaMax = max(lumaCenter, max(max(lumaDown, lumaUp), max(lumaLeft, lumaRight)));

  // Compute the delta.
  float lumaRange = lumaMax - lumaMin;

  // If the luma variation is lower that a threshold (or if we are in a really dark area), we are not on an edge, don't perform any AA.
  if (lumaRange < max(FXAA_EDGE_THRESHOLD_MIN, lumaMax * FXAA_EDGE_THRESHOLD_MAX)) {
    return colorCenter;
  }

  // Query the 4 remaining corners lumas.
  float lumaDownLeft = fxaaGetLuma(screenTexture, uvLeftDown);
  float lumaUpRight = fxaaGetLuma(screenTexture, uvRightUp);
  float lumaUpLeft = fxaaGetLuma(screenTexture, uvLeftUp);
  float lumaDownRight = fxaaGetLuma(screenTexture, uvRightDown);

  // Combine the four edges lumas (using intermediary variables for future computations with the same values).
  float lumaDownUp = lumaDown + lumaUp;
  float lumaLeftRight = lumaLeft + lumaRight;

  // Same for corners
  float lumaLeftCorners = lumaDownLeft + lumaUpLeft;
  float lumaDownCorners = lumaDownLeft + lumaDownRight;
  float lumaRightCorners = lumaDownRight + lumaUpRight;
  float lumaUpCorners = lumaUpRight + lumaUpLeft;

  // Compute an estimation of the gradient along the horizontal and vertical axis.
  float edgeHorizontal =
    abs(-2.0 * lumaLeft + lumaLeftCorners) +
    abs(-2.0 * lumaCenter + lumaDownUp) * 2.0 +
    abs(-2.0 * lumaRight + lumaRightCorners);
  float edgeVertical =
    abs(-2.0 * lumaUp + lumaUpCorners) +
    abs(-2.0 * lumaCenter + lumaLeftRight) * 2.0 +
    abs(-2.0 * lumaDown + lumaDownCorners);

  // Is the local edge horizontal or vertical ?
  bool isHorizontal = (edgeHorizontal >= edgeVertical);

  // Choose the step size (one pixel) accordingly.
  float stepLength = isHorizontal ? texelSize.y : texelSize.x;

  // Select the two neighboring texels lumas in the opposite direction to the local edge.
  float luma1 = isHorizontal ? lumaDown : lumaLeft;
  float luma2 = isHorizontal ? lumaUp : lumaRight;

  // Compute gradients in this direction.
  float gradient1 = abs(luma1 - lumaCenter);
  float gradient2 = abs(luma2 - lumaCenter);

  // Which direction is the steepest ?
  bool is1Steepest = gradient1 >= gradient2;

  // Gradient in the corresponding direction, normalized.
  float gradientScaled = 0.25 * max(gradient1, gradient2);

  // Average luma in the correct direction.
  float lumaLocalAverage = 0.0;
  if (is1Steepest) {
    // Switch the direction
    stepLength = - stepLength;
    lumaLocalAverage = 0.5 * (luma1 + lumaCenter);
  } else {
    lumaLocalAverage = 0.5 * (luma2 + lumaCenter);
  }

  // Shift UV in the correct direction by half a pixel.
  vec2 currentUv = uv;
  if (isHorizontal){
    currentUv.y += stepLength * 0.5;
  } else {
    currentUv.x += stepLength * 0.5;
  }

  // Compute offset (for each iteration step) in the right direction.
  vec2 offset = isHorizontal ? vec2(texelSize.x, 0.0) : vec2(0.0, texelSize.y);

  // Compute UVs to explore on each side of the edge, orthogonally. The QUALITY allows us to step faster.
  vec2 uv1 = currentUv - offset; // * QUALITY(0); // (quality 0 is 1.0)
  vec2 uv2 = currentUv + offset; // * QUALITY(0); // (quality 0 is 1.0)

  // Read the lumas at both current extremities of the exploration segment, and compute the delta wrt to the local average luma.
  float lumaEnd1 = fxaaGetLuma(screenTexture, uv1);
  float lumaEnd2 = fxaaGetLuma(screenTexture, uv2);
  lumaEnd1 -= lumaLocalAverage;
  lumaEnd2 -= lumaLocalAverage;

  // If the luma deltas at the current extremities is larger than the local gradient, we have reached the side of the edge.
  bool reached1 = abs(lumaEnd1) >= gradientScaled;
  bool reached2 = abs(lumaEnd2) >= gradientScaled;
  bool reachedBoth = reached1 && reached2;

  // If the side is not reached, we continue to explore in this direction.
  if (!reached1){
    uv1 -= offset; // * QUALITY(1); // (quality 1 is 1.0)
  }
  if (!reached2){
    uv2 += offset; // * QUALITY(1); // (quality 1 is 1.0)
  }

  // If both sides have not been reached, continue to explore.
  if (!reachedBoth)
  {
    for (int i = 2; i < FXAA_ITERATIONS; i++)
    {
      // If needed, read luma in 1st direction, compute delta.
      if (!reached1) {
        lumaEnd1 = fxaaGetLuma(screenTexture, uv1);
        lumaEnd1 = lumaEnd1 - lumaLocalAverage;
      }
      // If needed, read luma in opposite direction, compute delta.
      if (!reached2) {
        lumaEnd2 = fxaaGetLuma(screenTexture, uv2);
        lumaEnd2 = lumaEnd2 - lumaLocalAverage;
      }
      // If the luma deltas at the current extremities is larger than the local gradient, we have reached the side of the edge.
      reached1 = abs(lumaEnd1) >= gradientScaled;
      reached2 = abs(lumaEnd2) >= gradientScaled;
      reachedBoth = reached1 && reached2;

      // If the side is not reached, we continue to explore in this direction, with a variable quality.
      if (!reached1) {
        uv1 -= offset * FXAA_QUALITY(i);
      }
      if (!reached2) {
        uv2 += offset * FXAA_QUALITY(i);
      }

      // If both sides have been reached, stop the exploration.
      if (reachedBoth) {
        break;
      }
    }
  }

  // Compute the distances to each side edge of the edge (!).
  float distance1 = isHorizontal ? (uv.x - uv1.x) : (uv.y - uv1.y);
  float distance2 = isHorizontal ? (uv2.x - uv.x) : (uv2.y - uv.y);

  // In which direction is the side of the edge closer ?
  bool isDirection1 = distance1 < distance2;
  float distanceFinal = min(distance1, distance2);

  // Thickness of the edge.
  float edgeThickness = (distance1 + distance2);

  // Is the luma at center smaller than the local average ?
  bool isLumaCenterSmaller = lumaCenter < lumaLocalAverage;

  // If the luma at center is smaller than at its neighbour, the delta luma at each end should be positive (same variation).
  // (in the direction of the closer side of the edge.)
  bool correctVariation = ((isDirection1 ? lumaEnd1 : lumaEnd2) < 0.0) != isLumaCenterSmaller;

  // UV offset: read in the direction of the closest side of the edge.
  float pixelOffset = - distanceFinal / edgeThickness + 0.5;

  // If the luma variation is incorrect, do not offset.
  float finalOffset = correctVariation ? pixelOffset : 0.0;

  // Sub-pixel shifting
  // Full weighted average of the luma over the 3x3 neighborhood.
  float lumaAverage = FXAA_ONE_OVER_TWELVE * (2.0 * (lumaDownUp + lumaLeftRight) + lumaLeftCorners + lumaRightCorners);
  // Ratio of the delta between the global average and the center luma, over the luma range in the 3x3 neighborhood.
  float subPixelOffset1 = clamp(abs(lumaAverage - lumaCenter) / lumaRange, 0.0, 1.0);
  float subPixelOffset2 = smoothstep(0.0, 1.0, subPixelOffset1);
  // Compute a sub-pixel offset based on this delta.
  float subPixelOffsetFinal = subPixelOffset2 * subPixelOffset2 * subPixelQuality;

  // Pick the biggest of the two offsets.
  finalOffset = max(finalOffset, subPixelOffsetFinal);

  // Compute the final UV coordinates.
  vec2 finalUv = uv;
  if (isHorizontal){
    finalUv.y += finalOffset * stepLength;
  } else {
    finalUv.x += finalOffset * stepLength;
  }

  // Read the color at the new UV coordinates, and use it.
  return texture2D(screenTexture, finalUv);
}
`;

/**
 * Film Grain
 *
 * Reference Implementations:
 * - https://devlog-martinsh.blogspot.com/2013/05/image-imperfections-and-film-grain-post.html
 * - https://www.shadertoy.com/view/4sSXDW
 *
 * @alias module:chunks.filmGrain
 * @type {string}
 */ var filmGrain_glsl = /* glsl */ `
const vec3 FILM_GRAIN_TIME_OFFSET = vec3(0.07, 0.11, 0.13);
const vec2 FILM_GRAIN_CHANNEL_OFFSET = vec2(1.1, 1.2);

// Random
#if FILM_GRAIN_QUALITY == 0
  float filmGrainRandom(vec2 uv, float time) {
    return rand(uv * (1.0 + fract(time))) * 2.0 - 1.0;
  }
  vec3 filmGrainRandom(vec2 uv, float time, float size, float colorIntensity) {
    float n = filmGrainRandom(uv * size, time * FILM_GRAIN_TIME_OFFSET.x);

    return vec3(
      n,
      mix(n, filmGrainRandom(uv * FILM_GRAIN_CHANNEL_OFFSET.x * size, time * FILM_GRAIN_TIME_OFFSET.y), colorIntensity),
      mix(n, filmGrainRandom(uv * FILM_GRAIN_CHANNEL_OFFSET.y * size, time * FILM_GRAIN_TIME_OFFSET.z), colorIntensity)
    );
  }
// Large Film Grain Lottes
#elif FILM_GRAIN_QUALITY == 1
  float filmGrainLargeStep1(vec2 uv, float n) {
    float b = 2.0;
    float c = -12.0;

    return (1.0 / (4.0 + b * 4.0 + abs(c))) * (
      rand((uv + vec2(-1.0,-1.0)) + n) +
      rand((uv + vec2( 0.0,-1.0)) + n) * b +
      rand((uv + vec2( 1.0,-1.0)) + n) +
      rand((uv + vec2(-1.0, 0.0)) + n) * b +
      rand((uv + vec2( 0.0, 0.0)) + n) * c +
      rand((uv + vec2( 1.0, 0.0)) + n) * b +
      rand((uv + vec2(-1.0, 1.0)) + n) +
      rand((uv + vec2( 0.0, 1.0)) + n) * b +
      rand((uv + vec2( 1.0, 1.0)) + n)
    );
  }
  float filmGrainLargeStep2(vec2 uv, float n) {
    float b = 2.0;
    float c = 4.0;

    return (1.0 / (4.0 + b * 4.0 + c)) * (
      filmGrainLargeStep1(uv + vec2(-1.0, -1.0), n) +
      filmGrainLargeStep1(uv + vec2( 0.0, -1.0), n) * b +
      filmGrainLargeStep1(uv + vec2( 1.0, -1.0), n) +
      filmGrainLargeStep1(uv + vec2(-1.0,  0.0), n) * b +
      filmGrainLargeStep1(uv + vec2( 0.0,  0.0), n) * c +
      filmGrainLargeStep1(uv + vec2( 1.0,  0.0), n) * b +
      filmGrainLargeStep1(uv + vec2(-1.0,  1.0), n) +
      filmGrainLargeStep1(uv + vec2( 0.0,  1.0), n) * b +
      filmGrainLargeStep1(uv + vec2( 1.0,  1.0), n)
    );
  }
  vec3 filmGrainLarge(vec2 uv, float time, float size, float colorIntensity) {
    float scale = 18.0; // Match filmGrainRandom
    float n = filmGrainLargeStep2(uv * size, FILM_GRAIN_TIME_OFFSET.x * time);

    return scale * vec3(
      n,
      mix(n, filmGrainLargeStep2(uv * FILM_GRAIN_CHANNEL_OFFSET.x * size, FILM_GRAIN_TIME_OFFSET.y * time), colorIntensity),
      mix(n, filmGrainLargeStep2(uv * FILM_GRAIN_CHANNEL_OFFSET.y * size, FILM_GRAIN_TIME_OFFSET.z * time), colorIntensity)
    );
  }

// Upitis with periodic simplex noise
#elif FILM_GRAIN_QUALITY == 2
  const vec3 FILM_GRAIN_ROTATION_OFFSET = vec3(1.425, 3.892, 5.835);

  vec2 filmGrainRotate(vec2 uv, float angle, float aspect) {
    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    vec2 p = uv * 2.0 - 1.0;
    return vec2(
      (cosAngle * aspect * p.x - sinAngle * p.y) / aspect,
      cosAngle * p.y + sinAngle * aspect * p.x
    ) * 0.5 + 0.5;
  }

  float filmGrainUpitis(vec2 uv, float angle, vec2 offset, float aspect, float z, vec3 rep) {
    return pnoise(vec3(offset * filmGrainRotate(uv, angle, aspect), z), rep);
  }
  vec3 filmGrainUpitis(vec2 uv, float time, float size, float colorIntensity, vec2 viewportSize) {
    vec2 offset = viewportSize / vec2(size);
    float aspect = viewportSize.x / viewportSize.y;

    vec3 rep = vec3(uv + vec2(time), 1.0);
    float n = filmGrainUpitis(uv, time + FILM_GRAIN_ROTATION_OFFSET.x, offset, aspect, 0.0, rep);

    return vec3(
      n,
      mix(n, filmGrainUpitis(uv, time + FILM_GRAIN_ROTATION_OFFSET.y, offset, aspect, 1.0, rep), colorIntensity),
      mix(n, filmGrainUpitis(uv, time + FILM_GRAIN_ROTATION_OFFSET.z, offset, aspect, 2.0, rep), colorIntensity)
    );
  }
#endif

vec3 filmGrain(
  vec3 color,
  vec2 uv,
  vec2 viewportSize,
  float size,
  float intensity,
  float colorIntensity,
  float luminanceIntensity,
  float time
) {
  #if FILM_GRAIN_QUALITY == 0
    vec3 noise = filmGrainRandom(uv, time, size, colorIntensity);
  #elif FILM_GRAIN_QUALITY == 1
    vec3 noise = filmGrainLarge(uv, time, size, colorIntensity);
  #elif FILM_GRAIN_QUALITY == 2
    vec3 noise = filmGrainUpitis(uv, time, size, colorIntensity, viewportSize);
  #endif

  float luminance = mix(0.0, luma(color), luminanceIntensity);
  return saturate(color + mix(noise, vec3(0.0), pow(luminance + smoothstep(0.2, 0.0, luminance), 4.0)) * intensity);
}
`;

var lut_glsl = /* glsl */ `
vec4 lut(vec4 textureColor, sampler2D lookupTable, float lutSize) {
  float blueColor = textureColor.b * 63.0;

  vec2 quad1;
  quad1.y = floor(floor(blueColor) / 8.0);
  quad1.x = floor(blueColor) - (quad1.y * 8.0);

  vec2 quad2;
  quad2.y = floor(ceil(blueColor) / 8.0);
  quad2.x = ceil(blueColor) - (quad2.y * 8.0);

  float invSize = 1.0 / lutSize;
  float invHalfSize = 0.5 / lutSize;

  return mix(
    texture2D(
      lookupTable,
      vec2(
        (quad1.x * 0.125) + invHalfSize + ((0.125 - invSize) * textureColor.r),
        (quad1.y * 0.125) + invHalfSize + ((0.125 - invSize) * textureColor.g)
      )
    ),
    texture2D(
      lookupTable,
      vec2(
        (quad2.x * 0.125) + invHalfSize + ((0.125 - invSize) * textureColor.r),
        (quad2.y * 0.125) + invHalfSize + ((0.125 - invSize) * textureColor.g)
      )
    ),
    fract(blueColor)
  );
}
`;

/**
 * Color Correction
 *
 * https://github.com/CesiumGS/cesium/blob/master/Source/Shaders/Builtin/Functions
 * @alias module:chunks.colorCorrection
 * @type {string}
 */ var colorCorrection_glsl = /* glsl */ `
float brightnessContrast(float value, float brightness, float contrast) {
  return (value - 0.5) * contrast + 0.5 + brightness;
}

vec3 brightnessContrast(vec3 value, float brightness, float contrast) {
  return (value - 0.5) * contrast + 0.5 + brightness;
}

vec3 saturation(vec3 rgb, float adjustment) {
  const vec3 W = vec3(0.2125, 0.7154, 0.0721);
  vec3 intensity = vec3(dot(rgb, W));
  return mix(intensity, rgb, adjustment);
}

vec3 hue(vec3 rgb, float adjustment) {
  const mat3 toYIQ = mat3(0.299,     0.587,     0.114,
                          0.595716, -0.274453, -0.321263,
                          0.211456, -0.522591,  0.311135);
  const mat3 toRGB = mat3(1.0,  0.9563,  0.6210,
                          1.0, -0.2721, -0.6474,
                          1.0, -1.107,   1.7046);

  vec3 yiq = toYIQ * rgb;
  float hue = atan(yiq.z, yiq.y) + adjustment;
  float chroma = sqrt(yiq.z * yiq.z + yiq.y * yiq.y);

  vec3 color = vec3(yiq.x, chroma * cos(hue), chroma * sin(hue));
  return toRGB * color;
}
`;

// Alternatives:
// https://github.com/dataarts/3-dreams-of-black/blob/master/deploy/asset_viewer/js/rendering.js#L179
// vec2 coord = (uv - center) * vec2(radius);
// color.rgb = mix(color.rgb, vec3(1.0 - intensity), dot(coord, coord));
//
// color.rgb *= smoothstep(radius + (uFStop / intensity), radius + (uFStop / intensity), distance(uv, center));
var vignette_glsl = /* glsl */ `
vec3 vignette(in vec3 color, vec2 uv, float radius, float intensity) {
  const vec2 center = vec2(0.5);
  color.rgb *= smoothstep(-intensity, intensity, radius - distance(uv, center));
  return color;
}
`;

var index$3 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  alpha: alpha_glsl,
  ambientOcclusion: ambientOcclusion_glsl,
  average: average_glsl,
  baseColor: baseColor_glsl,
  brdf: brdf_glsl,
  clearCoat: clearCoat_glsl,
  colorCorrection: colorCorrection_glsl,
  depthPack: depthPack_glsl,
  depthPosition: depthPosition_glsl,
  depthRead: depthRead_glsl,
  depthUnpack: depthUnpack_glsl,
  direct: direct_glsl,
  emissiveColor: emissiveColor_glsl,
  encodeDecode: encodeDecode_glsl,
  envMapEquirect: envMapEquirect_glsl,
  filmGrain: filmGrain_glsl,
  fog: fog_glsl,
  fxaa: fxaa_glsl,
  indirect: indirect_glsl,
  irradiance: irradiance_glsl,
  lightAmbient: lightAmbient_glsl,
  lightArea: lightArea_glsl,
  lightDirectional: lightDirectional_glsl,
  lightPoint: lightPoint_glsl,
  lightSpot: lightSpot_glsl,
  luma: luma_glsl,
  luminance: luminance_glsl,
  lut: lut_glsl,
  math: math_glsl,
  metallicRoughness: metallicRoughness_glsl,
  noise: noise_glsl,
  normal: normal_glsl,
  normalPerturb: normalPerturb_glsl,
  octMap: octMap_glsl,
  octMapUvToDir: octMapUvToDir_glsl,
  output: output_glsl,
  pcf: pcf_glsl,
  pcss: pcss_glsl,
  shadowing: shadowing_glsl,
  sheenColor: sheenColor_glsl,
  specular: specular_glsl,
  specularGlossiness: specularGlossiness_glsl,
  textureCoordinates: textureCoordinates_glsl,
  transmission: transmission_glsl,
  vignette: vignette_glsl
});

/**
 * @alias module:postProcessing.bilateralBlur.frag
 * @type {string}
 */ var bilateralBlurFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform vec2 uViewportSize;

uniform float uNear;
uniform float uFar;

uniform vec2 uDirection;
uniform float uSharpness;

${depthRead_glsl}

// Blur weight based on https://github.com/nvpro-samples/gl_ssao/blob/master/hbao_blur.frag.glsl
// const int numSamples = 9;
// const float blurRadius = float(numSamples) / 2.0;
// const float blurSigma = blurRadius * 0.5;
// const float blurFalloff = 1.0 / (2.0*blurSigma*blurSigma);
const float blurFalloff = 0.09876543210;

vec4 bilateralBlur(sampler2D image, vec2 imageResolution, sampler2D depthTexture, vec2 uv, vec2 direction) {
  vec4 color = vec4(0.0);

  float centerDepth = readDepth(depthTexture, uv, uNear, uFar);

  float weightSum = 0.0;

  for (float i = -8.0; i <= 8.0; i += 2.0) {
    float r = i;
    vec2 off = direction * r;
    float sampleDepth = readDepth(depthTexture, uv + (off / imageResolution), uNear, uFar);
    float diff = (sampleDepth - centerDepth) * uSharpness;
    float weight = exp2(-r * r * blurFalloff - diff * diff);
    weightSum += weight;
    color += texture2D(image, uv + (off / imageResolution)) * weight;
  }

  color /= weightSum;

  return color;
}

void main() {
  vec2 vUV = gl_FragCoord.xy / uViewportSize;
  gl_FragColor = bilateralBlur(uTexture, uViewportSize, uDepthTexture, vUV, uDirection);

  ${assignment}
}
`;

/**
 * DoF (Depth of Field)
 *
 * Based on:
 * - "Bokeh depth of field in a single pass", Dennis Gustafsson: https://blog.voxagon.se/2018/05/04/bokeh-depth-of-field-in-single-pass.html
 * - "GLSL depth of field with bokeh v2.4", Martins Upitis: https://devlog-martinsh.blogspot.com/2011/12/glsl-depth-of-field-with-bokeh-v24.html
 * @alias module:postProcessing.dof.frag
 * @type {string}
 */ var dofFrag = /* glsl */ `
precision highp float;

// Required defines:
// USE_DOF_GUSTAFSSON or USE_DOF_UPITIS
// NUM_SAMPLES 6

// Optional defines:
// USE_PHYSICAL
// USE_FOCUS_ON_SCREEN_POINT
// USE_DEBUG
// USE_SHAPE_PENTAGON

${frag}

uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;

uniform float uNear;
uniform float uFar;
uniform float uFocusScale; // Non physically based value

#ifdef USE_PHYSICAL
  uniform float uFStop;
  uniform float uFocalLength;
#endif

uniform float uChromaticAberration;
uniform float uLuminanceThreshold;
uniform float uLuminanceGain;

#ifdef USE_FOCUS_ON_SCREEN_POINT
  uniform vec2 uScreenPoint;
#else
  uniform float uFocusDistance;
#endif

varying vec2 vTexCoord0;

// Use a default circle of confusion for simplicity sake instead of sensor dimensions
// 35mm film has a 24x36mm frame size which result in (43mm diagonal / 1500 enlargement of sensor size) = 0.029mm CoC
const float CoC = 0.029;

// Includes
${luma_glsl}
${depthRead_glsl}
${saturate}
#ifdef USE_DOF_UPITIS
  ${TWO_PI}
  ${random}
#endif

// Apply chromatic aberration
vec3 processSample(vec2 coords, float blur, vec2 texelSize) {
  vec2 scale = texelSize * uChromaticAberration * blur;

  vec3 color = vec3(
    texture2D(uTexture, coords + vec2(0.0, 1.0) * scale).r,
    texture2D(uTexture, coords + vec2(-0.866, -0.5) * scale).g,
    texture2D(uTexture, coords + vec2(0.866, -0.5) * scale).b
  );

  float threshold = max((luma(color) - uLuminanceThreshold) * uLuminanceGain, 0.0);

  return color + mix(vec3(0.0), color, threshold * blur);
}

float getCoC(float depth, float focusDistance, float focusScale) {
  #ifdef USE_PHYSICAL
    float plane = (depth * uFocalLength) / (depth - uFocalLength);
    float far = (focusDistance * uFocalLength) / (focusDistance - uFocalLength);
    float near = (focusDistance - uFocalLength) / (focusDistance * uFStop * focusScale * CoC); // focusScale !== 1.0 makes it non-physical
    return saturate(abs(plane - far) * near);
  #else
    float coc = clamp((1.0 / focusDistance - 1.0 / depth) * focusScale, -1.0, 1.0); // (1 / mm - 1 / mm) * mm = mm
    return abs(coc);
  #endif
}

#ifdef USE_DEBUG
  vec3 dofDebug(vec2 texCoord, float focusDistance, float blur, float focusScale) {
    if (texCoord.x > 0.90) {
      float cameraDepth = (uFar - uNear) * 1000.0; // m -> mm
      float depth = texCoord.y * cameraDepth; // uv * mm = mm

      // CoC
      if (texCoord.x <= 0.95) {
        float t = (texCoord.x - 0.9) * 20.0;
        float coc = getCoC(depth, focusDistance, focusScale);
        if (coc > t) return vec3(1.0);
        return vec3(0.0);
      }

      // Focus distance
      if (texCoord.x > 0.97) {
        // Relative to camera depth (using 2.5% of camera depth)
        if (abs(depth - focusDistance) < cameraDepth * 0.0025) return vec3(1.0, 1.0, 0.0);
        return vec3(floor(texCoord.y * 10.0)) / 10.0;
      }

      // Focal length and f-stop
      #ifdef USE_PHYSICAL
        float H = uFocalLength * uFocalLength / (uFStop * CoC); //mm
      #else
        float H = focusScale;
      #endif
      float near = H * focusDistance / (H + focusDistance);
      float far = H * focusDistance / (H - focusDistance);

      if (abs(depth - H) < cameraDepth * 0.0025) return vec3(1.0, 1.0, 0.0); // ?
      if (depth < near) return vec3(1.0, 0.0, 0.0); // Foreground
      if (depth > far) return vec3(0.0, 0.0, 1.0); // Background

      return vec3(0.0, 1.0, 0.0);
    }
    // Blur amount in scene
    return vec3(floor(abs(blur) / 0.1 * 100.0) / 100.0, 0.0, 0.0);
  }
#endif

// Gustafsson
#ifdef USE_DOF_GUSTAFSSON
  const float GOLDEN_ANGLE = 2.39996323;  // rad
  const float MAX_BLUR_SIZE = 30.0;
  const float RAD_SCALE = 0.5; // Smaller = nicer blur, larger = faster

  vec3 depthOfFieldGustafsson(vec2 texCoord, float focusDistance, float centerSize, float focusScale, float centerDepth) {
    #ifdef USE_DEBUG
      if (texCoord.x > 0.5) return dofDebug(vTexCoord0, focusDistance, centerSize, focusScale);
    #endif

    // Get blur size
    centerSize *= MAX_BLUR_SIZE;

    vec3 color = texture2D(uTexture, texCoord).rgb;
    float tot = 1.0;
    float radius = RAD_SCALE;

    // Heuristic to make DoF resolution independent
    float resolutionScale = pow(uViewportSize.y / 1080.0, 2.0);
    float maxRadius = MAX_BLUR_SIZE * resolutionScale;

    for (float ang = 0.0; ang < maxRadius * float(NUM_SAMPLES); ang += GOLDEN_ANGLE) {
      vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * uTexelSize * radius;

      float sampleDepth = readDepth(uDepthTexture, tc, uNear, uFar) * 1000.0; // m -> mm;
      float sampleSize = getCoC(sampleDepth, focusDistance, focusScale) * MAX_BLUR_SIZE; // mm

      if (sampleDepth > centerDepth) {
        // Controls how much of the background gets blended into a blurry foreground
        // Unphysical, to approximate the occluded information behind the foreground object
        sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
      }

      float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);

      color += mix(color / tot, processSample(tc, m, uTexelSize), m);
      tot += 1.0;

      radius += RAD_SCALE / radius * resolutionScale;

      if (radius > maxRadius) break;
    }
    return color /= tot;
  }
#endif

// Upitis
#ifdef USE_DOF_UPITIS
  const int RINGS = 4; //ring count
  const int MAX_RING_SAMPLES = RINGS * NUM_SAMPLES;

  float maxBlur = 1.0;
  float bias = 0.5; // bokeh edge bias
  float namount = 0.0001; //dither amount

  #ifdef USE_SHAPE_PENTAGON
    float feather = 0.4; // pentagon shape feather

    float pentagon(vec2 coords, float rings) {
      float scale = rings - 1.3;
      vec4 HS0 = vec4( 1.0,         0.0,         0.0,  1.0);
      vec4 HS1 = vec4( 0.309016994, 0.951056516, 0.0,  1.0);
      vec4 HS2 = vec4(-0.809016994, 0.587785252, 0.0,  1.0);
      vec4 HS3 = vec4(-0.809016994,-0.587785252, 0.0,  1.0);
      vec4 HS4 = vec4( 0.309016994,-0.951056516, 0.0,  1.0);
      vec4 HS5 = vec4( 0.0        ,0.0         , 1.0,  1.0);

      vec4 one = vec4(1.0);

      vec4 P = vec4((coords),vec2(scale, scale));

      vec4 dist = vec4(0.0);
      float inorout = -4.0;

      dist.x = dot(P, HS0);
      dist.y = dot(P, HS1);
      dist.z = dot(P, HS2);
      dist.w = dot(P, HS3);

      dist = smoothstep(-feather, feather, dist);

      inorout += dot( dist, one );

      dist.x = dot(P, HS4);
      dist.y = HS5.w - abs(P.z);

      dist = smoothstep(-feather, feather, dist);
      inorout += dist.x;

      return saturate(inorout);
    }
  #endif

  vec3 depthOfFieldUpitis(vec2 texCoord, float focusDistance, float blur, float focusScale) {
    #ifdef USE_DEBUG
      if (texCoord.x > 0.5) return dofDebug(vTexCoord0, focusDistance, blur, focusScale);
    #endif

    vec3 color = texture2D(uTexture, texCoord).rgb;

    if (blur >= 0.05) {
      vec2 noise =
        (vec2(rand(texCoord.xy), rand(texCoord.xy * 2.0)) * vec2(2.0) - vec2(1.0)) *
        namount *
        blur;
      vec2 blurFactor = uTexelSize * blur * maxBlur + noise;

      float s = 1.0;
      int ringSamples;
      float ringFloat = float(RINGS);

      for (int i = 1; i <= RINGS; i++) {
        ringSamples = i * NUM_SAMPLES;
        float iFloat = float(i);

        for (int j = 0; j < MAX_RING_SAMPLES; j++) {
          if (j >= ringSamples) break;
          float jFloat = float(j);
          float step = TWO_PI / float(ringSamples);
          vec2 pwh = vec2(
            cos(jFloat * step) * iFloat,
            sin(jFloat * step) * iFloat
          );

          #ifdef USE_SHAPE_PENTAGON
            float p = pentagon(pwh, ringFloat);
          #else
            float p = 1.0;
          #endif

          float m = mix(1.0, iFloat / ringFloat, bias) * p;
          color += processSample(texCoord + pwh * blurFactor, blur, uTexelSize) * m;
          s += m;
        }
      }

      color /= s;
    }

    return color;
  }
#endif

void main () {
  #ifdef USE_FOCUS_ON_SCREEN_POINT
    float focusDistance = readDepth(uDepthTexture, uScreenPoint, uNear, uFar) * 1000.0; // m -> mm
  #else
    float focusDistance = uFocusDistance * 1000.0; // m -> mm
  #endif

  float centerDepth = readDepth(uDepthTexture, vTexCoord0, uNear, uFar) * 1000.0;

  #ifdef USE_PHYSICAL
    // Act as an fStop divider
    float focusScale = 1.0 / uFocusScale;
  #else
    // Heuristic for focus scale to be relative to height / 1024
    // TODO: should it aim to be close to camera physical default instead?
    float focusScale = (uFocusScale * uViewportSize.y) / 1024.0 * 1000.0; // mm
  #endif

  float centerSize = getCoC(centerDepth, focusDistance, focusScale); // mm

  #ifdef USE_DOF_GUSTAFSSON
    vec3 color = depthOfFieldGustafsson(vTexCoord0, focusDistance, centerSize, focusScale, centerDepth);
  #endif
  #ifdef USE_DOF_UPITIS
    vec3 color = depthOfFieldUpitis(vTexCoord0, focusDistance, centerSize, focusScale);
  #endif

  gl_FragColor = vec4(color, 1.0);

  ${assignment}
}
`;

/**
 * Downsample
 *
 * Reference Implementation: https://github.com/keijiro/KinoBloom
 * @alias module:postProcessing.downsample.frag
 * @type {string}
 */ var downsampleFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uTexture;

uniform float uIntensity;

varying vec2 vTexCoord0;

varying vec2 vTexCoord0LeftUp;
varying vec2 vTexCoord0RightUp;
varying vec2 vTexCoord0LeftDown;
varying vec2 vTexCoord0RightDown;

float Brightness(vec3 c) {
  return max(max(c.r, c.g), c.b);
}

void main () {
  // Downsample with a 4x4 box filter
  #if QUALITY == 0
    gl_FragColor = (
      texture2D(uTexture, vTexCoord0LeftDown) +
      texture2D(uTexture, vTexCoord0RightDown) +
      texture2D(uTexture, vTexCoord0) +
      texture2D(uTexture, vTexCoord0LeftUp) +
      texture2D(uTexture, vTexCoord0RightUp)
    ) / 5.0 * uIntensity;

  // Downsample with a 4x4 box filter + anti-flicker filter
  #else
    vec4 s1 = texture2D(uTexture, vTexCoord0LeftDown);
    vec4 s2 = texture2D(uTexture, vTexCoord0RightDown);
    vec4 s3 = texture2D(uTexture, vTexCoord0LeftUp);
    vec4 s4 = texture2D(uTexture, vTexCoord0RightUp);

    // Karis's luma weighted average (using brightness instead of luma)
    float s1w = 1.0 / (Brightness(s1.xyz) + 1.0);
    float s2w = 1.0 / (Brightness(s2.xyz) + 1.0);
    float s3w = 1.0 / (Brightness(s3.xyz) + 1.0);
    float s4w = 1.0 / (Brightness(s4.xyz) + 1.0);
    float one_div_wsum = 1.0 / (s1w + s2w + s3w + s4w);

    gl_FragColor = (
      (s1 * s1w + s2 * s2w + s3 * s3w + s4 * s4w) * one_div_wsum
    ) * uIntensity;
  #endif

  ${assignment}
}
`;

/**
 * @alias module:postProcessing.postProcessing.frag
 * @type {string}
 */ var postProcessingFrag = /* glsl */ `precision highp float;

${frag}

// Variables
uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform vec4 uViewport;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;
uniform float uTime;

// uniform int uTextureEncoding;

// Camera
uniform mat4 uViewMatrix;
// TODO: group in vec4
uniform float uNear;
uniform float uFar;
uniform float uFov;
uniform float uExposure;
uniform int uOutputEncoding;

// Includes
${PI}
${saturate}
${encodeDecode_glsl}
${depthRead_glsl}
${Object.values(glslToneMap).join("\n")}

#if defined(USE_AA) || defined(USE_FILM_GRAIN)
  ${luma_glsl}
#endif

#ifdef USE_FOG
  uniform float uFogStart;
  uniform vec3 uSunPosition;

  ${depthPosition_glsl}
  ${fog_glsl}
#endif

#ifdef USE_AA
  // FXAA blends anything that has high enough contrast. It helps mitigate fireflies but will blur small details.
  // - 1.00: upper limit (softer)
  // - 0.75: default amount of filtering
  // - 0.50: lower limit (sharper, less sub-pixel aliasing removal)
  // - 0.25: almost off
  // - 0.00: completely off
  uniform float uSubPixelQuality;
  ${fxaa_glsl}
#endif

#ifdef USE_SSAO
  uniform sampler2D uSSAOTexture;
  uniform float uSSAOMix;

  ${ambientOcclusion_glsl}
#endif

#ifdef USE_BLOOM
  uniform sampler2D uBloomTexture;
  uniform float uBloomIntensity;
#endif

#ifdef USE_FILM_GRAIN
  uniform float uFilmGrainSize;
  uniform float uFilmGrainIntensity;
  uniform float uFilmGrainColorIntensity;
  uniform float uFilmGrainLuminanceIntensity;
  uniform float uFilmGrainSpeed;

  ${common}
  ${simplex}
  ${perlin}
  ${random}
  ${filmGrain_glsl}
#endif

#ifdef USE_LUT
  uniform sampler2D uLUTTexture;
  uniform float uLUTTextureSize;

  ${lut_glsl}
#endif

#ifdef USE_COLOR_CORRECTION
  // TODO: group in vec4
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uHue;

  ${colorCorrection_glsl}
#endif

#ifdef USE_VIGNETTE
  uniform float uVignetteRadius;
  uniform float uVignetteIntensity;

  ${vignette_glsl}
#endif

uniform float uOpacity;

varying vec2 vTexCoord0;

#if defined(USE_AA)
  varying vec2 vTexCoord0LeftUp;
  varying vec2 vTexCoord0RightUp;
  varying vec2 vTexCoord0LeftDown;
  varying vec2 vTexCoord0RightDown;
  varying vec2 vTexCoord0Down;
  varying vec2 vTexCoord0Up;
  varying vec2 vTexCoord0Left;
  varying vec2 vTexCoord0Right;
#endif

void main() {
  vec4 color = vec4(0.0);

  vec2 uv = vTexCoord0;

  // Anti-aliasing
  #ifdef USE_AA
    color = fxaa(
      uTexture,
      uv,
      vTexCoord0LeftUp,
      vTexCoord0RightUp,
      vTexCoord0LeftDown,
      vTexCoord0RightDown,
      vTexCoord0Down,
      vTexCoord0Up,
      vTexCoord0Left,
      vTexCoord0Right,
      uTexelSize,
      uSubPixelQuality
    );
  #else
    color = texture2D(uTexture, uv);
  #endif

  // color = decode(color, uTextureEncoding);

  // HDR effects
  #ifdef USE_FOG
    float z = readDepth(uDepthTexture, uv, uNear, uFar);
    vec3 pos = reconstructPositionFromDepth(uv, z);
    float rayLength = length(pos);
    vec3 rayDir = pos / rayLength;
    vec3 sunDir = normalize(vec3(uViewMatrix * vec4(normalize(uSunPosition), 0.0)));
    color.rgb = fog(color.rgb, rayLength - uFogStart, rayDir, sunDir);
  #endif

  #ifdef USE_SSAO
    color = ssao(color, texture2D(uSSAOTexture, uv), uSSAOMix);
  #endif

  #ifdef USE_BLOOM
    color.rgb += texture2D(uBloomTexture, uv).rgb * uBloomIntensity;
  #endif

  // Tonemapping and gamma conversion
  color.rgb *= uExposure;

  #if defined(TONE_MAP)
    color.rgb = TONE_MAP(color.rgb);
    color.rgb = saturate(color.rgb);
  #endif

  color = encode(color, uOutputEncoding);

  // LDR effects
  #ifdef USE_FILM_GRAIN
    color.rgb = filmGrain(
      color.rgb,
      uv,
      uViewportSize,
      uFilmGrainSize,
      uFilmGrainIntensity,
      uFilmGrainColorIntensity,
      uFilmGrainLuminanceIntensity,
      floor(uTime * uFilmGrainSpeed * 60.0)
    );
  #endif

  #ifdef USE_LUT
    color.rgb = lut(vec4(color.rgb, 1.0), uLUTTexture, uLUTTextureSize).rgb;
  #endif

  #ifdef USE_COLOR_CORRECTION
    color.rgb = brightnessContrast(color.rgb, uBrightness, uContrast);
    color.rgb = saturation(color.rgb, uSaturation);
    color.rgb = hue(color.rgb, uHue / 180.0 * PI);
  #endif

  #ifdef USE_VIGNETTE
    color.rgb = vignette(color.rgb, uv, uVignetteRadius, uVignetteIntensity);
  #endif

  gl_FragColor = color;
  gl_FragColor.a *= uOpacity;

  ${assignment}
}
`;

/**
 * @alias module:postProcessing.postProcessing.vert
 * @type {string}
 */ var postProcessingVert = /* glsl */ `
${vert}

attribute vec2 aPosition;

uniform vec2 uViewportSize;

varying vec2 vTexCoord0;

#if defined(USE_AA) || defined(USE_UPSAMPLE) || defined(USE_DOWN_SAMPLE)
  uniform vec2 uTexelSize;

  varying vec2 vTexCoord0LeftUp;
  varying vec2 vTexCoord0RightUp;
  varying vec2 vTexCoord0LeftDown;
  varying vec2 vTexCoord0RightDown;

  #if defined(USE_AA) || defined(USE_UPSAMPLE)
    varying vec2 vTexCoord0Down;
    varying vec2 vTexCoord0Up;
    varying vec2 vTexCoord0Left;
    varying vec2 vTexCoord0Right;
  #endif
#endif

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vTexCoord0 = aPosition * 0.5 + 0.5;

  #if defined(USE_AA) || defined(USE_UPSAMPLE) || defined(USE_DOWN_SAMPLE)
    #if defined(USE_UPSAMPLE) && defined(QUALITY) && QUALITY == 0
      float offset = 0.5;
    #else
      float offset = 1.0;
    #endif

    vTexCoord0LeftUp = vTexCoord0 + uTexelSize * offset * vec2(-1.0, 1.0);
    vTexCoord0RightUp = vTexCoord0 + uTexelSize * offset * vec2(1.0, 1.0);
    vTexCoord0LeftDown = vTexCoord0 + uTexelSize * offset * vec2(-1.0, -1.0);
    vTexCoord0RightDown = vTexCoord0 + uTexelSize * offset * vec2(1.0, -1.0);

    #if defined(USE_AA) || defined(USE_UPSAMPLE)
      vTexCoord0Down = vTexCoord0 + uTexelSize * vec2(0.0, -1.0);
      vTexCoord0Up = vTexCoord0 + uTexelSize * vec2(0.0, 1.0);
      vTexCoord0Left = vTexCoord0 + uTexelSize * vec2(-1.0, 0.0);
      vTexCoord0Right = vTexCoord0 + uTexelSize * vec2(1.0, 0.0);
    #endif
  #endif
}
`;

/**
 * SAO (Scalable Ambient Obscurance)
 *
 * Paper: https://research.nvidia.com/sites/default/files/pubs/2012-06_Scalable-Ambient-Obscurance/McGuire12SAO.pdf
 * (https://casual-effects.com/research/McGuire2012SAO/index.html)
 *
 * Reference Implementation: https://gist.github.com/transitive-bullshit/6770311
 *
 * Updates: Marcin Ignac (2017-05-08) and Damien Seguin (2023-10)
 * @alias module:postProcessing.sao.frag
 * @type {string}
 */ var saoFrag = /* glsl */ `
precision highp float;

// Required defines:
// Number of direct samples to take at each pixel:
// NUM_SAMPLES 11
// Number of turns around the circle that the spiral pattern makes (should be
// prime number to prevent taps from lining up):
// NUM_SPIRAL_TURNS 7

// Optional defines:
// USE_NOISE_TEXTURE

${frag}

uniform sampler2D uDepthTexture;
uniform sampler2D uNormalTexture;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;

#ifdef USE_NOISE_TEXTURE
  uniform sampler2D uNoiseTexture;
  uniform float uNoiseTextureSize;
#endif

uniform float uNear;
uniform float uFar;
uniform float uFov;

uniform float uIntensity; // Darkening factor
uniform float uRadius; // World-space AO radius in scene units (r).  e.g., 1.0m
uniform float uBias; // Bias to avoid AO in smooth corners, e.g., 0.01m
uniform float uBrightness;
uniform float uContrast;

// Includes
${saturate}
${random}
${TWO_PI}
${depthRead_glsl}
${depthPosition_glsl}
${colorCorrection_glsl}

const float RADIUS_MULTIPLIER = 500.0;
const float EPSILON = 0.01;

const float NUM_SAMPLES_FLOAT = float(NUM_SAMPLES);
const float INV_NUM_SAMPLES = 1.0 / NUM_SAMPLES_FLOAT;
const float NUM_SPIRAL_TURNS_TIMES_TWO_PI = float(NUM_SPIRAL_TURNS) * TWO_PI;

vec3 getPositionView(vec2 uv) {
  return reconstructPositionFromDepth(uv, readDepth(uDepthTexture, uv, uNear, uFar));
}

vec3 getOffsetPositionView(vec2 uv, vec2 unitOffset, float radiusScreen) {
  return getPositionView(uv + radiusScreen * unitOffset * uTexelSize);
}

// Returns a unit vector and a screen-space radius for the tap on a unit disk (the caller should scale by the actual disk radius)
vec2 tapLocation(int sampleNumber, float spinAngle, out float radiusScreen) {
  // Radius relative to radiusScreen
  float alpha = (float(sampleNumber) + 0.5) * INV_NUM_SAMPLES;
  float angle = alpha * (NUM_SPIRAL_TURNS_TIMES_TWO_PI) + spinAngle;

  radiusScreen = alpha;
  return vec2(cos(angle), sin(angle));
}

float sampleAO(vec2 uv, vec3 positionView, vec3 normalView, float sampleRadiusScreen, int tapIndex, float rotationAngle, float radius2) {
  // Offset on the unit disk, spun for this pixel
  float radiusScreen = 0.0;
  vec2 unitOffset = tapLocation(tapIndex, rotationAngle, radiusScreen);
  radiusScreen *= sampleRadiusScreen;

  // The occluding point in camera space
  vec3 v = getOffsetPositionView(uv, unitOffset, radiusScreen) - positionView;

  float vv = dot(v, v);
  float vn = dot(v, normalView) - uBias;

  float f = max(radius2 - vv, 0.0) / radius2;
  return f * f * f * max(vn / (EPSILON + vv), 0.0);
}

void main() {
  float visibility = 0.0;

  vec2 vUV = gl_FragCoord.xy * uTexelSize;
  vec3 originView = getPositionView(vUV);

  float depth = saturate(smoothstep(uNear, uFar, -originView.z));

  if (depth >= 1.0) {
    visibility = 1.0;
  } else {
    vec3 normalView = texture2D(uNormalTexture, vUV).rgb * 2.0 - 1.0;

    #ifdef USE_NOISE_TEXTURE
      float noise = texture2D(uNoiseTexture, gl_FragCoord.xy / uNoiseTextureSize).r;
    #else
      // Rotation jitter approach from
      // https://github.com/MaxwellGengYF/Unity-Ground-Truth-Ambient-Occlusion/blob/9cc30e0f31eb950a994c71866d79b2798d1c508e/Shaders/GTAO_Common.cginc#L152-L155
      float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    #endif

    float randomPatternRotationAngle = rand(gl_FragCoord.xy) * TWO_PI * noise;

    float radius = uRadius * RADIUS_MULTIPLIER;
    float projScale = 1.0 / (2.0 * tan(uFov * 0.5));
    float radiusScreen = projScale * radius / originView.z;

    float radius2 = radius * radius;

    for (int i = 0; i < NUM_SAMPLES; ++i) {
      visibility += sampleAO(vUV, originView, normalView, radiusScreen, i, randomPatternRotationAngle, radius2);
    }

    visibility = max(0.03, pow(1.0 - visibility / (4.0 * NUM_SAMPLES_FLOAT), 1.0 + uIntensity));
  }

  // Brightness/contrast adjust
  visibility = saturate(brightnessContrast(visibility, uBrightness, uContrast));

  gl_FragColor = vec4(visibility, 0.0, 0.0, 1.0);

  ${assignment}
}
`;

/**
 * GTAO (Ground Truth)
 *
 * Paper: https://www.activision.com/cdn/research/Practical_Real_Time_Strategies_for_Accurate_Indirect_Occlusion_NEW%20VERSION_COLOR.pdf
 *
 * Reference Implementation: https://github.com/GameTechDev/XeGTAO/blob/master/Source/Rendering/Shaders/XeGTAO.hlsli
 *
 * Updates: Damien Seguin (2023-10)
 * @alias module:postProcessing.gtao.frag
 * @type {string}
 */ var gtaoFrag = /* glsl */ `
precision highp float;

// Required defines:
// Number of hemisphere slices:
// NUM_SLICES 11
// Number of sample per slice:
// NUM_SAMPLES 7

// Optional defines:
// USE_NOISE_TEXTURE
// USE_COLOR_BOUNCE

${frag}

uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform sampler2D uNormalTexture;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;

#ifdef USE_NOISE_TEXTURE
  uniform sampler2D uNoiseTexture;
  uniform float uNoiseTextureSize;
#endif

uniform float uNear;
uniform float uFar;
uniform float uFov;

uniform float uIntensity;
uniform float uRadius; // world (viewspace) maximum size of the shadow
uniform float uBias;
uniform float uBrightness;
uniform float uContrast;

#ifdef USE_COLOR_BOUNCE
uniform float uColorBounceIntensity;
#endif

// Includes
${saturate}
${round}
${HALF_PI}
${PI}
${TWO_PI}
${depthRead_glsl}
${depthPosition_glsl}
${colorCorrection_glsl}

const float NUM_SLICES_FLOAT = float(NUM_SLICES);
const float NUM_SAMPLES_FLOAT = float(NUM_SAMPLES);
const float COLOR_DIVIDER = (NUM_SAMPLES_FLOAT * NUM_SLICES_FLOAT) * 2.0;

vec3 getPositionView(vec2 uv) {
  // TODO: sample depth from miplevel
  return reconstructPositionFromDepth(uv, readDepth(uDepthTexture, uv, uNear, uFar));
}

vec3 addColorBounce(vec3 normalView, vec2 uv, vec3 horizon, float radius) {
  return texture2D(uTexture, uv).rgb *
    saturate(dot(normalize(horizon), normalView)) *
    pow(1.0 - saturate(length(horizon) / radius), 2.0);
}

#define FALLOFF_RANGE 0.615 // distant samples contribute less
#define SAMPLE_DISTRIBUTION_POWER 2.0 // small crevices more important than big surfaces

// if the offset is under approx pixel size (pixelTooCloseThreshold), push it out to the minimum distance
const float pixelTooCloseThreshold = 1.3;

void main() {
  float visibility = 0.0;

  #ifdef USE_COLOR_BOUNCE
    vec3 color = vec3(0.0);
  #endif

  vec2 vUV = gl_FragCoord.xy * uTexelSize;
  vec3 centerPositionView = getPositionView(vUV);

  float depth = saturate(smoothstep(uNear, uFar, -centerPositionView.z));

  if (depth >= 1.0) {
    visibility = 1.0;
  } else {
    vec3 normalView = texture2D(uNormalTexture, vUV).rgb * 2.0 - 1.0;

    vec3 viewVec = normalize(-centerPositionView);

    float sampleDistributionPower = SAMPLE_DISTRIBUTION_POWER;
    float thinOccluderCompensation = uBias;
    float falloffRange = FALLOFF_RANGE * uRadius;

    float falloffFrom = uRadius * (1.0 - FALLOFF_RANGE);

    // fadeout precompute optimisation
    float falloffMul = -1.0 / falloffRange;
    float falloffAdd = falloffFrom / falloffRange + 1.0;

    // Get the screen space radius
    float projScale = 1.0 / (2.0 * tan(uFov * 0.5));
    float viewspaceZ = texture2D(uDepthTexture, vUV).x;
    // const vec2 pixelDirRBViewspaceSizeAtCenterZ = viewspaceZ.xx * consts.NDCToViewMul_x_PixelSize;
    float pixelDirRBViewspaceSizeAtCenterZ = viewspaceZ * (projScale * uTexelSize.x);
    float screenspaceRadius = uRadius / pixelDirRBViewspaceSizeAtCenterZ;

    #ifdef USE_NOISE_TEXTURE
      vec2 noise = texture2D(uNoiseTexture, gl_FragCoord.xy / uNoiseTextureSize).xy;
      float noiseSlice = noise.x;
      float noiseSample = noise.y;
    #else
      // Rotation jitter approach from
      // https://github.com/MaxwellGengYF/Unity-Ground-Truth-Ambient-Occlusion/blob/9cc30e0f31eb950a994c71866d79b2798d1c508e/Shaders/GTAO_Common.cginc#L152-L155
      float noiseSlice = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float jitterMod = (gl_FragCoord.x + gl_FragCoord.y) * 0.25;
      float noiseSample = mod(jitterMod, 1.0) * (screenspaceRadius / NUM_SAMPLES_FLOAT) * 0.25;
    #endif

    // fade out for small screen radii
    visibility += saturate((10.0 - screenspaceRadius) / 100.0) * 0.5;

    if (screenspaceRadius < pixelTooCloseThreshold) {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      return;
    }

    // this is the min distance to start sampling from to avoid sampling from the center pixel (no useful data obtained from sampling center pixel)
    float minS = pixelTooCloseThreshold / screenspaceRadius;

    for (int slice = 0; slice < NUM_SLICES; slice++) {
      float sliceFloat = float(slice);
      float sliceK = (sliceFloat + noiseSlice) / NUM_SLICES_FLOAT;
      float phi = sliceK * PI;
      float cosPhi = cos(phi);
      float sinPhi = sin(phi);
      vec2 omega = vec2(cosPhi, sinPhi);

      // convert to screen units (pixels) for later use
      omega *= screenspaceRadius;

      vec3 directionVec = vec3(cosPhi, sinPhi, 0);
      vec3 orthoDirectionVec = directionVec - (dot(directionVec, viewVec) * viewVec);
      // axisVec is orthogonal to directionVec and viewVec, used to define projectedNormal
      vec3 axisVec = normalize(cross(orthoDirectionVec, viewVec));
      vec3 projectedNormalVec = normalView - axisVec * dot(normalView, axisVec);

      float signNorm = sign(dot(orthoDirectionVec, projectedNormalVec));
      float projectedNormalVecLength = length(projectedNormalVec);
      float cosNorm = saturate(dot(projectedNormalVec, viewVec) / projectedNormalVecLength);
      float n = signNorm * acos(cosNorm);

      // this is a lower weight target; not using -1 as in the original paper because it is under horizon, so a 'weight' has different meaning based on the normal
      float lowHorizonCos0 = cos(n + HALF_PI);
      float lowHorizonCos1 = cos(n - HALF_PI);

      float horizonCos0 = lowHorizonCos0;
      float horizonCos1 = lowHorizonCos1;

      for (int j = 0; j < NUM_SAMPLES; j++) {
        float stepFloat = float(j);
        float stepNoise = fract(
          noiseSample +
          // R1 sequence (http://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/)
          (sliceFloat + stepFloat * NUM_SAMPLES_FLOAT) * 0.6180339887498948482
        );

        // Snap to pixel center (more correct direction math, avoids artifacts due to sampling pos not matching depth texel center - messes up slope - but adds other
        // artifacts due to them being pushed off the slice). Also use full precision for high res cases.
        vec2 sampleOffset = round(
          (
            // minS to avoid sampling center pixel
            pow((stepFloat + stepNoise) / NUM_SAMPLES_FLOAT, sampleDistributionPower) + minS
          ) * omega
        ) * uTexelSize;

        vec2 sampleScreenPos0 = vUV + sampleOffset;
        vec2 sampleScreenPos1 = vUV - sampleOffset;

        vec3 sampleDelta0 = getPositionView(sampleScreenPos0) - centerPositionView;
        vec3 sampleDelta1 = getPositionView(sampleScreenPos1) - centerPositionView;
        float sampleDist0 = length(sampleDelta0);
        float sampleDist1 = length(sampleDelta1);

        #ifdef USE_COLOR_BOUNCE
          color += addColorBounce(normalView, sampleScreenPos0, sampleDelta0, uRadius);
          color += addColorBounce(normalView, sampleScreenPos1, sampleDelta1, uRadius);
        #endif

        vec3 sampleHorizonVec0 = vec3(sampleDelta0 / sampleDist0);
        vec3 sampleHorizonVec1 = vec3(sampleDelta1 / sampleDist1);

        // this is our own thickness heuristic that relies on sooner discarding samples behind the center
        float falloffBase0 = length(vec3(sampleDelta0.x, sampleDelta0.y, sampleDelta0.z * (1.0 + thinOccluderCompensation)));
        float falloffBase1 = length(vec3(sampleDelta1.x, sampleDelta1.y, sampleDelta1.z * (1.0 + thinOccluderCompensation)));
        float weight0 = saturate(falloffBase0 * falloffMul + falloffAdd);
        float weight1 = saturate(falloffBase1 * falloffMul + falloffAdd);

        // sample horizon cos
        float shc0 = dot(sampleHorizonVec0, viewVec);
        float shc1 = dot(sampleHorizonVec1, viewVec);

        // discard unwanted samples
        // this would be more correct but too expensive: cos(mix(acos(lowHorizonCosN), acos(shcN), weightN));
        shc0 = mix(lowHorizonCos0, shc0, weight0);
        shc1 = mix(lowHorizonCos1, shc1, weight1);

        // thicknessHeuristic disabled
        // https://github.com/GameTechDev/XeGTAO/tree/master#thin-occluder-conundrum
        horizonCos0 = max(horizonCos0, shc0);
        horizonCos1 = max(horizonCos1, shc1);
      }

      // I can't figure out the slight overdarkening on high slopes, so I'm adding this fudge - in the training set, 0.05 is close (PSNR 21.34) to disabled (PSNR 21.45)
      projectedNormalVecLength = mix(projectedNormalVecLength, 1.0, 0.05);

      float h0 = 2.0 * -acos(horizonCos1);
      float h1 = 2.0 * acos(horizonCos0);

      visibility += projectedNormalVecLength * (
        (cosNorm + h0 * sin(n) - cos(h0 - n)) +
        (cosNorm + h1 * sin(n) - cos(h1 - n))
      ) * 0.25;
    }

    visibility = max(0.03, pow(visibility / NUM_SLICES_FLOAT, 1.0 + uIntensity));
  }

  visibility = saturate(brightnessContrast(visibility, uBrightness, uContrast));

  #ifdef USE_COLOR_BOUNCE
    color /= COLOR_DIVIDER / uColorBounceIntensity;
    gl_FragColor = vec4(color, visibility);
  #else
    gl_FragColor = vec4(visibility, 0.0, 0.0, 1.0);
  #endif

  ${assignment}
}
`;

/**
 * SSAO mix
 *
 * @alias module:postProcessing.ssaoMix.frag
 * @type {string}
 */ var ssaoMixFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uTexture;
uniform vec2 uViewportSize;

uniform sampler2D uSSAOTexture;
uniform float uSSAOMix;

${ambientOcclusion_glsl}

void main () {
  vec2 vUV = gl_FragCoord.xy / uViewportSize;

  gl_FragColor = ssao(texture2D(uTexture, vUV), texture2D(uSSAOTexture, vUV), uSSAOMix);

  ${assignment}
}
`;

/**
 * @alias module:postProcessing.threshold.frag
 * @type {string}
 */ var thresholdFrag = /* glsl */ `
precision highp float;

// Optional defines:
// COLOR_FUNCTION
// USE_SOURCE_COLOR
// USE_SOURCE_EMISSIVE

#ifndef COLOR_FUNCTION
  #define COLOR_FUNCTION luma
#endif

${frag}

#ifndef USE_SOURCE_EMISSIVE
  uniform sampler2D uTexture;
#endif
uniform sampler2D uEmissiveTexture;

uniform float uExposure;
uniform float uThreshold;

varying vec2 vTexCoord0;

// Includes
${luma_glsl}
${luminance_glsl}
${average_glsl}

void main() {
  // Glare naturally occurs for anything bright enough.
  #ifdef USE_SOURCE_EMISSIVE
    // For artistic control, perform threshold only on emissive.
    vec4 color = texture2D(uEmissiveTexture, vTexCoord0);
  #else
    // Or use color where, for a threshold value of 1, only HDR colors are filtered
    vec4 color = texture2D(uTexture, vTexCoord0);
  #endif

  color.rgb *= uExposure;

  float brightness = COLOR_FUNCTION(color.rgb);
  float smoothRange = 0.1;
  float t1 = uThreshold * (1.0 - smoothRange);

  if (brightness > t1) {
    color *= smoothstep(t1, uThreshold * (1.0 + smoothRange), brightness);
  } else {
    color = vec4(0.0);
  }

  // Emissive is added on top if not performing threshold on a specific source
  #if !defined(USE_SOURCE_COLOR) && !defined(USE_SOURCE_EMISSIVE)
    color += texture2D(uEmissiveTexture, vTexCoord0);
  #endif

  gl_FragColor = color;

  ${assignment}
}
`;

/**
 * Upsample
 *
 * Reference Implementation: https://github.com/keijiro/KinoBloom
 * @alias module:postProcessing.upsample.frag
 * @type {string}
 */ var upsampleFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uTexture;
uniform vec2 uTexelSize;

varying vec2 vTexCoord0LeftUp;
varying vec2 vTexCoord0RightUp;
varying vec2 vTexCoord0LeftDown;
varying vec2 vTexCoord0RightDown;

#if QUALITY == 1
  varying vec2 vTexCoord0;
  varying vec2 vTexCoord0Down;
  varying vec2 vTexCoord0Up;
  varying vec2 vTexCoord0Left;
  varying vec2 vTexCoord0Right;
#endif

void main () {
  // 4-tap bilinear upsampler
  #if QUALITY == 0
    gl_FragColor = vec4(
      (
        texture2D(uTexture, vTexCoord0LeftDown).rgb * 0.25 +
        texture2D(uTexture, vTexCoord0RightDown).rgb * 0.25 +
        texture2D(uTexture, vTexCoord0LeftUp).rgb * 0.25 +
        texture2D(uTexture, vTexCoord0RightUp).rgb * 0.25
      ),
      1.0
    );
  // 9-tap bilinear upsampler (tent filter)
  #else
    gl_FragColor = vec4(
      (
        texture2D(uTexture, vTexCoord0LeftDown).rgb * 0.0625 +
        texture2D(uTexture, vTexCoord0Left).rgb * 0.125 +
        texture2D(uTexture, vTexCoord0RightDown).rgb * 0.0625 +
        texture2D(uTexture, vTexCoord0Down).rgb * 0.125 +
        texture2D(uTexture, vTexCoord0).rgb * 0.25 +
        texture2D(uTexture, vTexCoord0Up).rgb * 0.125 +
        texture2D(uTexture, vTexCoord0LeftUp).rgb * 0.0625 +
        texture2D(uTexture, vTexCoord0Right).rgb * 0.125 +
        texture2D(uTexture, vTexCoord0RightUp).rgb * 0.0625
      ),
      1.0
    );
  #endif

  ${assignment}
}
`;

/**
 * @member {object}
 * @static
 */ const bilateralBlur = {
    frag: bilateralBlurFrag
};
/**
 * @member {object}
 * @static
 */ const dof = {
    frag: dofFrag
};
/**
 * @member {object}
 * @static
 */ const downsample = {
    frag: downsampleFrag
};
/**
 * @member {object}
 * @static
 */ const postProcessing = {
    vert: postProcessingVert,
    frag: postProcessingFrag
};
/**
 * @member {object}
 * @static
 */ const sao = {
    frag: saoFrag
};
/**
 * @member {object}
 * @static
 */ const gtao = {
    frag: gtaoFrag
};
/**
 * @member {object}
 * @static
 */ const ssaoMix = {
    frag: ssaoMixFrag
};
/**
 * @member {object}
 * @static
 */ const threshold = {
    frag: thresholdFrag
};
/**
 * @member {object}
 * @static
 */ const upsample = {
    frag: upsampleFrag
};

var index$2 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  bilateralBlur: bilateralBlur,
  dof: dof,
  downsample: downsample,
  gtao: gtao,
  postProcessing: postProcessing,
  sao: sao,
  ssaoMix: ssaoMix,
  threshold: threshold,
  upsample: upsample
});

/**
 * @alias module:reflectionProbe.blitToOctMapAtlas.frag
 * @type {string}
 */ var blitToOctMapAtlasFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uOctMap;
uniform float uOctMapSize;
uniform float uSourceRegionSize;

varying vec2 vTexCoord0;

void main() {
  vec2 uv = vTexCoord0;
  uv *= uSourceRegionSize / uOctMapSize;

  gl_FragColor = texture2D(uOctMap, uv);

  ${assignment}
}
`;

/**
 * @alias module:reflectionProbe.convolveOctMapAtlasToOctMap.frag
 * @type {string}
 */ var convolveOctMapAtlasToOctMapFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uOctMapAtlas;
uniform float uOctMapAtlasSize;
uniform int uOctMapAtlasEncoding;
uniform float uIrradianceOctMapSize;
uniform int uOutputEncoding;

varying vec2 vTexCoord0;

${PI}
${octMapUvToDir_glsl}
${octMap_glsl}
${encodeDecode_glsl}

void main() {
  vec3 N = octMapUVToDir(vTexCoord0, uIrradianceOctMapSize);
  vec3 normal = N;

  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = cross(normal,right);

  vec3 sampledColor = vec3(0.0, 0.0, 0.0);
  float index = 0.0;
  const float dphi = 2.0 * PI / 180.0 * 2.0;
  const float dtheta = 0.5 * PI / 64.0 * 2.0;
  for(float phi = 0.0; phi < 2.0 * PI; phi += dphi) {
    for(float theta = 0.0; theta < 0.5 * PI; theta += dtheta) {
      vec3 temp = cos(phi) * right + sin(phi) * up;
      vec3 sampleVector = cos(theta) * normal + sin(theta) * temp;
      // in theory this should be sample from mipmap level e.g. 2.0, 0.0
      // but sampling from prefiltered roughness gives much smoother results
      vec2 sampleUV = envMapOctahedral(sampleVector, 0.0, 2.0, uOctMapAtlasSize);
      vec4 color = texture2D( uOctMapAtlas, sampleUV);
      sampledColor += decode(color, uOctMapAtlasEncoding).rgb * cos(theta) * sin(theta);
      index += 1.0;
    }
  }

  sampledColor = PI * sampledColor / index;
  gl_FragColor = encode(vec4(sampledColor, 1.0), uOutputEncoding);

  ${assignment}
}
`;

/**
 * @alias module:reflectionProbe.cubemapToOctMap.frag
 * @type {string}
 */ var cubemapToOctmapFrag = /* glsl */ `
precision highp float;

${frag}

${octMapUvToDir_glsl}

uniform samplerCube uCubemap;
uniform float uTextureSize;

varying vec2 vTexCoord0;

void main() {
  vec3 N = octMapUVToDir(vTexCoord0, uTextureSize);
  gl_FragColor = textureCube(uCubemap, N);

  ${assignment}
}
`;

/**
 * @alias module:reflectionProbe.downsampleFromOctMapAtlas.frag
 * @type {string}
 */ var downsampleFromOctMapAtlasFrag = /* glsl */ `
precision highp float;

${frag}

// uniform float uLevelSize;
uniform sampler2D uOctMapAtlas;
uniform float uOctMapAtlasSize;
uniform float uRoughnessLevel;
uniform float uMipmapLevel;

varying vec2 vTexCoord0;

${octMapUvToDir_glsl}
${octMap_glsl}

void main() {
  vec2 uv = vTexCoord0;
  float width = uOctMapAtlasSize;
  float maxLevel = log2(width); // this should come from log of size

  float levelSize = width / pow(2.0, 1.0 + uMipmapLevel + uRoughnessLevel);
  float roughnessLevelWidth = width / pow(2.0, 1.0 + uRoughnessLevel);

  float vOffset = (width - pow(2.0, maxLevel - uRoughnessLevel));
  float hOffset = 2.0 * roughnessLevelWidth - pow(2.0, log2(2.0 * roughnessLevelWidth) - uMipmapLevel);
  // trying to fix oveflow from atlas..
  uv = (uv * levelSize - 0.5) / (levelSize - 1.0);
  uv *= levelSize;
  uv = (uv + vec2(hOffset, vOffset)) / width;
  vec4 color = vec4(0.0);
  color += texture2D(uOctMapAtlas, uv);
  color += texture2D(uOctMapAtlas, uv + vec2(-1.0, 0.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 1.0, 0.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 0.0,-1.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 0.0, 1.0)/levelSize);
  color /= 5.0;
  gl_FragColor = color;

  ${assignment}
}
`;

/**
 * @alias module:reflectionProbe.prefilterFromOctMapAtlas.frag
 * @type {string}
 */ var prefilterFromOctMapAtlasFrag = /* glsl */ `
precision highp float;

${frag}

// Variables
uniform float uTextureSize;
uniform sampler2D uOctMapAtlas;
uniform float uOctMapAtlasSize;
uniform int uOctMapAtlasEncoding;
uniform sampler2D uHammersleyPointSetMap;
uniform int uNumSamples;
uniform float uLevel;
uniform float uSourceMipmapLevel;
uniform float uSourceRoughnessLevel;
uniform float uRoughnessLevel;
uniform int uOutputEncoding;

varying vec2 vTexCoord0;

// Includes
${PI}
${saturate}
${octMap_glsl}
${octMapUvToDir_glsl}
${encodeDecode_glsl}

//Sampled from a texture generated by code based on
//http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
vec2 Hammersley(int i, int N) {
  return texture2D(uHammersleyPointSetMap, vec2(0.5, (float(i) + 0.5)/float(N))).rg;
}

//Based on Real Shading in Unreal Engine 4
vec3 ImportanceSampleGGX(vec2 Xi, float Roughness, vec3 N) {
  //this is mapping 2d point to a hemisphere but additionally we add spread by roughness
  float a = Roughness * Roughness;
  // a *= 0.75; // to prevent overblurring as we sample from previous roughness level with smaller number of samples
  float Phi = 2.0 * PI * Xi.x;
  float CosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
  float SinTheta = sqrt(1.0 - CosTheta * CosTheta);
  vec3 H;
  H.x = SinTheta * cos(Phi);
  H.y = SinTheta * sin(Phi);
  H.z = CosTheta;

  //Tangent space vectors
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, N));
  vec3 bitangent = normalize(cross(N, tangent));

  //Tangent to World Space
  vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
  return normalize(sampleVec);
}

//TODO: optimize this using sign()
//Source: http://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec4 textureOctMapLod(sampler2D tex, vec2 uv, float sourceRoughnessLevel, float sourceMipmapLevel) {
  float width = uOctMapAtlasSize;
  float maxLevel = log2(width); // this should come from log of size

  float levelSize = width / pow(2.0, 1.0 + sourceMipmapLevel + sourceRoughnessLevel);
  float roughnessLevelWidth = width / pow(2.0, 1.0 + sourceMipmapLevel);

  float vOffset = (width - pow(2.0, maxLevel - sourceRoughnessLevel));
  float hOffset = 2.0 * roughnessLevelWidth - pow(2.0, log2(2.0 * roughnessLevelWidth) - sourceMipmapLevel);

  // trying to fix oveflow from atlas..
  uv = (uv * levelSize + 0.5) / (levelSize + 1.0);
  uv *= levelSize;
  uv = (uv + vec2(hOffset, vOffset)) / width;
  return texture2D(uOctMapAtlas, uv);
}

vec4 textureOctMapLod(sampler2D tex, vec2 uv) {
  return textureOctMapLod(tex, uv, uSourceRoughnessLevel, uSourceMipmapLevel);
}

vec3 PrefilterEnvMap( float roughness, vec3 R, vec2 uv ) {
  vec3 N = R;
  vec3 V = R;
  vec3 PrefilteredColor = vec3(0.0);
  const int NumSamples = 1024;
  float TotalWeight = 0.0;
  for( int i = 0; i < NumSamples; i++ ) {
    if (i >= uNumSamples) {
      break;
    }
    vec2 Xi = Hammersley( i, uNumSamples );
    //vec3 H = ImportanceSampleGGX( Xi, roughness, normalize(N + 0.02* vec3(rand(uv), rand(uv.yx), rand(uv * 2.0))));
    vec3 H = ImportanceSampleGGX( Xi, roughness, N);
    vec3 L = normalize(2.0 * dot( V, H ) * H - V);
    float NoL = saturate( dot( N, L ) );
    if( NoL > 0.0 ) {
      vec4 color = textureOctMapLod(uOctMapAtlas, envMapOctahedral(L));
      PrefilteredColor += NoL * decode(color, uOctMapAtlasEncoding).rgb;
      TotalWeight += NoL;
    }
  }
  return PrefilteredColor / TotalWeight;
}

void main() {
  vec3 normal = octMapUVToDir(vTexCoord0);
  vec3 color = PrefilterEnvMap(uRoughnessLevel / 5.0, normal, vTexCoord0);
  gl_FragColor = encode(vec4(color, 1.0), uOutputEncoding);

  ${assignment}
}
`;

/**
 * @member {object}
 * @static
 */ const blitToOctMapAtlas = {
    frag: blitToOctMapAtlasFrag
};
/**
 * @member {object}
 * @static
 */ const convolveOctMapAtlasToOctMap = {
    frag: convolveOctMapAtlasToOctMapFrag
};
/**
 * @member {object}
 * @static
 */ const cubemapToOctMap = {
    frag: cubemapToOctmapFrag
};
/**
 * @member {object}
 * @static
 */ const downsampleFromOctMapAtlas = {
    frag: downsampleFromOctMapAtlasFrag
};
/**
 * @member {object}
 * @static
 */ const prefilterFromOctMapAtlas = {
    frag: prefilterFromOctMapAtlasFrag
};

var index$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  blitToOctMapAtlas: blitToOctMapAtlas,
  convolveOctMapAtlasToOctMap: convolveOctMapAtlasToOctMap,
  cubemapToOctMap: cubemapToOctMap,
  downsampleFromOctMapAtlas: downsampleFromOctMapAtlas,
  prefilterFromOctMapAtlas: prefilterFromOctMapAtlas
});

/**
 * Skybox
 *
 * Based on http://gamedev.stackexchange.com/questions/60313/implementing-a-skybox-with-glsl-version-330
 * @alias module:skybox.skybox.vert
 * @type {string}
 */ var skyboxVert = /* glsl */ `
${vert}

attribute vec2 aPosition;

${inverseMat4}
${transposeMat3}

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

varying vec3 wcNormal;

void main() {
  mat4 inverseProjection = inverse(uProjectionMatrix);
  mat3 inverseModelview = transpose(mat3(uViewMatrix));
  vec3 unprojected = (inverseProjection * vec4(aPosition, 0.0, 1.0)).xyz;
  wcNormal = (uModelMatrix * vec4(inverseModelview * unprojected, 1.0)).xyz;

  gl_Position = vec4(aPosition, 0.9999, 1.0);
}
`;

/**
 * @alias module:skybox.skybox.frag
 * @type {string}
 */ var skyboxFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision highp float;

${frag}

// Variables
uniform int uOutputEncoding;

// assuming texture in Linear Space
// most likely HDR or Texture2D with sRGB Ext
uniform sampler2D uEnvMap;
uniform int uEnvMapEncoding;
uniform float uEnvMapSize;
uniform float uEnvMapExposure;
uniform float uBackgroundBlur;

varying vec3 wcNormal;

uniform float uExposure;

// Includes
${PI}
${TWO_PI}

${encodeDecode_glsl}
${envMapEquirect_glsl}
${octMap_glsl}
${irradiance_glsl}
${Object.values(glslToneMap).join("\n")}

void main() {
  vec3 N = normalize(wcNormal);

  vec4 color = vec4(0.0);

  if (uBackgroundBlur <= 0.0) {
    color = decode(texture2D(uEnvMap, envMapEquirect(N)), uEnvMapEncoding);
  } else {
    color = vec4(getIrradiance(N, uEnvMap, uEnvMapSize, uEnvMapEncoding), 1.0);
  }

  color.rgb *= uEnvMapExposure;

  color.rgb *= uExposure;

  #if defined(TONE_MAP)
    color.rgb = TONE_MAP(color.rgb);
  #endif

  gl_FragData[0] = encode(color, uOutputEncoding);

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(0.0, 0.0, 1.0, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = vec4(0.0);
    #endif
  #endif

  ${assignment}
}
`;

/**
 * @alias module:skybox.skyEnvMap.vert
 * @type {string}
 */ var skyEnvMapVert = /* glsl */ `
${vert}

attribute vec2 aPosition;

uniform vec3 uSunPosition;
uniform vec4 uParameters; // turbidity, rayleigh, mieCoefficient, mieDirectionalG

varying vec2 vTexCoord0;

varying vec3 vSunDirection;
varying float vSunfade;
varying float vSunE;
varying vec3 vBetaR;
varying vec3 vBetaM;

${saturate}

// const float turbidity = 10.0; // a measure of the fraction of scattering due to haze as opposed to molecules.
// const float rayleigh = 2.0; // scattering by air molecules
// const float mieCoefficient = 0.005; // non-molecular scattering or aerosol particle scattering

// constants for atmospheric scattering
const float e = 2.71828182845904523536028747135266249775724709369995957;

// const float n = 1.0003; // refractive index of air
// const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)
// const float pn = 0.035; // depolatization factor for standard air

// wavelength of used primaries, according to preetham
const vec3 lambda = vec3(680E-9, 550E-9, 450E-9);

// mie stuff
// K coefficient for the primaries
const vec3 K = vec3(0.686, 0.678, 0.666);
const float v = 4.0;

const vec3 up = vec3(0.0, 1.0, 0.0);

const float EE = 1000.0;
// 66 arc seconds -> degrees, and the cosine of that

// earth shadow hack
const float cutoffAngle = 1.6110731556870734; // pi/1.95;
const float steepness = 1.5;

const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);

// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn));
const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);

// A simplied version of the total Reayleigh scattering to works on browsers that use ANGLE
// const vec3 simplifiedRayleigh = 0.0005 / vec3(94, 40, 18);

// float sunIntensity(float zenithAngleCos) {
//   return EE * max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithAngleCos)) / steepness)));
// }
float sunIntensity(float zenithAngleCos) {
  zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
  return EE * max(0.0, 1.0 - pow(e, -((cutoffAngle - acos(zenithAngleCos)) / steepness)));
}

vec3 totalMie(float T) {
  float c = (0.2 * T) * 10E-18;
  return 0.434 * c * MieConst;
}

void main() {
  vSunDirection = normalize(uSunPosition);
  vSunfade = 1.0 - saturate(1.0 - exp((uSunPosition.y / 450000.0)));
  vSunE = sunIntensity(dot(vSunDirection, up));

  float rayleighCoefficient = uParameters.y - (1.0 * (1.0 - vSunfade));
  // extinction (absorbtion + out scattering)
  // rayleigh coefficients
  vBetaR = totalRayleigh * rayleighCoefficient;
  // vBetaR = simplifiedRayleigh * rayleighCoefficient;

  // mie coefficients
  vBetaM = totalMie(uParameters.x) * uParameters.z;
  // vec3 betaM = totalMie(turbidity) * mieCoefficient;

  gl_Position = vec4(aPosition, 0.0, 1.0);
  vTexCoord0 = aPosition * 0.5 + 0.5;
}
`;

/**
 * Sky
 *
 * Based on "A Practical Analytic Model for Daylight" aka The Preetham Model, the de facto standard analytic skydome model
 *
 * Paper: https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight
 *
 * Reference Implementation:
 * - First implemented by Simon Wallner http://www.simonwallner.at/projects/atmospheric-scattering
 * - Improved by Martins Upitis http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 * - Three.js integration by zz85 http://twitter.com/blurspline
 *
 * Updates: Marcin Ignac http://twitter.com/marcinignac (2015-09) and Damien Seguin (2023-10)
 * @alias module:skybox.skyEnvMap.frag
 * @type {string}
 */ var skyEnvMapFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision highp float;

${frag}

uniform int uOutputEncoding;
uniform vec4 uParameters; // turbidity, rayleigh, mieCoefficient, mieDirectionalG

varying vec3 vSunDirection;
varying float vSunfade;
varying float vSunE;
varying vec3 vBetaR;
varying vec3 vBetaM;

varying vec2 vTexCoord0;

${PI}
${TWO_PI}
${saturate}
${encodeDecode_glsl}
${Object.values(glslToneMap).join("\n")}
#ifndef TONE_MAP
  #define TONE_MAP aces
#endif

// const float mieDirectionalG = 0.8;

// const float pi = 3.141592653589793238462643383279502884197169;

// optical length at zenith for molecules
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;

const vec3 up = vec3(0.0, 1.0, 0.0);

const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

// 3.0 / (16.0 * pi)
const float THREE_OVER_SIXTEENPI = 0.05968310365946075;

float rayleighPhase(float cosTheta) {
  return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0));
}

// 1.0 / (4.0 * pi)
const float ONE_OVER_FOURPI = 0.07957747154594767;

float hgPhase(float cosTheta, float g) {
  float g2 = pow(g, 2.0);
  return ONE_OVER_FOURPI * ((1.0 - g2) / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5));
}

vec3 sky(vec3 worldNormal) {
  vec3 direction = normalize(worldNormal); // vWorldPosition - cameraPos

  // optical length
  // cutoff angle at 90 to avoid singularity in next formula.
  float zenithAngle = acos(max(0.0, dot(up, direction)));
  float divider = (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / PI), -1.253));
  float sR = rayleighZenithLength / divider;
  float sM = mieZenithLength / divider;

  // combined extinction factor
  vec3 Fex = exp(-(vBetaR * sR + vBetaM * sM));

  // in scattering
  float cosTheta = dot(direction, vSunDirection);

  float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
  vec3 betaRTheta = vBetaR * rPhase;

  float mPhase = hgPhase(cosTheta, uParameters.w);
  // float mPhase = hgPhase(cosTheta, mieDirectionalG);
  vec3 betaMTheta = vBetaM * mPhase;

  vec3 LinFactor = vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM));
  vec3 Lin = pow(LinFactor * (1.0 - Fex), vec3(1.5));
  Lin *= mix(
    vec3(1.0),
    pow(LinFactor * Fex, vec3(1.0 / 2.0)),
    saturate(pow(1.0 - dot(up, vSunDirection), 5.0))
  );

  // nightsky
  float theta = acos(direction.y); // elevation --> y-axis, [-pi/2, pi/2]
  float phi = atan(direction.z, direction.x); // azimuth --> x-axis [-pi/2, pi/2]
  vec2 uv = vec2(phi, theta) / vec2(TWO_PI, PI) + vec2(0.5, 0.0);
  // vec3 L0 = texture2D(skySampler, uv).rgb+0.1 * Fex;
  vec3 L0 = vec3(0.1) * Fex;

  // composition + solar disc
  // if (cosTheta > sunAngularDiameterCos)
  float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);
  // if (normalize(vWorldPosition - cameraPos).y>0.0)
  L0 += (vSunE * 19000.0 * Fex) * sundisk;

  vec3 texColor = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);

  return pow(texColor, vec3(1.0 / (1.2 + (1.2 * vSunfade))));
}

void main() {
  vec4 color = vec4(0.0);

  // Texture coordinates to normal:
  // https://web.archive.org/web/20170606085139/http://gl.ict.usc.edu/Data/HighResProbes/
  // u=[0,2], v=[0,1],
  // theta=pi*(u-1), phi=pi*v
  // (Dx,Dy,Dz) = (sin(phi)*sin(theta), cos(phi), -sin(phi)*cos(theta)).

  float theta = PI * (vTexCoord0.x * 2.0 - 1.0);
  float phi = PI * (1.0 - vTexCoord0.y);

  color.rgb = sky(vec3(sin(phi) * sin(theta), cos(phi), -sin(phi) * cos(theta)));
  color.rgb = TONE_MAP(color.rgb);
  color.rgb = toLinear(color.rgb);

  color.a = 1.0;

  gl_FragData[0] = encode(color, uOutputEncoding);

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(0.0, 0.0, 1.0, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = vec4(0.0);
    #endif
    #if LOCATION_VELOCITY >= 0
      gl_FragData[LOCATION_VELOCITY] = vec4(0.5, 0.5, 0.5, 1.0);
    #endif
  #endif

  ${assignment}
}
`;

/**
 * @member {object}
 * @static
 */ const skybox = {
    vert: skyboxVert,
    frag: skyboxFrag
};
/**
 * @member {object}
 * @static
 */ const skyEnvMap = {
    vert: skyEnvMapVert,
    frag: skyEnvMapFrag
};

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  skyEnvMap: skyEnvMap,
  skybox: skybox
});

/** @module parser */ /**
 * GLSL 3 preprocessor version string
 */ const GLSL3 = "#version 300 es";
/**
 * Format an object of extension names as key and extension behaviosr (enable/require/warn/disable) as value
 * @param {object} [extensions={}]
 * @returns {string}
 */ function formatExtensions(extensions = {}) {
    return Object.entries(extensions).map(([name, behavior])=>`#extension ${name} : ${behavior}`).join("\n");
}
/**
 * Format an array of define keys
 * @param {string[]} [defines=[]]
 * @returns {string}
 */ function formatDefines(defines = []) {
    return defines.map((flag)=>`#define ${flag}`).join("\n");
}
/**
 * Add version string and format a list of defines for a shader source
 * @param {ctx} ctx
 * @param {string} src
 * @param {string[]} [defines=[]]
 * @param {object} [extensions={}]
 * @returns {string}
 */ function build(ctx, src, defines = [], extensions = {}) {
    return `${ctx.capabilities.isWebGL2 ? GLSL3 : ""}
${formatExtensions(extensions)}
${formatDefines(defines)}
${src}`;
}
/**
 * Monkey patch a shader string for ES300 by replacing builtin keywords and un-necessary extensions, and adding the version preprocessor string
 * @param {string} src
 * @param {"vertex" | "fragment"} stage
 * @returns {string}
 */ function patchES300(src, stage = "vertex") {
    src = src.replace(/texture2D/g, "texture").replace(/textureCube/g, "texture").replace(/texture2DProj/g, "textureProj").replace("mat4 transpose(mat4 m) {", "mat4 transposeOld(mat4 m) {").replace("mat3 transpose(mat3 m) {", "mat3 transposeOld(mat3 m) {").replace("mat4 inverse(mat4 m) {", "mat4 inverseOld(mat4 m) {");
    if (stage === "vertex") {
        if (src.startsWith("#version")) src = src.split("\n").slice(1).join("\n");
        src = src.replace(/attribute/g, "in").replace(/varying/g, "out");
    } else if (stage === "fragment") {
        src = src.split("\n").map((line)=>{
            const trimmedLine = line.trim();
            if ([
                "#version",
                "#extension GL_OES_standard_derivatives",
                "#extension GL_EXT_shader_texture_lod",
                "#extension GL_EXT_draw_buffers",
                "#extension GL_EXT_frag_depth"
            ].some((extension)=>trimmedLine.startsWith(extension))) {
                return false;
            }
            return trimmedLine.startsWith("precision ") ? trimmedLine.replace(/;/, `;\nlayout (location = 0) out vec4 outColor;
layout (location = 1) out vec4 outNormal;
layout (location = 2) out vec4 outEmissive;`) : line;
        }).map((line)=>line || "").join("\n").replace(/varying/g, "in").replace(/texture2DLodEXT/g, "textureLod").replace(/texture2DProjLodEXT/g, "textureProjLod").replace(/textureCubeLodEXT/g, "textureLod").replace(/texture2DGradEXT/g, "textureGrad").replace(/texture2DProjGradEXT/g, "textureProjGrad").replace(/textureCubeGradEXT/g, "textureGrad").replace(/gl_FragData\[0\]/g, "outColor").replace(/gl_FragColor/g, "outColor").replace(/gl_FragData\[1\]/g, "outNormal").replace(/gl_FragData\[2\]/g, "outEmissive");
    }
    return `${GLSL3}\n${src}`;
}
/**
 * Unroll loops (looped preceded by "#pragma unroll_loop") for lights and replace their constant iterators
 * @param {string} src
 * @param {object} options
 * @returns {string}
 */ function replaceStrings(src, options) {
    // Unroll loop
    const unrollLoopPattern = /#pragma unroll_loop[\s]+?for \(int i = (\d+); i < (\d+|\D+); i\+\+\) \{([\s\S]+?)(?=\})\}/g;
    src = src.replace(unrollLoopPattern, (match, start, end, snippet)=>{
        let unroll = "";
        // Replace lights number
        end = end.replace(/NUM_AMBIENT_LIGHTS/g, options.ambientLights.length || 0).replace(/NUM_DIRECTIONAL_LIGHTS/g, options.directionalLights.length || 0).replace(/NUM_POINT_LIGHTS/g, options.pointLights.length || 0).replace(/NUM_SPOT_LIGHTS/g, options.spotLights.length || 0).replace(/NUM_AREA_LIGHTS/g, options.areaLights.length || 0);
        for(let i = Number.parseInt(start); i < Number.parseInt(end); i++){
            unroll += snippet.replace(/\[i\]/g, `[${i}]`);
        }
        return unroll;
    });
    return src;
}
/**
 * Get a formatted error pointing at the issue line
 * @param {Error} error
 * @param {{ vert: string, frag: string, count: number }} options
 * @returns {string}
 */ function getFormattedError(error, { vert, frag, count = 5 }) {
    const lines = (error.message.match(/Vertex/) ? vert : frag).split("\n");
    const lineNo = parseInt(error.message.match(/ERROR: ([\d]+):([\d]+)/)[2]);
    const startIndex = Math.max(lineNo - count, 0);
    return lines.slice(startIndex, Math.min(lineNo + count, lines.length - 1)).map((line, i)=>startIndex + i == lineNo - 1 ? `--> ${line}` : `    ${line}`).join("\n");
}

var parser = /*#__PURE__*/Object.freeze({
  __proto__: null,
  GLSL3: GLSL3,
  build: build,
  formatDefines: formatDefines,
  formatExtensions: formatExtensions,
  getFormattedError: getFormattedError,
  patchES300: patchES300,
  replaceStrings: replaceStrings
});

export { index$3 as chunks, parser, index$2 as postProcessing, index$1 as reflectionProbe, index as skybox, glslToneMap as toneMap };
