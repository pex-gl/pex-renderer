function emptyGroupInfo() {
    return {
        name: "",
        faceVertices: [],
        hasUVs: false,
        hasNormals: false,
        needsReindexing: false,
        positionOffset: 0,
        uvOffset: 0,
        normalOffset: 0
    };
}
function parseObj(text, options) {
    options = options || {};
    var triangulate = (options.triangulate !== undefined) ? options.triangulate : true;
    var lines = text.trim().split('\n');

    var g = null;

    var groups = [];

    var positions = [];
    var uvs = [];
    var normals = [];

    for(var i=0, len=lines.length; i<len; i++) {
        var line = lines[i].replace(/[\s]+/, ' ');
        var tokens = line.trim().split(' ');

        //skip commment
        if (tokens[0][0] == '#') continue;

        //skip empty lines
        if (!tokens[0]) continue;

        switch(tokens[0]) {
            //vertices x, y, z
            case 'v':
                positions.push([ Number(tokens[1]), Number(tokens[2]), Number(tokens[3]) ]);
                break;
            //vertex tex coords s, t
            //skipping 3rd coordinate even if present
            case 'vt':
                uvs.push([ Number(tokens[1]), Number(tokens[2]) ]);
                break;
            //vertex normals
            case 'vn':
                normals.push([ Number(tokens[1]), Number(tokens[2]), Number(tokens[3]) ]);
                break;
            //face
            case 'f':
                if (!g) {
                    g = emptyGroupInfo();
                    g.positionOffset = positions.length;
                    g.uvOffset = uvs.length;
                    g.normalOffset = normals.length;
                    groups.push(g);
                }
                var vertices = [];
                for(var j=1; j<tokens.length; j++) {
                    var tokenValues = tokens[j].split('/');
                    var val0 = tokenValues[0];
                    var val1 = tokenValues[1];
                    var val2 = tokenValues[2];
                    tokenValues[0] = (val0 && val0.length > 0) ? Number(val0) : null;
                    tokenValues[1] = (val1 && val1.length > 0) ? Number(val1) : null;
                    tokenValues[2] = (val2 && val2.length > 0) ? Number(val2) : null;
                    vertices.push(tokenValues);
                }


                if (triangulate) {
                    //make a triangle fan
                    for(var v=1, vertexCount=vertices.length; v<vertexCount-1; v++) {
                        if (vertices[0][1] != undefined) g.hasUVs = true;
                        if (vertices[0][2] != undefined) g.hasNormals = true;

                        g.faceVertices.push([ vertices[0], vertices[v], vertices[v+1]]);
                    }
                }
                else {
                    g.faceVertices.push(vertices);
                }
                break;
            //group
            case 'g':
                g = emptyGroupInfo();
                g.positionOffset = positions.length;
                g.uvOffset = uvs.length;
                g.normalOffset = normals.length;
                g.name = line.slice(1).trim();
                groups.push(g);
                break;
            //skipping material reference
            case 'usemtl':
                break;
            //skipping material reference
            case 'mtllib':
                break;
            //skipping smoothing group
            case 's':
                break;
            //skipping ???
            case 'o':
                break;
            default:
                console.log('loadObj: skipping unrecognized line', line);

        }
    }
    var geometries = [];
    for(var i=0, len=groups.length; i<len; i++) {
        var g = groups[i];
        var geom = {
            name: g.name,
            positions: [],
            uvs: g.hasUVs ? [] : undefined,
            normals: g.hasNormals ? [] : undefined,
            cells: [],
        };
        console.log('g.hasNormals', g.hasNormals)
        geometries.push(geom);

        var vertexIndexMap = [];

        var numVertices = 0;
        var index = 0;
        for(var t=0, faceCount=g.faceVertices.length; t<faceCount; t++) {
            var triangle = g.faceVertices[t];
            var face = [];
            for(var v=0; v<triangle.length; v++) {
                var hash = triangle[v].join('-');
                var index = vertexIndexMap[hash]
                if (index === undefined) {
                    index = numVertices;
                    vertexIndexMap[hash] = index;
                    numVertices++;
                }
                face.push(index);

                var pi = triangle[v][0];
                pi = (pi > 0) ? (pi - 1) : (g.positionOffset + pi);

                var ti = triangle[v][1];
                ti = (ti > 0) ? (ti - 1) : (g.uvOffset + ti );

                var ni = triangle[v][2];
                ni = (ni > 0) ? (ni - 1) : (g.normalOffset + ni);

                geom.positions[index] = positions[pi];
                if (g.hasUVs) geom.uvs[index] = uvs[ti];
                if (g.hasNormals) geom.normals[index] = normals[ni];
            }
            geom.cells.push(face);
        }
    }
    if (geometries.length > 1) {
        return geometries
    }
    else {
        return geometries[0];
    }
};

module.exports = parseObj;
