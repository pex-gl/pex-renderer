# geom-triangulate

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

Splits quad or polygon faces into triangles.

Implemented using naive face triangulation - builds a triangle fan anchored at the first face vertex.

## Usage

[![NPM](https://nodei.co/npm/geom-triangulate.png)](https://www.npmjs.com/package/geom-triangulate)

#### `triangulate(faces | geometry)`

Parameters:  
`faces` - list of face indices e.g. `[[0,1,2,3], [3,2,5,4],...]`  
`geometry` - simplicial complex geometry `{ positions: [], cells: [] }`

Returns:  
If `faces` is supplied a list of triangles will be returned.  
If `geometry` is supplied a new geometry with cloned positions and triangulated faces will be returned.

## Example

```javascript
var triangulate = require('geom-triangulate');

var faces = [[0,1,2,3], [3,2,5,4],...];
var tris = triangulate(faces); //[[0,1,2], [0,2,3], ...]
```

## License

MIT, see [LICENSE.md](http://github.com/vorg/geom-triangulate/blob/master/LICENSE.md) for details.
