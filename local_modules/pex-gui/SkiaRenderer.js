var plask     = require('plask');
var SkCanvas  = plask.SkCanvas;
var SkPaint   = plask.SkPaint;
var Rect = require('pex-geom/Rect');

/**
 * [SkiaRenderer description]
 * @param {[type]} ctx    [description]
 * @param {[type]} width  [description]
 * @param {[type]} height [description]
 */
function SkiaRenderer(regl, width, height, pixelRatio) {
    this.regl = regl;
    this.tex = regl.texture({ width: width, height: height});
    console.log('tex', this.tex.width, this.tex.height)
    this.pixelRatio = pixelRatio;
    this.canvas = new SkCanvas.create(width, height);
    this.canvasPaint = new SkPaint();
    this.fontPaint = new SkPaint();
    this.fontPaint.setStyle(SkPaint.kFillStyle);
    this.fontPaint.setColor(255, 255, 255, 255);
    this.fontPaint.setTextSize(10);
    this.fontPaint.setFontFamily('Monaco');
    this.fontPaint.setStrokeWidth(0);
    this.headerFontPaint = new SkPaint();
    this.headerFontPaint.setStyle(SkPaint.kFillStyle);
    this.headerFontPaint.setColor(0, 0, 0, 255);
    this.headerFontPaint.setTextSize(10);
    this.headerFontPaint.setFontFamily('Monaco');
    this.headerFontPaint.setStrokeWidth(0);
    this.fontHighlightPaint = new SkPaint();
    this.fontHighlightPaint.setStyle(SkPaint.kFillStyle);
    this.fontHighlightPaint.setColor(100, 100, 100, 255);
    this.fontHighlightPaint.setTextSize(10);
    this.fontHighlightPaint.setFontFamily('Monaco');
    this.fontHighlightPaint.setStrokeWidth(0);
    this.panelBgPaint = new SkPaint();
    this.panelBgPaint.setStyle(SkPaint.kFillStyle);
    this.panelBgPaint.setColor(0, 0, 0, 150);
    this.headerBgPaint = new SkPaint();
    this.headerBgPaint.setStyle(SkPaint.kFillStyle);
    this.headerBgPaint.setColor(255, 255, 255, 255);
    this.textBgPaint = new SkPaint();
    this.textBgPaint.setStyle(SkPaint.kFillStyle);
    this.textBgPaint.setColor(50, 50, 50, 255);
    this.textBorderPaint = new SkPaint();
    this.textBorderPaint.setStyle(SkPaint.kStrokeStyle);
    this.textBorderPaint.setColor(255, 255, 0, 255);
    this.controlBgPaint = new SkPaint();
    this.controlBgPaint.setStyle(SkPaint.kFillStyle);
    this.controlBgPaint.setColor(150, 150, 150, 255);
    this.controlHighlightPaint = new SkPaint();
    this.controlHighlightPaint.setStyle(SkPaint.kFillStyle);
    this.controlHighlightPaint.setColor(255, 255, 0, 255);
    this.controlHighlightPaint.setAntiAlias(true);
    this.controlStrokeHighlightPaint = new SkPaint();
    this.controlStrokeHighlightPaint.setStyle(SkPaint.kStrokeStyle);
    this.controlStrokeHighlightPaint.setColor(255, 255, 0, 255);
    this.controlStrokeHighlightPaint.setAntiAlias(false);
    this.controlStrokeHighlightPaint.setStrokeWidth(2);
    this.controlFeaturePaint = new SkPaint();
    this.controlFeaturePaint.setStyle(SkPaint.kFillStyle);
    this.controlFeaturePaint.setColor(255, 255, 255, 255);
    this.controlFeaturePaint.setAntiAlias(true);
    this.imagePaint = new SkPaint();
    this.imagePaint.setStyle(SkPaint.kFillStyle);
    this.imagePaint.setColor(255, 255, 255, 255);
    this.colorPaint = new SkPaint();
    this.colorPaint.setStyle(SkPaint.kFillStyle);
    this.colorPaint.setColor(255, 255, 255, 255);
}

/**
 * [function description]
 * @param  {[type]} items [description]
 * @param  {[type]} scale [description]
 * @return {[type]}       [description]
 */
SkiaRenderer.prototype.draw = function(items, scale) {
  var canvas = this.canvas;
  canvas.save();
  canvas.scale(this.pixelRatio, this.pixelRatio);
  canvas.drawColor(0, 0, 0, 0, plask.SkPaint.kClearMode);
  //transparent
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
    var eh = 20;

    if (e.options && e.options.palette && !e.options.paletteImage) {
        if (e.options.palette.width) {
            e.options.paletteImage = e.options.palette;
        }
        else {
            e.options.paletteImage = plask.SkCanvas.createFromImage(e.options.palette);
        }
    }

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
      canvas.drawRect(this.panelBgPaint, dx, dy, dx + w, dy + eh - 2);
    }

    if (e.type == 'slider') {
      var value = e.getValue();
      canvas.drawRect(this.controlBgPaint, dx + 3, dy + 18, dx + w - 3, dy + eh - 5);
      canvas.drawRect(this.controlHighlightPaint, dx + 3, dy + 18, dx + 3 + (w - 6) * e.getNormalizedValue(), dy + eh - 5);
      Rect.set4(e.activeArea, dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
      canvas.drawText(this.fontPaint, items[i].title + ' : ' + e.getStrValue(), dx + 4, dy + 13);
    }
    else if (e.type == 'multislider') {
      for (var j = 0; j < e.getValue().length; j++) {
        canvas.drawRect(this.controlBgPaint, dx + 3, dy + 18 + j * 14 * scale, dx + w - 3, dy + 18 + (j + 1) * 14 * scale - 3);
        canvas.drawRect(this.controlHighlightPaint, dx + 3, dy + 18 + j * 14 * scale, dx + 3 + (w - 6) * e.getNormalizedValue(j), dy + 18 + (j + 1) * 14 * scale - 3);
      }
      canvas.drawText(this.fontPaint, items[i].title + ' : ' + e.getStrValue(), dx + 4, dy + 13);
      Rect.set4(e.activeArea, dx + 4, dy + 18, w - 3 - 3, eh - 5 - 18);
    }
    else if (e.type == 'color') {
      var numSliders = e.options.alpha ? 4 : 3;
      for (var j = 0; j < numSliders; j++) {
        canvas.drawRect(this.controlBgPaint, dx + 3, dy + 18 + j * 14 * scale, dx + w - 3, dy + 18 + (j + 1) * 14 * scale - 3);
        canvas.drawRect(this.controlHighlightPaint, dx + 3, dy + 18 + j * 14 * scale, dx + 3 + (w - 6) * e.getNormalizedValue(j), dy + 18 + (j + 1) * 14 * scale - 3);
      }
      var c = e.getValue();
      this.colorPaint.setColor(255*c[0], 255*c[1], 255*c[2], 255);
      canvas.drawRect(this.colorPaint, dx + w - 12 - 3, dy + 3, dx + w - 3, dy + 3 + 12);
      if (e.options.paletteImage) {
        canvas.drawCanvas(this.imagePaint, e.options.paletteImage, dx + 3, dy + 18 + 14 * numSliders, dx + w - 3, dy + 18 + 14 * numSliders + w * e.options.paletteImage.height/e.options.paletteImage.width);
      }
      canvas.drawText(this.fontPaint, items[i].title + ' : ' + e.getStrValue(), dx + 3, dy + 13);
      Rect.set4(e.activeArea, dx + 4, dy + 18, w - 3 - 3, eh - 5 - 18);
    }
    else if (e.type == 'button') {
      var btnColor = e.active ? this.controlHighlightPaint : this.controlBgPaint;
      var btnFont = e.active ? this.fontHighlightPaint : this.fontPaint;
      canvas.drawRect(btnColor, dx + 3, dy + 3, dx + w - 3, dy + eh - 5);
      Rect.set4(e.activeArea, dx + 3, dy + 3, w - 3 - 3, eh - 5);
      if (e.options.color) {
        var c = e.options.color;
        this.controlFeaturePaint.setColor(255 * c[0], 255 * c[1], 255 * c[2], 255);
        canvas.drawRect(this.controlFeaturePaint, dx + w - 8, dy + 3, dx + w - 3, dy + eh - 5);
      }
      canvas.drawText(btnFont, items[i].title, dx + 5, dy + 15);
    }
    else if (e.type == 'toggle') {
      var on = e.contextObject[e.attributeName];
      var toggleColor = on ? this.controlHighlightPaint : this.controlBgPaint;
      canvas.drawRect(toggleColor, dx + 3, dy + 3, dx + eh - 5, dy + eh - 5);
      Rect.set4(e.activeArea, dx + 3, dy + 3, eh - 5, eh - 5);
      canvas.drawText(this.fontPaint, items[i].title, dx + eh, dy + 13);
    }
    else if (e.type == 'radiolist') {
      canvas.drawText(this.fontPaint, e.title, dx + 4, dy + 14);
      var itemColor = this.controlBgPaint;
      var itemHeight = 20 * scale;
      for (var j = 0; j < e.items.length; j++) {
        var item = e.items[j];
        var on = e.contextObject[e.attributeName] == item.value;
        var itemColor = on ? this.controlHighlightPaint : this.controlBgPaint;
        canvas.drawRect(itemColor, dx + 3, 18 + j * itemHeight + dy + 3, dx + itemHeight - 5, itemHeight + j * itemHeight + dy + 18 - 5);
        canvas.drawText(this.fontPaint, item.name, dx + itemHeight, 18 + j * itemHeight + dy + 13);
      }
      Rect.set4(e.activeArea, dx + 3, 18 + dy + 3, itemHeight - 5, e.items.length * itemHeight - 5);
    }
    else if (e.type == 'texturelist') {
      canvas.drawText(this.fontPaint, e.title, dx + 4, dy + 14);
      for (var j = 0; j < e.items.length; j++) {
        var col = j % e.itemsPerRow;
        var row = Math.floor(j / e.itemsPerRow);
        var itemColor = this.controlBgPaint;
        var shrink = 0;
        canvas.drawRect(itemColor, dx + 3 + col * cellSize, dy + 18 + row * cellSize, dx + 3 + (col + 1) * cellSize - 1, dy + 18 + (row + 1) * cellSize - 1);
        if (e.items[j].value == e.contextObject[e.attributeName]) {
          var strokeColor = this.controlStrokeHighlightPaint;
          canvas.drawRect(strokeColor, dx + 3 + col * cellSize + 1, dy + 18 + row * cellSize + 1, dx + 3 + (col + 1) * cellSize - 1 - 1, dy + 18 + (row + 1) * cellSize - 1 - 1);
          shrink = 2;
        }
        if (!e.items[j].activeArea) {
          e.items[j].activeArea = [[0,0],[0,0]];
        }
        Rect.set4(e.items[j].activeArea, dx + 3 + col * cellSize + shrink, dy + 18 + row * cellSize + shrink, cellSize - 1 - 2 * shrink, cellSize - 1 - 2 * shrink);
      }
      Rect.set4(e.activeArea, dx + 3, 18 + dy + 3, w - 3 - 3, cellSize * numRows - 5);
    }
    else if (e.type == 'texture2D') {
      canvas.drawText(this.fontPaint, e.title, dx + 3, dy + 13);
      Rect.set4(e.activeArea, dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
    }
    else if (e.type == 'textureCube') {
      canvas.drawText(this.fontPaint, e.title, dx + 3, dy + 13);
      Rect.set4(e.activeArea, dx + 3, dy + 18, w - 3 - 3, eh - 5 - 18);
    }
    else if (e.type == 'header') {
      canvas.drawRect(this.headerBgPaint, dx + 3, dy + 3, dx + w - 3, dy + eh - 5);
      canvas.drawText(this.headerFontPaint, items[i].title, dx + 6, dy + 16);
    }
    else if (e.type == 'text') {
      canvas.drawText(this.fontPaint, items[i].title, dx + 3, dy + 13);
      canvas.drawRect(this.textBgPaint, dx + 3, dy + 20, dx + w - 3, dy + eh - 5);
      canvas.drawText(this.fontPaint, e.contextObject[e.attributeName], dx + 3 + 3, dy + 15 + 20);
      Rect.set4(e.activeArea, dx + 3, dy + 20, w - 6, eh - 20 - 5);
      if (e.focus) {
        canvas.drawRect(this.textBorderPaint, e.activeArea[0][0], e.activeArea[0][1], e.activeArea[1][0], e.activeArea[1][1]);
      }
    }
    else if (e.type == 'separator') {
      //do nothing
    }
    else {
      canvas.drawText(this.fontPaint, items[i].title, dx + 3, dy + 13);
    }
    dy += eh;
  }
  canvas.restore();
  this.updateTexture();
};

/**
 * [function description]
 * @param  {[type]} image [description]
 * @param  {[type]} x     [description]
 * @param  {[type]} y     [description]
 * @return {[type]}       [description]
 */
SkiaRenderer.prototype.getImageColor = function(image, x, y) {
  var pixels = image.pixels || image;
  //Skia stores canvas data as BGR
  var r = pixels[(x + y * image.width)*4 + 2]/255;
  var g = pixels[(x + y * image.width)*4 + 1]/255;
  var b = pixels[(x + y * image.width)*4 + 0]/255;
  return [r, g, b]
}

/**
 * [function description]
 * @return {[type]} [description]
 */
SkiaRenderer.prototype.getTexture = function() {
  return this.tex;
};

/**
 * [function description]
 * @return {[type]} [description]
 */
SkiaRenderer.prototype.getCanvas = function() {
  return this.canvas;
};

/**
 * [function description]
 * @return {[type]} [description]
 */
SkiaRenderer.prototype.getCanvasPaint = function() {
  return this.canvasPaint;
};

/**
 * [function description]
 * @return {[type]} [description]
 */

SkiaRenderer.prototype.updateTexture = function() {
  if (!this.tex) return;
  var pixels = []
  var canvas = this.canvas
  for (var y = canvas.height - 1; y >= 0; y--) {
    for (var x = 0; x < canvas.width; x++) {
      var i = (x + y * canvas.width) * 4
      // SkiaCanvas is BGRA
      pixels.push(canvas.pixels[i + 2],  canvas.pixels[i + 1], canvas.pixels[i + 0], canvas.pixels[i + 3])
    }
  }
  this.tex.subimage({
    data: pixels,
    width: this.canvas.width,
    height: this.canvas.height
  });
};

module.exports = SkiaRenderer;
