attribute vec3 aPosition;

#ifdef USE_INSTANCED_OFFSET
attribute vec3 aOffset;
#endif

#ifdef USE_DISPLACEMENT_MAP
uniform sampler2D uDisplacementMap;
uniform float uDisplacement;
attribute vec2 aTexCoord0;
attribute vec3 aNormal;
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

float uDisplacementShadowStretch = 1.5;

void main() {
    vec3 position = aPosition;
#ifdef USE_DISPLACEMENT_MAP
    vec3 normal = aNormal;
    float h = texture2D(uDisplacementMap, aTexCoord0).r;
    position.xyz += uDisplacement * h * normal * uDisplacementShadowStretch; 
#endif
#ifdef USE_INSTANCED_OFFSET
    position += aOffset; 
#endif
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
}
