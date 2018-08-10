# glsl-gamma

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Convenience utilities for working in linear space when dealing with sRGB textures.

```glsl
#pragma glslify: toLinear = require('glsl-gamma/in')
#pragma glslify: toGamma  = require('glsl-gamma/out')

void main() {
  //sample into linear space
  vec4 color = toLinear(texture2D(uTexture, vUv));

  //do linear space transforms on RGB...

  //output to sRGB color buffer
  gl_FragColor = toGamma(color);
}
```

Currently all gamma operates on a `2.2` constant.

## Usage

[![NPM](https://nodei.co/npm/glsl-gamma.png)](https://nodei.co/npm/glsl-gamma/)

#### `toLinear = require('glsl-gamma/in')`
##### `genType = toLinear(genType color)`

Take a sRGB value and return its linear form. For `vec4`, the alpha component is left unchanged.

This is also the default export of `glsl-gamma`.

#### `toGamma = require('glsl-gamma/out')`
##### `genType = toGamma(genType color)`

Takes a linear value and return its gamma-corrected (sRGB) form. For `vec4`, the alpha component is left unchanged.

## License

MIT. See [LICENSE.md](http://github.com/stackgl/glsl-gamma/blob/master/LICENSE.md) for details.
