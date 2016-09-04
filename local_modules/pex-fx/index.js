var FXStage = require('./FXStage');
require('./Render');
require('./Blit');
require('./Add');
require('./Blur3');
require('./Blur5');
require('./Blur');
require('./Downsample2');
require('./Downsample4');
require('./Image');
require('./FXAA');
require('./CorrectGamma');
//require('./TonemapReinhard');
//require('./Save');
require('./Mult');
require('./SSAO');
require('./RenderWrap');
require('./Unpremultiply');

//
//var globalFx;
//
//module.exports = function() {
//  if (!globalFx) {
//    globalFx = new FXStage();
//  }
//  globalFx.reset();
//  return globalFx;
//};

module.exports = function (regl) {
  return new FXStage(regl)
}

module.exports.FXStage = FXStage
