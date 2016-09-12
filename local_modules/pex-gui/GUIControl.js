var rgb2hsl = require('float-rgb2hsl');
var hsl2rgb = require('float-hsl2rgb');

/**
 * [GUIControl description]
 * @param {[type]} o [description]
 */
function GUIControl(o) {
  for (var i in o) {
    this[i] = o[i];
  }
}

/**
 * [function description]
 * @param  {[type]} x [description]
 * @param  {[type]} y [description]
 * @return {[type]}   [description]
 */
GUIControl.prototype.setPosition = function(x, y) {
  this.px = x;
  this.py = y;
};

/**
 * [function description]
 * @param  {[type]} idx [description]
 * @return {[type]}     [description]
 */
GUIControl.prototype.getNormalizedValue = function(idx) {
  if (!this.contextObject) {
    return 0;
  }

  var val = this.contextObject[this.attributeName];
  var options = this.options;
  if (options && options.min !== undefined && options.max !== undefined) {
    if (this.type == 'multislider') {
      val = (val[idx] - options.min) / (options.max - options.min);
    }
    else if (this.type == 'color') {
      var hsl = rgb2hsl(val);
      if (idx == 0) val = hsl[0];
      if (idx == 1) val = hsl[1];
      if (idx == 2) val = hsl[2];
      if (idx == 3) val = val[4];
    }
    else {
      val = (val - options.min) / (options.max - options.min);
    }
  }
  return val;
};

/**
 * [function description]
 * @param  {[type]} val [description]
 * @param  {[type]} idx [description]
 * @return {[type]}     [description]
 */
GUIControl.prototype.setNormalizedValue = function(val, idx) {
  if (!this.contextObject) {
    return;
  }

  var options = this.options;
  if (options && options.min !== undefined && options.max !== undefined) {
    if (this.type == 'multislider') {
      var a = this.contextObject[this.attributeName];
      if (idx >= a.length) {
        return;
      }
      a[idx] = options.min + val * (options.max - options.min);
      val = a;
    }
    else if (this.type == 'color') {
      var c = this.contextObject[this.attributeName];
      var hsl = rgb2hsl(c);
      if (idx == 0) hsl[0] = val;
      if (idx == 1) hsl[1] = val;
      if (idx == 2) hsl[2] = val;
      if (idx == 3) c[4] = val;

      if (idx != 3) {
          var rgb = hsl2rgb(hsl);
          c[0] = rgb[0];
          c[1] = rgb[1];
          c[2] = rgb[2];
      }
      val = c;
    }
    else {
      val = options.min + val * (options.max - options.min);
    }
    if (options && options.step) {
      val = val - val % options.step;
    }
  }
  this.contextObject[this.attributeName] = val;
};

/**
 * [function description]
 * @return {[type]} [description]
 */
GUIControl.prototype.getSerializedValue = function() {
  if (this.contextObject) {
    return this.contextObject[this.attributeName];
  }
  else {
    return '';
  }

}

/**
 * [function description]
 * @param  {[type]} value [description]
 * @return {[type]}       [description]
 */
GUIControl.prototype.setSerializedValue = function(value) {
  if (this.type == 'slider') {
    this.contextObject[this.attributeName] = value;
  }
  else if (this.type == 'multislider') {
    this.contextObject[this.attributeName] = value;
  }
  else if (this.type == 'color') {
    this.contextObject[this.attributeName].r = value.r;
    this.contextObject[this.attributeName].g = value.g;
    this.contextObject[this.attributeName].b = value.b;
    this.contextObject[this.attributeName].a = value.a;
  }
  else if (this.type == 'toggle') {
    this.contextObject[this.attributeName] = value;
  }
  else if (this.type == 'radiolist') {
    this.contextObject[this.attributeName] = value;
  }
}


/**
 * [function description]
 * @return {[type]} [description]
 */
GUIControl.prototype.getValue = function() {
  if (this.type == 'slider') {
    return this.contextObject[this.attributeName];
  }
  else if (this.type == 'multislider') {
    return this.contextObject[this.attributeName];
  }
  else if (this.type == 'color') {
    return this.contextObject[this.attributeName];
  }
  else if (this.type == 'toggle') {
    return this.contextObject[this.attributeName];
  }
  else {
    return 0;
  }
};

/**
 * [function description]
 * @return {[type]} [description]
 */
GUIControl.prototype.getStrValue = function() {
  if (this.type == 'slider') {
    var str = '' + this.contextObject[this.attributeName];
    var dotPos = str.indexOf('.') + 1;
    if (dotPos === 0) {
      return str + '.0';
    }
    while (str.charAt(dotPos) == '0') {
      dotPos++;
    }
    return str.substr(0, dotPos + 2);
  }
  else if (this.type == 'color') {
    return 'HSLA';
  }
  else if (this.type == 'toggle') {
    return this.contextObject[this.attributeName];
  }
  else {
    return '';
  }
};

module.exports = GUIControl;
GUIControl;
