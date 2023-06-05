// Based on http://http.developer.nvidia.com/GPUGems/gpugems_ch17.html and http://gl.ict.usc.edu/Data/HighResProbes/
export default /* glsl */ `
vec2 envMapEquirect(vec3 wcNormal) {
  // -1.0 for left handed coorinate system oriented texture (usual case)
  // 1.0 for right handed coorinate system oriented texture
  float flipEnvMap = -1.0;

  // I assume envMap texture has been flipped the WebGL way (pixel 0,0 is a the bottom)
  // therefore we flip wcNorma.y as acos(1) = 0
  float phi = acos(-wcNormal.y);
  float theta = atan(wcNormal.x, flipEnvMap * wcNormal.z) + PI;
  return vec2(theta / TWO_PI, phi / PI);
}
`;
