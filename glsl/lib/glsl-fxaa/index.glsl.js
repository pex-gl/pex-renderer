const fxaa_calc = require('./fxaa.glsl.js')
const texcoords = require('./texcoords.glsl.js')

module.exports = `
${fxaa_calc}
${texcoords}

vec4 fxaa(sampler2D tex, vec2 fragCoord, vec2 resolution) {
	mediump vec2 v_rgbNW;
	mediump vec2 v_rgbNE;
	mediump vec2 v_rgbSW;
	mediump vec2 v_rgbSE;
	mediump vec2 v_rgbM;

	//compute the texture coords
	texcoords(fragCoord, resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);

	//compute FXAA
	return fxaa_calc(tex, fragCoord, resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);
}
`
