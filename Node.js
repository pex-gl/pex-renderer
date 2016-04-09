var Vec3 = require('pex-math/Vec3');
var Quat = require('pex-math/Quat');
var Mat4 = require('pex-math/Mat4');

function Node() {
    this._parent = null;
    this._children = [];
    this._position = [0, 0, 0]; //TODO: position vs translation (gltf)
    this._scale = [1, 1, 1];
    this._rotation = Quat.create();
    this._localTransform = Mat4.create();
    this._globalTransform = Mat4.create();
}

module.exports = Node;
