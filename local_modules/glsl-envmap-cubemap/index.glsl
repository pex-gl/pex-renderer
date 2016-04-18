/**
 * Samples cubemap environment map
 * @param  {vec3} wcNormal - normal in the world coordinate space
 * @param  {float} - flipEnvMap    -1.0 for left handed coorinate system oriented texture (usual case)
 *                                  1.0 for right handed coorinate system oriented texture
 * @return {vec4} - cubemap texture coordinate
 */
vec3 envMapCubemap(vec3 wcNormal, float flipEnvMap) {
    return vec3(flipEnvMap * wcNormal.x, wcNormal.y, wcNormal.z);
}

vec3 envMapCubemap(vec3 wcNormal) {
    //-1.0 for left handed coorinate system oriented texture (usual case)
    return envMapCubemap(wcNormal, -1.0);
}

#pragma glslify: export(envMapCubemap)
