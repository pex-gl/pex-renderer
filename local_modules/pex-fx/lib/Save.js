var geom  = require('pex-geom');
var glu  = require('pex-glu');
var FXStage = require('./FXStage');
var fs = require('fs');

var SaveGLSL = fs.readFileSync(__dirname + '/Save.glsl', 'utf8');

var pad = function(num, char, len) {
  var s = '' + num;
  while (s.length < len) {
    s = char + s;
  }
  return s;
}

FXStage.prototype.save = function (path, options) {
  path = path || '.'
  options = options || {};

  var outputSize = this.getOutputSize(options.width, options.height);
  var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
  rt.bind();
  this.getSourceTexture().bind(0);
  var program = this.getShader(SaveGLSL);
  program.use();
  program.uniforms.tex0(0);

  var oldViewport = this.gl.getParameter(this.gl.VIEWPORT);
  glu.viewport(0, 0, outputSize.width, outputSize.height, false);

  this.drawFullScreenQuad(outputSize.width, outputSize.height, null, program);

  var d = new Date();
  var filename = path + "/screenshot_"
  filename += d.getFullYear() + '-' + pad(d.getMonth()+1,'0',2) + '-' + pad(d.getDate(),'0',2);
  filename += '_' + pad(d.getHours(),'0',2) + ':' + pad(d.getMinutes(),'0',2) + ':' + pad(d.getSeconds(),'0',2) + '.png'
  this.gl.writeImage('png', filename);
  console.log('Saved', filename);

  glu.viewport(oldViewport[0], oldViewport[1], oldViewport[2], oldViewport[3], false);

  rt.unbind();

  return this.asFXStage(rt, 'save');
};

module.exports = FXStage;