#ifdef GL_ES
precision highp float;
#endif

varying vec3 wcNormal;
varying vec2 scPosition;

uniform samplerCube uEnvMap;
uniform sampler2D uHammersleyPointSetMap;

const float PI = 3.1415926536;

vec2 hammersley(int i, int N) {
    return texture2D(uHammersleyPointSetMap, vec2(0.5, (float(i) + 0.5)/float(N))).rg;
}

vec3 hemisphereSample(vec2 Xi, vec3 N) {
    /*
    float Phi = Xi.y * 2.0 * PI;
    float CosTheta = sqrt(1.0 - Xi.x);
    float SinTheta = sqrt(1.0 - CosTheta * CosTheta);
    vec3 H;
    H.x = SinTheta * cos(Phi);
    H.y = SinTheta * sin(Phi);
    H.z = CosTheta;

    //Tangent space vectors
    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 TangentX = normalize(cross(UpVector, N));
    vec3 TangentY = cross(N, TangentX);
    */
    float Roughness = 1.0;
    float a = Roughness * Roughness;
    float Phi = 2.0 * PI * Xi.x;// + random(N.xz) * 0.1;
    float CosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float SinTheta = sqrt(1.0 - CosTheta * CosTheta);
    vec3 H;
    H.x = SinTheta * cos(Phi);
    H.y = SinTheta * sin(Phi);
    H.z = CosTheta;

    //Tangent space vectors
    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 TangentX = normalize(cross(UpVector, N));
    vec3 TangentY = normalize(cross(N, TangentX));

    //Tangent to World Space
    return normalize(TangentX * H.x + TangentY * H.y + N * H.z);
    //vec3 n = N;
    //float a = 1.0 / (1.0 + n.z);
    //float b = -n.x * n.y * a;
    //vec3 b1 = vec3(1.0 - n.x * n.x * a, b, -n.x);
    //vec3 b2 = vec3(b, 1.0 - n.y * n.y * a, -n.y);
    //mat3 vecSpace = mat3(b1, b2, n);
    //return normalize(vecSpace * H);
    //return normalize(N);
}

void main() {
    vec3 N = wcNormal;

    const int NumSamples = 512;

    vec3 color = vec3(0.0);
    float weight = 0.0;
    for(int i=0; i<NumSamples; i++) {
        vec2 Xi = hammersley(i, NumSamples);
        vec3 L = hemisphereSample(Xi, N);
        float dotNL = max(0.0, dot(N, L));
        color += dotNL * textureCube(uEnvMap, L).rgb;
        weight += dotNL;
    }
    gl_FragColor.rgb = color / weight;
    gl_FragColor.a = 1.0;
}
