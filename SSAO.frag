#ifdef GL_ES
precision highp float;
#endif

#define PI    3.14159265

varying vec2 vTexCoord;

uniform sampler2D depthMap;
uniform sampler2D normalMap;
uniform sampler2D kernelMap;
uniform sampler2D noiseMap;
uniform vec2 textureSize;
uniform float near;
uniform float far;
uniform float aspectRatio;
uniform float fov;
uniform mat4 uProjectionMatrix;
uniform float radius;

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float readDepth(vec2 coord) {
  float z_b = texture2D(depthMap, coord).r;
  float z_n = 2.0 * z_b - 1.0;
  float z_e = 2.0 * near * far / (far + near - z_n * (far - near));
  return z_e;
}

vec3 getFarViewDir(vec2 tc) {
  float hfar = 2.0 * tan(fov/2.0/180.0 * PI) * far;
  float wfar = hfar * aspectRatio;
  vec3 dir = (vec3(wfar * (tc.x - 0.5), hfar * (tc.y - 0.5), -far));
  return dir;
}

vec3 getViewRay(vec2 tc) {
  vec3 ray = normalize(getFarViewDir(tc));
  return ray;
}


//asumming z comes from depth buffer (ndc coords) and it's not a linear distance from the camera but
//perpendicular to the near/far clipping planes
//http://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/
//assumes z = eye space z
vec3 reconstructPositionFromDepth(vec2 texCoord, float z) {
  vec3 ray = getFarViewDir(texCoord);
  vec3 pos = ray;
  return pos * z / far;
}

void main() {
  vec2 texCoord = vec2(gl_FragCoord.x / textureSize.x, gl_FragCoord.y / textureSize.y);
  float depth = readDepth(texCoord);

  if (depth >= far * 0.99) {
      gl_FragColor = vec4(1.0);
      return;
  }

  vec3 fragPos = reconstructPositionFromDepth(texCoord, depth);

  vec2 noiseScale = vec2(textureSize.x/4.0, textureSize.y/4.0); // screen = 800x600

  //TODO: vec3 fragPos = texture(gPositionDepth, TexCoords).xyz;
  vec3 normal = normalize(texture2D(normalMap, texCoord).rgb * 2.0 - vec3(1.0));
  vec3 randomVec = texture2D(noiseMap, texCoord * noiseScale).xyz;
  vec3 dirVec = texture2D(kernelMap, texCoord * noiseScale).xyz;

  vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
  vec3 bitangent = cross(normal, tangent);
  mat3 TBN = mat3(tangent, bitangent, normal);

  float occlusion = 0.0;
  const float kernelWidth = 5.0; //8.0
  const int kernelSize = 25; //64
  vec3 lastSample = vec3(0.0);
  for(int i = 0; i < kernelSize; ++i) {
    vec2 tc = vec2(mod(float(i), kernelWidth) / kernelWidth + 0.5/kernelWidth, floor(float(i) / kernelWidth) / kernelWidth + 0.5/kernelWidth);
    // get sample position
    vec3 sample = TBN * texture2D(kernelMap, tc).rgb; // From tangent to view-space
    sample = fragPos + sample * radius;
    vec4 offset = vec4(sample, 1.0);
    offset = uProjectionMatrix * offset; // from view to clip-space
    offset.xyz /= offset.w; // perspective divide
    offset.xyz = offset.xyz * 0.5 + 0.5; // transform to range 0.0 - 1.0

    float sampleDepth = -readDepth(offset.xy);
    //removes outline halos
    float rangeCheck = smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth));
    occlusion += ((sampleDepth <= sample.z) ? 0.0 : 1.0) * rangeCheck;
  }

  occlusion = 1.0 - (occlusion / float(kernelSize));

  gl_FragColor = vec4(occlusion, occlusion, occlusion, 1.0);

  //gl_FragColor.rgb = normal;
}
