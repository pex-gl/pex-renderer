/*
mediump vec2 octahedralProjection(mediump vec3 dir) {
    dir/= dot(vec3(1.0), abs(dir));
    mediump vec2 rev = abs(dir.zx) - vec2(1.0,1.0);
    mediump vec2 neg = vec2(
        dir.x < 0.0 ? rev.x : -rev.x,
        dir.z < 0.0 ? rev.y : -rev.y
    );
    mediump vec2 uv = dir.y < 0.0 ? neg : dir.xz;
    return 0.5*uv + vec2(0.5,0.5);
}
*/

var Vec3 = require('pex-math/Vec3')
var Vec2 = require('pex-math/Vec2')
var abs = Math.abs
var random = Math.random

//based on
//https://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf
//https://gist.github.com/pyalot/cc7c3e5f144fb825d626
//https://github.com/mrdoob/three.js/issues/5847

function dirToOctUv(dir) {
    var dot = Vec3.dot([1,1,1], [abs(dir[0]), abs(dir[1]), abs(dir[2])])
    dir = Vec3.scale(Vec3.copy(dir), 1/dot)
    var rev = Vec2.sub([abs(dir[2]), abs(dir[0])], [1, 1])
    var neg = [
        (dir[0] < 0) ? rev[0] : -rev[0],
        (dir[2] < 0) ? rev[1] : -rev[1],
    ]
    var uv = dir[1] < 0 ? neg : [dir[0], dir[2]]
    Vec2.add(Vec2.scale(uv, 0.5), [0.5, 0.5])
    return uv
}

function dirToOctUv2(dir) {
    //#define sum(value) dot(clamp((value), 1.0, 1.0), (value))
    var dot = Vec3.dot([1,1,1], [abs(dir[0]), abs(dir[1]), abs(dir[2])])
    dir = Vec3.scale(Vec3.copy(dir), 1/dot)
    var uv;
    if (dir[1] >= 0) {
        uv = [dir[0], dir[2]]
    }
    else {
        var rev = Vec2.sub([abs(dir[2]), abs(dir[0])], [1, 1])
        uv = [
            (dir[0] < 0) ? rev[0] : -rev[0],
            (dir[2] < 0) ? rev[1] : -rev[1],
        ]
        // if (dirX < 0)
        //   u = abs(dirZ)  - 1
        //   u = -1..0
        // else
        //   u = -(abs(dirZ) - 1)
        //   u = 1..0
        // if (dirZ < 0)
        //   v = abs(dirX)  - 1
        //   v = -1..0
        // else
        //   v = -(abs(dirX) - 1)
        //   v = 1..0
    }
    return Vec2.add(Vec2.scale(uv, 0.5), [0.5, 0.5])
}

var iter = 0;

function sectorize(uv) {
    return [
        (uv[0] > 0 ? 1 : 0) * 2 - 1,
        (uv[1] > 0 ? 1 : 0) * 2 - 1
    ]
}

function octUvToDir(uv) {
    var dir = [0,0,0]
    //uv = [0..1, 0..1]
    uv = Vec2.sub(Vec2.scale(Vec2.copy(uv), 2), [1, 1])
    //uv = [-1..1, -1..1]
    var auv = [abs(uv[0]), abs(uv[1])]
    var len = Vec2.dot(auv, [1,1])
    var suv = sectorize(uv)
    if (len > 1.0) {
        //y < 0 case
        uv = [
            (auv[1] - 1) * (uv[0] > 0 ? -1 : 1),
            (auv[0] - 1) * (uv[1] > 0 ? -1 : 1),
        ]
    }

    return Vec3.normalize([
        uv[0],
        1 - len,
        uv[1]
    ])
}

var plask = require('plask')

plask.simpleWindow({
    settings: {
        type: '2d',
        width: 256,
        height: 256
    },
    init: function() {
        var paint = this.paint;
        var canvas = this.canvas;
        var W = 256
        var H = 256
        for(var i=0; i<100000; i++) {
            var dir = Vec3.normalize([
                random() * 2 - 1,
                random() * 2 - 1,
                random() * 2 - 1
            ])
            var dirOrig = Vec3.copy(dir)
            var uv = dirToOctUv2(dir)
            var uvOrig = Vec2.copy(uv)
            dir = octUvToDir(uv)
            uv = dirToOctUv2(dir)
            var s = (dir[1] >= 0) ? 1 : 0.5
            if (dir[0] >= 0 && dir[2] >= 0) {
                paint.setColor(255*s, 0, 0, 255)
            } else if (dir[0] <= 0 && dir[2] >= 0) {
                paint.setColor(255*s, 255*s, 0, 255)
            } else if (dir[0] <= 0 && dir[2] <= 0) {
                paint.setColor(0, 105*s, 255*s, 255)
            } else if (dir[0] >= 0 && dir[2] <= 0) {
                paint.setColor(0, 255*s, 55*s, 255)
            } else {
                paint.setColor(50, 50, 50)
            }
            paint.setColor(
                (dirOrig[0]*0.5+0.5)*255,
                (dirOrig[1]*0.5+0.5)*255,
                (dirOrig[2]*0.5+0.5)*255,
                255
            )
            var x = uv[0] * W
            var y = uv[1] * H
            canvas.drawRect(paint, x - 1, y - 1, x + 1, y + 1)
        }
    },
    draw: function() {
    }
})
