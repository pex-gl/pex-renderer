attribute vec3 aPosition;

#ifdef USE_INSTANCED_OFFSET
attribute vec3 aOffset;
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

void main() {
    vec3 position = aPosition;
#ifdef USE_INSTANCED_OFFSET
    position += aOffset; 
#endif
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
}
