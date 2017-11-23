# pex-renderer

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

Phisically Based Renderer for Pex

### API

#### Renderer(opts)

```javascript
const renderer = new Renderer(ctx)
opts = Context
```

```javascript
const renderer = new Renderer(opts)
opts = {
  ctx: Context,
  width: Number,
  height: Number,
  profile: Boolean,
  pauseOnBlur: Boolean
}
```

### Entity

#### entity = renderer.entity(components)

#### entity.dispose()

Removes entity from the scene and diposes all the components and their resources

TODO: diposing? right now it's not recursive
TODO: name in the constructor?
TODO: what if e.g. material component shared a texture with another one?

## Usage

[![NPM](https://nodei.co/npm/pex-renderer.png)](https://www.npmjs.com/package/pex-renderer)

## License

MIT, see [LICENSE.md](http://github.com/pex-gl/pex-renderer/blob/master/LICENSE.md) for details.
