/**
 * Samples cubemap environment map
 * @param  {samplerCube} envMap - cube map texture
 * @param  {vec3} wcNormal - normal in the world coordinate space
 * @param  {float} - flipEnvMap    -1.0 for left handed coorinate system oriented texture (usual case)
 *                                  1.0 for right handed coorinate system oriented texture
 * @return {vec4} - sampledColor
 */
vec4 textureCubeEnv(samplerCube envMap, vec3 wcNormal, float flipEnvMap) {
    vec3 N = wcNormal;
    N.x *= flipEnvMap;
    return textureCube(envMap, N);
}

#pragma glslify: export(textureCubeEnv)
