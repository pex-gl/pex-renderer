export default /* glsl */ `
vec2 getTextureCoordinates(in PBRData data, in int index) {
  #ifdef USE_TEXCOORD_1
    if (index == 1) return data.texCoord1;
  #endif

  return data.texCoord0;
}

vec2 getTextureCoordinates(in PBRData data, in int index, in mat3 texCoordTransform) {
  vec2 texCoord = getTextureCoordinates(data, index);

  return (texCoordTransform * vec3(texCoord.xy, 1)).xy;
}
`;
