var FXStage = require('./FXStage');

FXStage.prototype.blit = function (options) {
  options = options || {};
  var outputSize = this.getOutputSize(options.width, options.height);
  var x = options.x || 0;
  var y = options.y || 0;
  this.drawFullScreenQuadAt(x, y, outputSize.width, outputSize.height, this.getSourceTexture());
  return this;
};

module.exports = FXStage;