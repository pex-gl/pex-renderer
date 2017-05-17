//similar packages
//https://github.com/hughsk/mesh-normals

var Vec3 = require('pex-math/Vec3');

//Compute normals for the mesh based on faces/cells information
//If there are two vertices with the same position but different index there will be discontinuity (hard edge)
function computeNormals(positions, cells, out) {
    var vertices = positions;
    var faces = cells;
    var normals = out || [];

    var count = [];
    var ab = [0, 0, 0];
    var ac = [0, 0, 0];
    var n  = [0, 0, 0];

    for(var fi=0, numFaces=faces.length; fi<numFaces; fi++) {
        var f = faces[fi];
        var a = vertices[f[0]];
        var b = vertices[f[1]];
        var c = vertices[f[2]];
        Vec3.normalize(Vec3.sub(Vec3.set(ab, b), a));
        Vec3.normalize(Vec3.sub(Vec3.set(ac, c), a));
        Vec3.normalize(Vec3.cross(Vec3.set(n, ab), ac));
        for(var i=0, len=f.length; i<len; i++) {
            if (!normals[f[i]]) {
                normals[f[i]] = [0, 0, 0];
            }
            Vec3.add(normals[f[i]], n);
            count[f[i]] = count[f[i]] ? 1 : count[f[i]] + 1;
        }
    }

    for(var i=0, len=normals.length; i<len; i++) {
        if (normals[i]) {
            Vec3.normalize(normals[i])
        }
        else {
            normals[i] = [0, 1, 0];
        }
    }
    return normals
}

module.exports = computeNormals;
