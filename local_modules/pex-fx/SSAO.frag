#ifdef GL_ES
precision highp float;
#endif

#define PI    3.14159265

varying vec2 vTexCoord;

uniform sampler2D depthMap;
uniform vec2 textureSize;
uniform float near;
uniform float far;

const int samples = 3;
const int rings = 5;

uniform float strength;
uniform float offset;

vec2 rand(vec2 coord) {
  float noiseX = (fract(sin(dot(coord, vec2(12.9898,78.233))) * 43758.5453));
  float noiseY = (fract(sin(dot(coord, vec2(12.9898,78.233) * 2.0)) * 43758.5453));
  return vec2(noiseX,noiseY) * 0.004;
}

float compareDepths( in float depth1, in float depth2 )
{
  float depthTolerance = far / 5.0;
  float occlusionTolerance = far / 100.0;
  float diff = (depth1 - depth2);

  if (diff <= 0.0) return 0.0;
  if (diff > depthTolerance) return 0.0;
  if (diff < occlusionTolerance) return 0.0;

  return 1.0;
}

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float readDepth(vec2 coord) {
  float z_b = texture2D(depthMap, coord).r;
  float z_n = 2.0 * z_b - 1.0;
  float z_e = 2.0 * near * far / (far + near - z_n * (far - near));
  return z_e;
}

void main() {
  vec2 texCoord = vec2(gl_FragCoord.x / textureSize.x, gl_FragCoord.y / textureSize.y);
  float depth = readDepth(texCoord);
  float z_b = texture2D(depthMap, texCoord).r;

  float d;

  float aspect = textureSize.x / textureSize.y;
  vec2 noise = rand(vTexCoord);

  float w = (1.0 / textureSize.x)/clamp(z_b,0.1,1.0)+(noise.x*(1.0-noise.x));
  float h = (1.0 / textureSize.y)/clamp(z_b,0.1,1.0)+(noise.y*(1.0-noise.y));

  float pw;
  float ph;

  float ao = 0.0;
  float s = 0.0;
  float fade = 4.0;

  for (int i = 0 ; i < rings; i += 1)
  {
    fade *= 0.5;
    for (int j = 0 ; j < samples*rings; j += 1)
    {
      if (j >= samples*i) break;
      float step = PI * 2.0 / (float(samples) * float(i));
      float r = 4.0 * float(i);
      pw = r * (cos(float(j)*step));
      ph = r * (sin(float(j)*step)) * aspect;
      d = readDepth( vec2(texCoord.s + pw * w,texCoord.t + ph * h));
      ao += compareDepths(depth, d) * fade;
      s += 1.0 * fade;
    }
  }

  ao /= s;
  ao = clamp(ao, 0.0, 1.0);
  ao = 1.0 - ao;
  ao = offset + (1.0 - offset) * ao;
  ao = pow(ao, strength);

  gl_FragColor = vec4(ao, ao, ao, 1.0);
}
