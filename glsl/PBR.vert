attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord0;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;
uniform mat4 uInverseViewMatrix;
uniform float uTexCoord0Scale;
uniform vec2 uTexCoord0Offset;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec3 vEyeDirWorld;
varying vec3 vEyeDirView;
varying vec2 vTexCord0;

void main() {
    vec3 positionView = vec3(uViewMatrix * uModelMatrix * vec4(aPosition, 1.0));

    vNormalView = vec3(uNormalMatrix * aNormal);
    vNormalWorld = vec3(uInverseViewMatrix * vec4(vNormalView, 0.0));
    vNormalWorld = aNormal;

    vEyeDirView = normalize(vec3(0.0, 0.0, 0.0) - positionView);
    vEyeDirWorld = vec3(uInverseViewMatrix * vec4(vEyeDirView, 0.0));

    gl_Position = uProjectionMatrix * vec4(positionView, 1.0);

    vTexCord0 = fract(aTexCoord0 * uTexCoord0Scale * vec2(1.0, 0.5) + uTexCoord0Offset);
}
