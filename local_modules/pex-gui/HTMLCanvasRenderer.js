var Rect = require('pex-geom/Rect');
var rgb2hex = require('rgb-hex');

function floatRgb2Hex(rgb) {
    return rgb2hex(Math.floor(rgb[0] * 255), Math.floor(rgb[1] * 255), Math.floor(rgb[2] * 255));
}

/**
 * [HTMLCanvasRenderer description]
 * @param {[type]} ctx    [description]
 * @param {[type]} width  [description]
 * @param {[type]} height [description]
 */
function HTMLCanvasRenderer(regl, width, height, pixelRatio) {
    console.log('HTMLCanvasRenderer pixelRatio', width, height, pixelRatio)
  this._regl = regl;
  this.pixelRatio = pixelRatio || 1;
  this.canvas = document.createElement('canvas');
  //TODO: move this up
  this.tex = regl.texture({ width: width, height: height });
  this.canvas.width = width;
  this.canvas.height = height;
  this.ctx = this.canvas.getContext('2d');
  this.dirty = true;
}


/**
 * [draw description]
 * @param  {[type]} items [description]
 * @param  {[type]} scale [description]
 * @return {[type]}       [description]
 */
HTMLCanvasRenderer.prototype.draw = function (items, scale) {
  var ctx = this.ctx;
  ctx.save();
  ctx.scale(this.pixelRatio, this.pixelRatio);
  ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  ctx.font = '10px Monaco';
  var dy = 10;
  var dx = 10;
  var w = 160;

  var cellSize = 0;
  var numRows = 0;
  var margin = 3;

  for (var i = 0; i < items.length; i++) {
    var e = items[i];

    if (e.px && e.px) {
      dx = e.px / this.pixelRatio;
      dy = e.py / this.pixelRatio;
    }

    var eh = 20 * scale;
    if (e.type == 'slider') eh = 20 * scale + 14;
    if (e.type == 'toggle') eh = 20 * scale;
    if (e.type == 'multislider') eh = 20 + e.getValue().length * 14 * scale;
    if (e.type == 'color') eh = 20 + (e.options.alpha ? 4 : 3) * 14 * scale;
    if (e.type == 'color' && e.options.paletteImage) eh += (w * e.options.paletteImage.height/e.options.paletteImage.width + 2) * scale;
    if (e.type == 'button') eh = 24 * scale;
    if (e.type == 'texture2D') eh = 24 + e.texture.height * w / e.texture.width;
    if (e.type == 'textureCube') eh = 24 + w / 2;
    if (e.type == 'radiolist') eh = 18 + e.items.length * 20 * scale;
    if (e.type == 'texturelist') {
      var aspectRatio = e.items[0].texture.width / e.items[0].texture.height;
      cellSize = Math.floor((w - 2*margin) / e.itemsPerRow);
      numRows = Math.ceil(e.items.length / e.itemsPerRow);
      eh = 18 + 3 + numRows * cellSize / aspectRatio;
    }
    if (e.type == 'header') eh = 26 * scale;
    if (e.type == 'text') eh = 45 * scale;

    if (e.type != 'separator') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.56)';
      ctx.fillRect(dx, dy, w, eh - 2);
    }

    if (e.options && e.options.palette && !e.options.paletteImage) {
        function makePaletteImage(img) {
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = w * img.height / img.width;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            e.options.paletteImage = canvas;
            e.options.paletteImage.ctx = ctx;
            e.options.paletteImage.data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            e.dirty = true;
        }
        if (e.options.palette.width) {
            makePaletteImage(e.options.palette);
        }
        else {
            var img = new Image();
            img.src = e.options.palette;
            img.onload = function() {
                makePaletteImage(img);
            }
        }
    }

    if (e.type == 'slider') {
      ctx.fillStyle = 'rgba(150, 150, 150, 1)';
      ctx.fillRect(dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
      ctx.fillStyle = 'rgba(255, 255, 0, 1)';
      ctx.fillRect(dx + 3, dy + 18, (w - 3 - 3) * e.getNormalizedValue(), eh - 5 - 18);
      Rect.set4(e.activeArea, dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title + ' : ' + e.getStrValue(), dx + 4, dy + 13);
    }
    else if (e.type == 'multislider') {
      for (var j = 0; j < e.getValue().length; j++) {
        ctx.fillStyle = 'rgba(150, 150, 150, 1)';
        ctx.fillRect(dx + 3, dy + 18 + j * 14 * scale, w - 6, 14 * scale - 3);
        ctx.fillStyle = 'rgba(255, 255, 0, 1)';
        ctx.fillRect(dx + 3, dy + 18 + j * 14 * scale, (w - 6) * e.getNormalizedValue(j), 14 * scale - 3);
      }
      Rect.set4(e.activeArea, dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title + ' : ' + e.getStrValue(), dx + 4, dy + 13);
    }
    else if (e.type == 'color') {
      var numSliders = e.options.alpha ? 4 : 3;
      for (var j = 0; j < numSliders; j++) {
        ctx.fillStyle = 'rgba(150, 150, 150, 1)';
        ctx.fillRect(dx + 3, dy + 18 + j * 14 * scale, w - 6, 14 * scale - 3);
        ctx.fillStyle = 'rgba(255, 255, 0, 1)';
        ctx.fillRect(dx + 3, dy + 18 + j * 14 * scale, (w - 6) * e.getNormalizedValue(j), 14 * scale - 3);
      }
      ctx.fillStyle = '#' + floatRgb2Hex(e.contextObject[e.attributeName]);
      ctx.fillRect(dx + w - 12 - 3, dy + 3, 12, 12);
      if (e.options.paletteImage) {
        ctx.drawImage(e.options.paletteImage, dx + 3, dy + 18 + 14 * numSliders, w - 6, w * e.options.paletteImage.height/e.options.paletteImage.width);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title + ' : ' + e.getStrValue(), dx + 4, dy + 13);
      Rect.set4(e.activeArea, dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
    }
    else if (e.type == 'button') {
      ctx.fillStyle = e.active ? 'rgba(255, 255, 0, 1)' : 'rgba(150, 150, 150, 1)';
      ctx.fillRect(dx + 3, dy + 3, w - 3 - 3, eh - 5 - 3);
      Rect.set4(e.activeArea, dx + 3, dy + 3, w - 3 - 3, eh - 5 - 3);
      ctx.fillStyle = e.active ? 'rgba(100, 100, 100, 1)' : 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title, dx + 5, dy + 15);
      if (e.options.color) {
        var c = e.options.color;
        ctx.fillStyle = 'rgba(' + c[0] * 255 + ', ' + c[1] * 255 + ', ' + c[2] * 255 + ', 1)';
        ctx.fillRect(dx + w - 8, dy + 3, 5, eh - 5 - 3);
      }
    }
    else if (e.type == 'toggle') {
      var on = e.contextObject[e.attributeName];
      ctx.fillStyle = on ? 'rgba(255, 255, 0, 1)' : 'rgba(150, 150, 150, 1)';
      ctx.fillRect(dx + 3, dy + 3, eh - 5 - 3, eh - 5 - 3);
      Rect.set4(e.activeArea, dx + 3, dy + 3, eh - 5 - 3, eh - 5 - 3);
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title, dx + eh, dy + 12);
    }
    else if (e.type == 'radiolist') {
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(e.title, dx + 4, dy + 13);
      var itemHeight = 20 * scale;
      for (var j = 0; j < e.items.length; j++) {
        var item = e.items[j];
        var on = e.contextObject[e.attributeName] == item.value;
        ctx.fillStyle = on ? 'rgba(255, 255, 0, 1)' : 'rgba(150, 150, 150, 1)';
        ctx.fillRect(dx + 3, 18 + j * itemHeight + dy + 3, itemHeight - 5 - 3, itemHeight - 5 - 3);
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        ctx.fillText(item.name, dx + 5 + itemHeight - 5, 18 + j * itemHeight + dy + 13);
      }
      Rect.set4(e.activeArea, dx + 3, 18 + dy + 3, itemHeight - 5, e.items.length * itemHeight - 5);
    }
    else if (e.type == 'texturelist') {
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(e.title, dx + 4, dy + 13);
      for (var j = 0; j < e.items.length; j++) {
        var col = j % e.itemsPerRow;
        var row = Math.floor(j / e.itemsPerRow);
        var itemColor = this.controlBgPaint;
        var shrink = 0;
        if (e.items[j].value == e.contextObject[e.attributeName]) {
          ctx.fillStyle = 'none';
          ctx.strokeStyle = 'rgba(255, 255, 0, 1)';
          ctx.lineWidth = '2';
          ctx.strokeRect(dx + 3 + col * cellSize + 1, dy + 18 + row * cellSize + 1, cellSize - 1 - 2, cellSize - 1 - 2)
          ctx.lineWidth = '1';
          shrink = 2;
        }
        if (!e.items[j].activeArea) {
          e.items[j].activeArea = [[0,0], [0,0]];
        }
        Rect.set4(e.items[j].activeArea, dx + 3 + col * cellSize + shrink, dy + 18 + row * cellSize + shrink, cellSize - 1 - 2 * shrink, cellSize - 1 - 2 * shrink);
      }
      Rect.set4(e.activeArea, dx + 3, 18 + dy + 3, w - 3 - 3, cellSize * numRows - 5);
    }
    else if (e.type == 'texture2D') {
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title, dx + 5, dy + 15);
      Rect.set4(e.activeArea, dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
    }
    else if (e.type == 'textureCube') {
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title, dx + 5, dy + 15);
      Rect.set4(e.activeArea, dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
    }
    else if (e.type == 'header') {
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillRect(dx + 3, dy + 3, w - 3 - 3, eh - 5 - 3);
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.fillText(items[i].title, dx + 5, dy + 16);
    }
    else if (e.type == 'text') {
      Rect.set4(e.activeArea, dx + 3, dy + 20, w - 6, eh - 20 - 5);
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title, dx + 3, dy + 13);
      ctx.fillStyle = 'rgba(50, 50, 50, 1)';
      ctx.fillRect(dx + 3, dy + 20, e.activeArea[1][0] - e.activeArea[0][0], e.activeArea[1][1] - e.activeArea[0][1]);
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(e.contextObject[e.attributeName], dx + 3 + 3, dy + 15 + 20);
      if (e.focus) {
        ctx.strokeStyle = 'rgba(255, 255, 0, 1)';
        ctx.strokeRect(e.activeArea[0][0]-0.5, e.activeArea[0][1]-0.5, e.activeArea[1][0] - e.activeArea[0][0], e.activeArea[1][1] - e.activeArea[0][1]);
      }
    }
    else if (e.type == 'separator') {
      //do nothing
    }
    else {
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.fillText(items[i].title, dx + 5, dy + 13);
    }
    dy += eh;
  }
  ctx.restore();
  this.updateTexture();
};

/**
 * [getTexture description]
 * @return {[type]} [description]
 */
HTMLCanvasRenderer.prototype.getTexture = function () {
  return this.tex;
};

/**
 * [function description]
 * @param  {[type]} image [description]
 * @param  {[type]} x     [description]
 * @param  {[type]} y     [description]
 * @return {[type]}       [description]
 */
HTMLCanvasRenderer.prototype.getImageColor = function(image, x, y) {
  var r = image.data[(x + y * image.width)*4 + 0]/255;
  var g = image.data[(x + y * image.width)*4 + 1]/255;
  var b = image.data[(x + y * image.width)*4 + 2]/255;
  return [r, g, b];
}

/**
 * [updateTexture description]
 * @return {[type]} [description]
 */
HTMLCanvasRenderer.prototype.updateTexture = function () {
  var gl = this.gl;

  this.tex.subimage({
    data: this.canvas,
    width: this.canvas.width,
    height: this.canvas.height,
    flipY: true
  })
};

module.exports = HTMLCanvasRenderer;
