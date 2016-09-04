var FXStage = require('./FXStage');

FXStage.prototype.image = function (src) {
    return this.asFXStage(src, 'image');
}

module.exports = FXStage;
