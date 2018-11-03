vec2 envMapEquirect(vec3 wcNormal) {
  const float PI = 3.1415926;
  const float TwoPI = 2.0 * PI;

  //I assume envMap texture has been Y flipped the WebGL way (pixel 0,0 is a the bottom)
  //therefore we flip wcNorma.y as acos(1) = 0
  float flipEnvMap = -1.0;
  float phi = acos(-wcNormal.y);
  float theta = atan(wcNormal.x, flipEnvMap * wcNormal.z) + PI;
  return vec2(theta / TwoPI, phi / PI);
}

#pragma glslify: export(envMapEquirect)
