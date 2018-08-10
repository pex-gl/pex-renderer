module.exports = `
vec2 signed(vec2 v) {
  return step(0.0, v) * 2.0 - 1.0;
}

// size = target octmap size
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

// size = target octmap size
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
`
