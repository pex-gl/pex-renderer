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

export const es300Vertex = (shader) => /* glsl */ `#version 300 es
#define attribute in
#define varying out
${shader}`;

export const es300Fragment = (shader, size = 1) => /* glsl */ `#version 300 es
precision highp float;
#define varying in
#define texture2D texture
#define textureCube texture
#define gl_FragData FragData
#define gl_FragColor gl_FragData[0]
out vec4 FragData[${size}];
${shader}`;
