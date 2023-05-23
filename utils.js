import { quat, vec3 } from "pex-math";

export const TMP_VEC3 = vec3.create();
export const TEMP_QUAT = quat.create();

export const quad = {
  // prettier-ignore
  positions:  Float32Array.of(
    -1, -1,
    1, -1,
    1, 1,
    -1, 1,
  ),
  // prettier-ignore
  uvs: Uint16Array.of(
    0, 0,
    1, 0,
    1, 1,
    0, 1
  ),
  // prettier-ignore
  cells: Uint16Array.of(
    0, 1, 2,
    2, 3, 0
  ),
};

export const getFileExtension = (path) => {
  return (path?.match(/[^\\/]\.([^.\\/]+)$/) || [null]).pop();
};

export const getDirname = (path) => {
  var code = path.charCodeAt(0);
  var hasRoot = code === 47;
  var end = -1;
  let matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? "/" : ".";
  if (hasRoot && end === 1) return "//";
  return path.slice(0, end);
};

export const patchVS = function (s) {
  // if (!graph.ctx.capabilities.isWebGL2) return s; //TODO: pass ctx here?
  s = "#version 300 es\n" + s;
  s = s.replace(/attribute/g, "in");
  s = s.replace(/varying/g, "out");
  s = s.replace(/texture2D/g, "texture");
  s = s.replace(/textureCube/g, "texture");
  s = s.replace("mat4 transpose(mat4 m) {", "mat4 transposeOld(mat4 m) {");
  s = s.replace("mat3 transpose(mat3 m) {", "mat3 transposeOld(mat3 m) {");
  s = s.replace("mat4 inverse(mat4 m) {", "mat4 inverseOld(mat4 m) {");
  return s;
};

export const patchFS = function (s) {
  // if (!graph.ctx.capabilities.isWebGL2) return s; //TODO: pass ctx here?
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
};
