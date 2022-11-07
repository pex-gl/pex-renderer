export default /* glsl */ `
#ifdef USE_AO
  uniform sampler2D uAO;
  uniform vec2 uScreenSize;
#endif

#ifdef USE_OCCLUSION_MAP
  uniform sampler2D uOcclusionMap;

  #ifdef USE_OCCLUSION_MAP_TEX_COORD_TRANSFORM
    uniform mat3 uOcclusionMapTexCoordTransform;
  #endif
#endif
`;
