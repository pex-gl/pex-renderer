#ifdef GL_ES
precision highp float;
#endif

//#pragma glslify: texture2DEnvLatLong  = require(../local_modules/glsl-texture2d-env-latlong)
#pragma glslify: sky = require('glsl-sky')
#pragma glslify: textureCubeEnv = require('glsl-textureCube-env');
#pragma glslify: toLinear = require('glsl-gamma/in');

varying vec3 wcNormal;
uniform vec3 uSunPosition;
uniform samplerCube uEnvMap;
uniform bool uUseEnvMap;

const float flipEnvMap = -1.0;

void main() {
    vec3 N = normalize(wcNormal);

    if (uUseEnvMap) {
        gl_FragColor.rgb = toLinear(textureCubeEnv(uEnvMap, N, flipEnvMap).rgb);
    }
    else {
        gl_FragColor.rgb = sky(uSunPosition, N);
        //gl_FragColor.rgb = tonemapReinhard(sky(uSunPosition, N));
        if (N.y < 0.0) {
            gl_FragColor.rgb = gl_FragColor.rgb * (1.0 - 0.5*min(1.0, -N.y*20.0));
        }
    }
    gl_FragColor.a = 1.0;
    //gl_FragColor = texture2DEnvLatLong(uEnvMap, N, flipEvnMap);
}
