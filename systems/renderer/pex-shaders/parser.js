export default {
  parse(ctx, src, { stage = "vertex", extensions, defines } = {}) {
    const patch = stage === "vertex" ? this.patchVS : this.patchFS;

    return patch(
      ctx,
      `${this.formatExtensions(extensions)}
${this.formatDefines(defines)}
${src}`
    );
  },

  patchVS(ctx, s) {
    if (!ctx.capabilities.isWebGL2) return s;
    s = "#version 300 es\n" + s;
    // TODO: why not just '#define attribute in',
    s = s.replace(/attribute/g, "in");
    s = s.replace(/varying/g, "out");
    s = s.replace(/texture2D/g, "texture");
    s = s.replace(/textureCube/g, "texture");
    s = s.replace("mat4 transpose(mat4 m) {", "mat4 transposeOld(mat4 m) {");
    s = s.replace("mat3 transpose(mat3 m) {", "mat3 transposeOld(mat3 m) {");
    s = s.replace("mat4 inverse(mat4 m) {", "mat4 inverseOld(mat4 m) {");
    return s;
  },

  patchFS(ctx, s) {
    if (!ctx.capabilities.isWebGL2) return s;
    s = "#version 300 es\n" + s;
    s = s.replace(/texture2D/g, "texture");
    s = s.replace(/textureCube/g, "texture");
    s = s.replace(/textureLodEXT/g, "textureLod");
    s = s.replace("mat4 transpose(mat4 m) {", "mat4 transposeOld(mat4 m) {");
    s = s.replace("mat3 transpose(mat3 m) {", "mat3 transposeOld(mat3 m) {");
    s = s.replace("mat4 inverse(mat4 m) {", "mat4 inverseOld(mat4 m) {");
    s = s.replace("#extension GL_OES_standard_derivatives : require", "");
    s = s.replace("#extension GL_EXT_shader_texture_lod : require", "");
    s = s.replace("#extension GL_EXT_draw_buffers : enable", "");
    s = s.replace("precision mediump float", "precision highp float");
    s = s.replace(
      /precision highp float;/,
      `precision highp float;
layout (location = 0) out vec4 outColor;
layout (location = 1) out vec4 outEmissiveColor;
layout (location = 2) out vec4 outNormal;
      `
    );
    s = s.replace(/varying/g, "in");
    s = s.replace(/gl_FragData\[0\]/g, "outColor");
    s = s.replace(/gl_FragColor/g, "outColor");
    s = s.replace(/gl_FragData\[1\]/g, "outEmissiveColor");
    s = s.replace(/gl_FragData\[2\]/g, "outNormal");
    return s;
  },

  formatExtensions(extensions = {}) {
    return Object.entries(extensions)
      .map(([name, behavior]) => `#extension ${name} : ${behavior}`)
      .join("\n");
  },

  formatDefines(defines = []) {
    return defines.map((flag) => `#define ${flag}`).join("\n");
  },

  replaceStrings(string, options) {
    // Unroll loop
    const unrollLoopPattern =
      /#pragma unroll_loop[\s]+?for \(int i = (\d+); i < (\d+|\D+); i\+\+\) \{([\s\S]+?)(?=\})\}/g;

    string = string.replace(unrollLoopPattern, (match, start, end, snippet) => {
      let unroll = "";

      // Replace lights number
      end = end
        .replace(/NUM_AMBIENT_LIGHTS/g, options.ambientLights.length || 0)
        .replace(
          /NUM_DIRECTIONAL_LIGHTS/g,
          options.directionalLights.length || 0
        )
        .replace(/NUM_POINT_LIGHTS/g, options.pointLights.length || 0)
        .replace(/NUM_SPOT_LIGHTS/g, options.spotLights.length || 0)
        .replace(/NUM_AREA_LIGHTS/g, options.areaLights.length || 0);

      for (let i = Number.parseInt(start); i < Number.parseInt(end); i++) {
        unroll += snippet.replace(/\[i\]/g, `[${i}]`);
      }

      return unroll;
    });

    return string;
  },

  getFormattedError(error, { vert, frag, count = 5 }) {
    const lines = (error.message.match(/Vertex/) ? vert : frag).split("\n");
    const lineNo = parseInt(error.message.match(/ERROR: ([\d]+):([\d]+)/)[2]);
    const startIndex = Math.max(lineNo - count, 0);
    return lines
      .slice(startIndex, Math.min(lineNo + count, lines.length - 1))
      .map((line, i) =>
        startIndex + i == lineNo - 1 ? `--> ${line}` : `    ${line}`
      )
      .join("\n");
  },
};
