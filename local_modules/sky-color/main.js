var cameraPos = [0.0, 0.0, 0.0];

var luminance = 1.0;
var turbidity = 10.0;
var reileigh = 2.0;
var mieCoefficient = 0.005;
var mieDirectionalG = 0.8;

var reileighCoefficient = reileigh;

// constants for atmospheric scattering
var e = 2.71828182845904523536028747135266249775724709369995957;
var pi = 3.141592653589793238462643383279502884197169;

var n = 1.0003; // refractive index of air
var N = 2.545E25; // number of molecules per unit volume for air at
// 288.15K and 1013mb (sea level -45 celsius)
var pn = 0.035; // depolatization factor for standard air

// wavelength of used primaries, according to preetham
var lambda = [680E-9, 550E-9, 450E-9];

// mie stuff
// K coefficient for the primaries
var K = [0.686, 0.678, 0.666];
var v = 4.0;

// optical length at zenith for molecules
var rayleighZenithLength = 8.4E3;
var mieZenithLength = 1.25E3;
var up = [0.0, 1.0, 0.0];

var EE = 1000.0;
var sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;
// 66 arc seconds -> degrees, and the cosine of that

// earth shadow hack
var cutoffAngle = pi/1.95;
var steepness = 1.5;

//returns vec3
function totalRayleigh(lambda) {
    return [
        (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda[0], 4.0) * (6.0 - 7.0 * pn)),
        (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda[1], 4.0) * (6.0 - 7.0 * pn)),
        (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda[2], 4.0) * (6.0 - 7.0 * pn))
    ]
}

function rayleighPhase(cosTheta) {
    return (3.0 / (16.0*pi)) * (1.0 + pow(cosTheta, 2.0));
    // return (1.0 / (3.0*pi)) * (1.0 + pow(cosTheta, 2.0));
    // return (3.0 / 4.0) * (1.0 + pow(cosTheta, 2.0));
}

function totalMie(lambda, K, T) {
    var c = (0.2 * T ) * 10E-18;
    return [
        0.434 * c * pi * pow((2.0 * pi) / lambda[0], v - 2.0) * K[0],
        0.434 * c * pi * pow((2.0 * pi) / lambda[1], v - 2.0) * K[1],
        0.434 * c * pi * pow((2.0 * pi) / lambda[2], v - 2.0) * K[2];
    ]
}

function hgPhase(cosTheta, g) {
    return (1.0 / (4.0*pi)) * ((1.0 - pow(g, 2.0)) / pow(1.0 - 2.0*g*cosTheta + pow(g, 2.0), 1.5));
}

function sunIntensity(zenithAngleCos) {
    return EE * max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithAngleCos))/steepness)));
}

// float logLuminance(vec3 c)
// {
// return log(c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722);
// }

// Filmic ToneMapping http://filmicgames.com/archives/75
float A = 0.15;
float B = 0.50;
float C = 0.10;
float D = 0.20;
float E = 0.02;
float F = 0.30;
float W = 1000.0;

vec3 Uncharted2Tonemap(vec3 x)
{
    return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}


vec3 sky(vec3 sunPosition, vec3 worldNormal) {
    vec3 sunDirection = normalize(sunPosition);
    float sunfade = 1.0-clamp(1.0-exp((sunPosition.y/450000.0)),0.0,1.0);

    // luminance = 1.0 ;// vWorldPosition.y / 450000. + 0.5; //sunPosition.y / 450000. * 1. + 0.5;

    // gl_FragColor = vec4(sunfade, sunfade, sunfade, 1.0);

    reileighCoefficient = reileighCoefficient - (1.0* (1.0-sunfade));

    float sunE = sunIntensity(dot(sunDirection, up));

    // extinction (absorbtion + out scattering)
    // rayleigh coefficients
    vec3 betaR = totalRayleigh(lambda) * reileighCoefficient;

    // mie coefficients
    vec3 betaM = totalMie(lambda, K, turbidity) * mieCoefficient;

    // optical length
    // cutoff angle at 90 to avoid singularity in next formula.
    //float zenithAngle = acos(max(0.0, dot(up, normalize(vWorldPosition - cameraPos))));
    float zenithAngle = acos(max(0.0, dot(up, normalize(worldNormal))));
    float sR = rayleighZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));
    float sM = mieZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));



    // combined extinction factor
    vec3 Fex = exp(-(betaR * sR + betaM * sM));

    // in scattering
    float cosTheta = dot(normalize(worldNormal), sunDirection);

    float rPhase = rayleighPhase(cosTheta*0.5+0.5);
    vec3 betaRTheta = betaR * rPhase;

    float mPhase = hgPhase(cosTheta, mieDirectionalG);
    vec3 betaMTheta = betaM * mPhase;


    vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex),vec3(1.5));
    Lin *= mix(vec3(1.0),pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex,vec3(1.0/2.0)),clamp(pow(1.0-dot(up, sunDirection),5.0),0.0,1.0));

    //nightsky
    vec3 direction = normalize(worldNormal);
    float theta = acos(direction.y); // elevation --> y-axis, [-pi/2, pi/2]
    float phi = atan(direction.z, direction.x); // azimuth --> x-axis [-pi/2, pi/2]
    vec2 uv = vec2(phi, theta) / vec2(2.0*pi, pi) + vec2(0.5, 0.0);
    // vec3 L0 = texture2D(skySampler, uv).rgb+0.1 * Fex;
    vec3 L0 = vec3(0.1) * Fex;

    // composition + solar disc
    //if (cosTheta > sunAngularDiameterCos)
    float sundisk = smoothstep(sunAngularDiameterCos,sunAngularDiameterCos+0.00002,cosTheta);
    // if (normalize(vWorldPosition - cameraPos).y>0.0)
    L0 += (sunE * 19000.0 * Fex)*sundisk;


    vec3 whiteScale = 1.0/Uncharted2Tonemap(vec3(W));

    vec3 texColor = (Lin+L0);
    texColor *= 0.04 ;
    texColor += vec3(0.0,0.001,0.0025)*0.3;

    float g_fMaxLuminance = 1.0;
    float fLumScaled = 0.1 / luminance;
    float fLumCompressed = (fLumScaled * (1.0 + (fLumScaled / (g_fMaxLuminance * g_fMaxLuminance)))) / (1.0 + fLumScaled);

    float ExposureBias = fLumCompressed;

    vec3 curr = Uncharted2Tonemap((log2(2.0/pow(luminance,4.0)))*texColor);
    //vec3 curr = texColor;
    vec3 color = curr*whiteScale;

    vec3 retColor = pow(color,vec3(1.0/(1.2+(1.2*sunfade))));

    //VRG hack
    retColor = pow(retColor, vec3(2.2));
    return retColor;

function skyColor(sunPosition, direction) {

}

module.exports = skyColor;
