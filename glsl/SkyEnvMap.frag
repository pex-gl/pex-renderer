#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: sky = require('../local_modules/glsl-sky')
#pragma glslify: atmosphere = require(glsl-atmosphere) 

#ifndef PI
#define PI 3.141592653589793
#endif

uniform vec3 uSunPosition;

varying vec2 vTexCoord0;

void main() {
    //Texture coordinates to Normal is Based on 
    //http://gl.ict.usc.edu/Data/HighResProbes/
    // u=[0,2], v=[0,1],
    // theta=pi*(u-1), phi=pi*v
    // (Dx,Dy,Dz) = (sin(phi)*sin(theta), cos(phi), -sin(phi)*cos(theta)).

    float u = vTexCoord0.x * 2.0;
    float v = vTexCoord0.y;

    float theta = PI * (u - 1.0);
    float phi = PI * v;
    //added "-" here to conform to flipped env map orientation 
    float x = -sin(phi) * sin(theta);
    float y = cos(phi);
    //originally this z should be -sin * cos
    float z = sin(phi) * cos(theta);

    vec3 N = vec3(x,y,z);

    vec3 color = atmosphere(
        N,           // normalized ray direction 
        vec3(0,6372e3,0),               // ray origin 
        normalize(uSunPosition),                        // position of the sun 
        22.0,                           // intensity of the sun 
        6371e3,                         // radius of the planet in meters 
        6471e3,                         // radius of the atmosphere in meters 
        vec3(5.5e-6, 13.0e-6, 22.4e-6), // Rayleigh scattering coefficient 
        21e-6,                          // Mie scattering coefficient 
        28e3,                            // Rayleigh scale height 
        1.2e3,                          // Mie scale height 
        0.758                           // Mie preferred scattering direction 
   );
   
   //color = pow(color, vec3(2.2));
   //color = 1.0 - exp(-1.0 * color); 
   color = sky(uSunPosition, N);
 
   gl_FragColor.rgb = color;
   gl_FragColor.a = 1.0;
}
