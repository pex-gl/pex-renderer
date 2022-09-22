export default /* glsl */ `

#if NUM_DIRECTIONAL_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0

  //fron depth buf normalized z to linear (eye space) z
  //http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
  // float ndcDepthToEyeSpaceProj(float ndcDepth, float near, float far) {
  //   return 2.0 * near * far / (far + near - ndcDepth * (far - near));
  // }

  //otho
  //z = (f - n) * (zn + (f + n)/(f-n))/2
  //http://www.ogldev.org/www/tutorial47/tutorial47.html
  const float DEPTH_TOLERANCE = 0.001;

  float ndcDepthToEyeSpace(float ndcDepth, float near, float far) {
    return (far - near) * (ndcDepth + (far + near) / (far - near)) / 2.0;
  }

  float readDepth(sampler2D depthMap, vec2 coord, float near, float far) {
    float z_b = texture2D(depthMap, coord).r;
    float z_n = 2.0 * z_b - 1.0;

    return ndcDepthToEyeSpace(z_n, near, far);
  }

  float texture2DCompare(sampler2D depthMap, vec2 uv, float compare, float near, float far) {
    float depth = readDepth(depthMap, uv, near, far);
    if (depth >= far - DEPTH_TOLERANCE) return 1.0;
    // if (depth >= far) return 1.0;
    return step(compare, depth);
  }

  float texture2DShadowLerp(sampler2D depthMap, vec2 size, vec2 uv, float compare, float near, float far){
    vec2 texelSize = vec2(1.0)/size;
    vec2 f = fract(uv * size + 0.5);
    vec2 centroidUV = floor(uv*size+0.5)/size;

    float lb = texture2DCompare(depthMap, centroidUV+texelSize*vec2(0.0, 0.0), compare, near, far);
    float lt = texture2DCompare(depthMap, centroidUV+texelSize*vec2(0.0, 1.0), compare, near, far);
    float rb = texture2DCompare(depthMap, centroidUV+texelSize*vec2(1.0, 0.0), compare, near, far);
    float rt = texture2DCompare(depthMap, centroidUV+texelSize*vec2(1.0, 1.0), compare, near, far);
    float a = mix(lb, lt, f.y);
    float b = mix(rb, rt, f.y);
    float c = mix(a, b, f.x);

    return c;
  }

  float rand(float seed) {
      return fract(sin(seed) * 1231534.9);
  }

  float rand(vec2 seed) {
      return rand(dot(seed, vec2(12.9898, 783.233)));
  }

  //random vector with length 1
  vec2 rand2(vec2 seed) {
    const float pi = 3.1415926535897932384626433832795;
    const float twopi = 2.0 * pi;
    float r = rand(seed) * twopi;
    return vec2(cos(r), sin(r));
  }

  vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    mat2 m = mat2(c, -s, s, c);
    return m * v;
  }

  float PCF3x3(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far){
    float result = 0.0;
    for(int x=-1; x<=1; x++){
        for(int y=-1; y<=1; y++){
            vec2 off = vec2(x,y)/float(size);
            result += texture2DShadowLerp(depths, size, uv+off, compare, near, far);
        }
    }
    return result/9.0;
  }

  float PCF5x5(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far){
    float result = 0.0;
    for(int x=-2; x<=2; x++){
        for(int y=-2; y<=2; y++){
            vec2 off = vec2(x,y)/float(size);
            result += texture2DShadowLerp(depths, size, uv+off, compare, near, far);
        }
    }
    return result/25.0;
  }

  float PCF5x5Penumbra(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far, float radius){
    float result = 0.0;
    for(int x=-2; x<=2; x++){
        for(int y=-2; y<=2; y++){
            vec2 off = vec2(x,y)/float(size) * radius;
            off = rotate(off, rand(uv));
            result += texture2DShadowLerp(depths, size, uv + off, compare, near, far);
        }
    }
    return result/25.0;
  }
  vec2 FindBlockers(sampler2D depthMap, vec2 size, vec2 uv, float receiverDepth, float near, float far){
    float blockers = 0.0;
    float avgBlockerDistance = 0.0;
    float result = 0.0;
    for(int x=-2; x<=2; x++){
        for(int y=-2; y<=2; y++){
            vec2 off = vec2(x,y)/float(size) * 10.0;
            off = rotate(off, rand(uv));
            off += rand2(uv) * 0.01;
            float depth = readDepth(depthMap, uv + off, near, far);
            // if (step(receiverDepth, depth) <= 0.0) {
            if (depth < receiverDepth) {
              blockers += 1.0;
              avgBlockerDistance += depth;
            }
        }
    }

    if (blockers > 0.0) {
      avgBlockerDistance /= blockers;
      // return vec2(1.0);
    }
    // return vec2(0.0);
    return vec2(avgBlockerDistance, blockers);
  }
  float getSoftShadow(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far) {
    float receiverDepth = compare;
    vec2 averageBlocker = FindBlockers(depths, size, uv, receiverDepth, near, far);
    float averageBlockerDepth = averageBlocker.x;

    float blockerCount = averageBlocker.y;
    float penumbraSize = 1.0;
    float lightSize = 3.0;

    if (averageBlockerDepth > 0.0) {
      penumbraSize = lightSize * (receiverDepth - averageBlockerDepth);
    }
    float illuminated = PCF5x5Penumbra(depths, size, uv, compare, near, far, penumbraSize);
    return illuminated;
  }

  float getShadow(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far) {
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
      return 1.0;
    }
    #if SHADOW_QUALITY == 0
      float illuminated = 1.0;
    #endif
    #if SHADOW_QUALITY == 1
      float illuminated = texture2DCompare(depths, uv, compare, near, far);
    #endif
    #if SHADOW_QUALITY == 2
      float illuminated = texture2DShadowLerp(depths, size, uv, compare, near, far);
    #endif
    #if SHADOW_QUALITY == 3
      float illuminated = PCF3x3(depths, size, uv, compare, near, far);
    #endif
    #if SHADOW_QUALITY == 4
      float illuminated = PCF5x5(depths, size, uv, compare, near, far);
    #endif
    #if SHADOW_QUALITY == 5
      float illuminated = getSoftShadow(depths, size, uv, compare, near, far);
    #endif
    return illuminated;
  }
#endif

#if NUM_POINT_LIGHTS > 0
  float getPunctualShadow(samplerCube depths, vec3 posToLight) {
    float dist = length(posToLight);
    vec3 N = -normalize(posToLight);
    float far = 10.0;
    float depth = unpackDepth(textureCube(depths, N)) * far;

    if (dist - 0.05 > depth) {
      return 0.0;
    }

    return 1.0;

    // float depth = textureCube(depths, N).r;
    // illuminated = (depth - dist);
    // illuminated = step(dist, depth / 2.0);

    // data.directDiffuse = vec3(fract(depth));
    // data.directDiffuse = vec3(fract(dist));
    // data.directDiffuse = vec3(illuminated);
  }
#endif
`;
