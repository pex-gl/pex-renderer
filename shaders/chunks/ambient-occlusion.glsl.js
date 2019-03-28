module.exports = /* glsl */`
#ifdef USE_AO
  uniform sampler2D uAO;
  uniform vec2 uScreenSize;
#endif

#ifdef USE_OCCLUSION_MAP
  uniform sampler2D uOcclusionMap;
  uniform int uOcclusionMapTexCoordIndex;
#endif
`
