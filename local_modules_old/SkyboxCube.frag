#ifdef GL_ES
precision highp float;
#define GLSLIFY 1
#endif

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

//assuming texture in Linear Space
//most likely HDR or Texture2D with sRGB Ext
uniform samplerCube uEnvMap;
uniform float uFlipEnvMap;

varying vec3 wcNormal;

void main() {
    vec3 N = normalize(wcNormal);

    gl_FragColor.rgb = textureCube(uEnvMap, envMapCubemap(N, uFlipEnvMap)).rgb;
    gl_FragColor.a = 1.0;
}
