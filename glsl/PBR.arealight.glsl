
const vec2  resolution = vec2(1280.0, 720.0);


const int   sampleCount = 4;

const int   NUM_SAMPLES = 8;
const float LUT_SIZE  = 64.0;
const float LUT_SCALE = (LUT_SIZE - 1.0)/LUT_SIZE;
const float LUT_BIAS  = 0.5/LUT_SIZE;
const float pi = 3.14159265;

// Tracing and intersection
///////////////////////////
///
///
struct Ray
{
    vec3 origin;
    vec3 dir;
};

struct Rect
{
    vec3  origin;
    vec4  plane;
    float sizex;
    float sizey;
};

bool RayPlaneIntersect(Ray ray, vec4 plane, out float t)
{
    t = -dot(plane, vec4(ray.origin, 1.0))/dot(plane.xyz, ray.dir);
    return t > 0.0;
}

bool RayRectIntersect(Ray ray, Rect rect, out float t)
{
    bool intersect = RayPlaneIntersect(ray, rect.plane, t);
    if (intersect)
    {
        vec3 pos = ray.origin + ray.dir*t;
        vec3 lpos = pos - rect.origin;
        if (abs(lpos.x) > rect.sizex || abs(lpos.y) > rect.sizey)
            intersect = false;
    }

    return intersect;
}

// Adapted from:
// https://www.shadertoy.com/view/4djSRW
float hash(float x, float y)
{
    vec2 p = vec2(x, y);
    p  = fract(p * vec2(443.8975, 397.2973));
    p += dot(p.xy, p.yx + 19.19);
    return fract(p.x + p.y);
}

//TODO: which coordinate space?
Ray GenerateCameraRay(float u1, float u2)
{
    Ray ray;

    // Random jitter within pixel for AA, huh? what jitter
    vec2 xy = 2.0*(gl_FragCoord.xy)/resolution - vec2(1.0);

    ray.dir = normalize(vec3(xy, 2.0));

    float focalDistance = 2.0;
    float ft = focalDistance/ray.dir.z;
    vec3 pFocus = ray.dir*ft;

    ray.origin = vec3(0);
    ray.dir    = normalize(pFocus - ray.origin);

    // Apply camera transform
    ray.origin = (view*vec4(ray.origin, 1)).xyz;
    ray.dir    = (view*vec4(ray.dir,    0)).xyz;

    return ray;
}

vec3 mul(mat3 m, vec3 v)
{
    return m * v;
}

mat3 mul(mat3 m1, mat3 m2)
{
    return m1 * m2;
}

int modi(int x, int y)
{
    return int(mod(float(x), float(y)));
}

mat3 transpose(mat3 v)
{
    mat3 tmp;
    tmp[0] = vec3(v[0].x, v[1].x, v[2].x);
    tmp[1] = vec3(v[0].y, v[1].y, v[2].y);
    tmp[2] = vec3(v[0].z, v[1].z, v[2].z);

    return tmp;
}


struct SphQuad
{
    vec3 o, x, y, z;
    float z0, z0sq;
    float x0, y0, y0sq;
    float x1, y1, y1sq;
    float b0, b1, b0sq, k;
    float S;
};

SphQuad SphQuadInit(vec3 s, vec3 ex, vec3 ey, vec3 o)
{
    SphQuad squad;

    squad.o = o;
    float exl = length(ex);
    float eyl = length(ey);

    // compute local reference system ’R’
    squad.x = ex / exl;
    squad.y = ey / eyl;
    squad.z = cross(squad.x, squad.y);

    // compute rectangle coords in local reference system
    vec3 d = s - o;
    squad.z0 = dot(d, squad.z);

    // flip ’z’ to make it point against ’Q’
    if (squad.z0 > 0.0)
    {
        squad.z  *= -1.0;
        squad.z0 *= -1.0;
    }

    squad.z0sq = squad.z0 * squad.z0;
    squad.x0 = dot(d, squad.x);
    squad.y0 = dot(d, squad.y);
    squad.x1 = squad.x0 + exl;
    squad.y1 = squad.y0 + eyl;
    squad.y0sq = squad.y0 * squad.y0;
    squad.y1sq = squad.y1 * squad.y1;

    // create vectors to four vertices
    vec3 v00 = vec3(squad.x0, squad.y0, squad.z0);
    vec3 v01 = vec3(squad.x0, squad.y1, squad.z0);
    vec3 v10 = vec3(squad.x1, squad.y0, squad.z0);
    vec3 v11 = vec3(squad.x1, squad.y1, squad.z0);

    // compute normals to edges
    vec3 n0 = normalize(cross(v00, v10));
    vec3 n1 = normalize(cross(v10, v11));
    vec3 n2 = normalize(cross(v11, v01));
    vec3 n3 = normalize(cross(v01, v00));

    // compute internal angles (gamma_i)
    float g0 = acos(-dot(n0, n1));
    float g1 = acos(-dot(n1, n2));
    float g2 = acos(-dot(n2, n3));
    float g3 = acos(-dot(n3, n0));

    // compute predefined constants
    squad.b0 = n0.z;
    squad.b1 = n2.z;
    squad.b0sq = squad.b0 * squad.b0;
    squad.k = 2.0*pi - g2 - g3;

    // compute solid angle from internal angles
    squad.S = g0 + g1 - squad.k;

    return squad;
}

vec3 SphQuadSample(SphQuad squad, float u, float v)
{
    // 1. compute 'cu'
    float au = u * squad.S + squad.k;
    float fu = (cos(au) * squad.b0 - squad.b1) / sin(au);
    float cu = 1.0 / sqrt(fu*fu + squad.b0sq) * (fu > 0.0 ? 1.0 : -1.0);
    cu = clamp(cu, -1.0, 1.0); // avoid NaNs

    // 2. compute 'xu'
    float xu = -(cu * squad.z0) / sqrt(1.0 - cu * cu);
    xu = clamp(xu, squad.x0, squad.x1); // avoid Infs

    // 3. compute 'yv'
    float d = sqrt(xu * xu + squad.z0sq);
    float h0 = squad.y0 / sqrt(d*d + squad.y0sq);
    float h1 = squad.y1 / sqrt(d*d + squad.y1sq);
    float hv = h0 + v * (h1 - h0), hv2 = hv * hv;
    float yv = (hv2 < 1.0 - 1e-6) ? (hv * d) / sqrt(1.0 - hv2) : squad.y1;

    // 4. transform (xu, yv, z0) to world coords
    return squad.o + xu*squad.x + yv*squad.y + squad.z0*squad.z;
}

// Sample generation
////////////////////

float Halton(int index, float base)
{
    float result = 0.0;
    float f = 1.0/base;
    float i = float(index);
    for (int x = 0; x < 8; x++)
    {
        if (i <= 0.0) break;

        result += f*mod(i, base);
        i = floor(i/base);
        f = f/base;
    }

    return result;
}

void Halton2D(out vec2 s[NUM_SAMPLES], int offset)
{
    for (int i = 0; i < NUM_SAMPLES; i++)
    {
        s[i].x = Halton(i + offset, 2.0);
        s[i].y = Halton(i + offset, 3.0);
    }
}

// Linearly Transformed Cosines
///////////////////////////////

float IntegrateEdge(vec3 v1, vec3 v2)
{
    float cosTheta = dot(v1, v2);
    cosTheta = clamp(cosTheta, -0.9999, 0.9999);

    float theta = acos(cosTheta);
    float res = cross(v1, v2).z * theta / sin(theta);

    return res;
}

void ClipQuadToHorizon(inout vec3 L[5], out int n)
{
    // detect clipping config
    int config = 0;
    if (L[0].z > 0.0) config += 1;
    if (L[1].z > 0.0) config += 2;
    if (L[2].z > 0.0) config += 4;
    if (L[3].z > 0.0) config += 8;

    // clip
    n = 0;

    if (config == 0)
    {
        // clip all
    }
    else if (config == 1) // V1 clip V2 V3 V4
    {
        n = 3;
        L[1] = -L[1].z * L[0] + L[0].z * L[1];
        L[2] = -L[3].z * L[0] + L[0].z * L[3];
    }
    else if (config == 2) // V2 clip V1 V3 V4
    {
        n = 3;
        L[0] = -L[0].z * L[1] + L[1].z * L[0];
        L[2] = -L[2].z * L[1] + L[1].z * L[2];
    }
    else if (config == 3) // V1 V2 clip V3 V4
    {
        n = 4;
        L[2] = -L[2].z * L[1] + L[1].z * L[2];
        L[3] = -L[3].z * L[0] + L[0].z * L[3];
    }
    else if (config == 4) // V3 clip V1 V2 V4
    {
        n = 3;
        L[0] = -L[3].z * L[2] + L[2].z * L[3];
        L[1] = -L[1].z * L[2] + L[2].z * L[1];
    }
    else if (config == 5) // V1 V3 clip V2 V4) impossible
    {
        n = 0;
    }
    else if (config == 6) // V2 V3 clip V1 V4
    {
        n = 4;
        L[0] = -L[0].z * L[1] + L[1].z * L[0];
        L[3] = -L[3].z * L[2] + L[2].z * L[3];
    }
    else if (config == 7) // V1 V2 V3 clip V4
    {
        n = 5;
        L[4] = -L[3].z * L[0] + L[0].z * L[3];
        L[3] = -L[3].z * L[2] + L[2].z * L[3];
    }
    else if (config == 8) // V4 clip V1 V2 V3
    {
        n = 3;
        L[0] = -L[0].z * L[3] + L[3].z * L[0];
        L[1] = -L[2].z * L[3] + L[3].z * L[2];
        L[2] =  L[3];
    }
    else if (config == 9) // V1 V4 clip V2 V3
    {
        n = 4;
        L[1] = -L[1].z * L[0] + L[0].z * L[1];
        L[2] = -L[2].z * L[3] + L[3].z * L[2];
    }
    else if (config == 10) // V2 V4 clip V1 V3) impossible
    {
        n = 0;
    }
    else if (config == 11) // V1 V2 V4 clip V3
    {
        n = 5;
        L[4] = L[3];
        L[3] = -L[2].z * L[3] + L[3].z * L[2];
        L[2] = -L[2].z * L[1] + L[1].z * L[2];
    }
    else if (config == 12) // V3 V4 clip V1 V2
    {
        n = 4;
        L[1] = -L[1].z * L[2] + L[2].z * L[1];
        L[0] = -L[0].z * L[3] + L[3].z * L[0];
    }
    else if (config == 13) // V1 V3 V4 clip V2
    {
        n = 5;
        L[4] = L[3];
        L[3] = L[2];
        L[2] = -L[1].z * L[2] + L[2].z * L[1];
        L[1] = -L[1].z * L[0] + L[0].z * L[1];
    }
    else if (config == 14) // V2 V3 V4 clip V1
    {
        n = 5;
        L[4] = -L[0].z * L[3] + L[3].z * L[0];
        L[0] = -L[0].z * L[1] + L[1].z * L[0];
    }
    else if (config == 15) // V1 V2 V3 V4
    {
        n = 4;
    }

    if (n == 3)
        L[3] = L[0];
    if (n == 4)
        L[4] = L[0];
}

vec3 LTC_Evaluate(
    vec3 N, vec3 V, vec3 P, mat3 Minv, vec3 points[4], bool twoSided)
{
    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize(V - N*dot(V, N));
    T2 = cross(N, T1);

    // rotate area light in (T1, T2, R) basis
    Minv = Minv * transpose(mat3(T1, T2, N));

    // polygon (allocate 5 vertices for clipping)
    vec3 L[5];
    L[0] = Minv * (points[0] - P);
    L[1] = Minv * (points[1] - P);
    L[2] = Minv * (points[2] - P);
    L[3] = Minv * (points[3] - P);

    int n;
    ClipQuadToHorizon(L, n);

    if (n == 0)
        return vec3(0, 0, 0);

    // project onto sphere
    L[0] = normalize(L[0]);
    L[1] = normalize(L[1]);
    L[2] = normalize(L[2]);
    L[3] = normalize(L[3]);
    L[4] = normalize(L[4]);

    // integrate
    float sum = 0.0;

    sum += IntegrateEdge(L[0], L[1]);
    sum += IntegrateEdge(L[1], L[2]);
    sum += IntegrateEdge(L[2], L[3]);
    if (n >= 4)
        sum += IntegrateEdge(L[3], L[4]);
    if (n == 5)
        sum += IntegrateEdge(L[4], L[0]);

    sum = twoSided ? abs(sum) : max(0.0, -sum);

    vec3 Lo_i = vec3(sum, sum, sum);

    return Lo_i;
}

// Misc. helpers
////////////////

vec3 PowVec3(vec3 v, float p)
{
    return vec3(pow(v.x, p), pow(v.y, p), pow(v.z, p));
}

vec3 check(bool test) {
    if (test) return vec3(0,1,0);
    else return vec3(1,0.2,0);
}

vec3 multQuat(vec3 a, vec4 q){
    float x = a.x;
    float y = a.y;
    float z = a.z;

    float qx = q.x;
    float qy = q.y;
    float qz = q.z;
    float qw = q.w;

    float ix =  qw * x + qy * z - qz * y;
    float iy =  qw * y + qz * x - qx * z;
    float iz =  qw * z + qx * y - qy * x;
    float iw = -qx * x - qy * y - qz * z;

    a.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    a.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    a.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;

    return a;
}

vec3 evalAreaLight(AreaLight light, vec3 posWorld, vec3 normalWorld, vec3 diffuseColor, vec3 specularColor, float roughness)
{
    vec2 seq[NUM_SAMPLES];
    Halton2D(seq, sampleCount);

    vec3 col = vec3(0);

    // Scene info

    vec3 lcol = light.color.rgb * light.intensity;
    vec3 dcol = diffuseColor;
    vec3 scol = specularColor;
    {
        Ray ray;
        ray.origin = uCameraPosition;
        ray.dir = normalize(posWorld - uCameraPosition);
        {
            vec3 pos = posWorld;

            vec3 N = normalWorld;
            vec3 V = -ray.dir;

            //FIXME: why this has to be -1?
            vec3 ex = multQuat(vec3(-1, 0, 0), light.rotation)*light.size.x;
            vec3 ey = multQuat(vec3(0, 1, 0), light.rotation)*light.size.y;

            vec3 p1 = light.position - ex + ey;
            vec3 p2 = light.position + ex + ey;
            vec3 p3 = light.position + ex - ey;
            vec3 p4 = light.position - ex - ey;

            vec3 points[4];
            points[0] = p1;
            points[1] = p2;
            points[2] = p3;
            points[3] = p4;

            float theta = acos(dot(N, V));
            vec2 uv = vec2(roughness, theta/(0.5*pi));
            uv = uv*LUT_SCALE + LUT_BIAS;

            vec4 t = texture2D(ltc_mat, uv);
            mat3 Minv = mat3(
                vec3(  1,   0, t.y),
                vec3(  0, t.z,   0),
                vec3(t.w,   0, t.x)
            );

            vec3 spec = lcol*scol*LTC_Evaluate(N, V, pos, Minv, points, false);
            spec *= texture2D(ltc_mag, uv).w;

            vec3 diff = lcol*dcol*LTC_Evaluate(N, V, pos, mat3(1), points, false);

            col  = spec + diff;
            col /= 2.0*pi;
        }

        //TODO: how to find out we had hit the screen?
        //float distToRect;
        //if (RayRectIntersect(ray, rect, distToRect))
        //    if ((distToRect < distToFloor) || !hitFloor)
        //        col = lcol;
    }

    return col;
}

#pragma glslify: export(evalAreaLight)
