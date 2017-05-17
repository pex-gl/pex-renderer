function parseModel( json, geometry ) {

  function isBitSet( value, position ) {

    return value & ( 1 << position );

  }

  var i, j, fi,

    offset, zLength,

    colorIndex, normalIndex, uvIndex, materialIndex,

    type,
    isQuad,
    hasMaterial,
    hasFaceVertexUv,
    hasFaceNormal, hasFaceVertexNormal,
    hasFaceColor, hasFaceVertexColor,

    vertex, face, faceA, faceB, hex, normal,

    uvLayer, uv, u, v,

    faces = json.faces,
    vertices = json.vertices,
    normals = json.normals,
    colors = json.colors,

    scale = json.scale,

    nUvLayers = 0;


  if ( json.uvs !== undefined ) {

    // disregard empty arrays

    for ( i = 0; i < json.uvs.length; i ++ ) {

      if ( json.uvs[ i ].length ) nUvLayers ++;

    }

    for ( i = 0; i < nUvLayers; i ++ ) {

      geometry.faceVertexUvs[ i ] = [];

    }

  }

  offset = 0;
  zLength = vertices.length;

  while ( offset < zLength ) {

    vertex = []

    vertex[0] = vertices[ offset ++ ] * scale;
    vertex[1] = vertices[ offset ++ ] * scale;
    vertex[2] = vertices[ offset ++ ] * scale;

    geometry.vertices.push( vertex );

  }

  offset = 0;
  zLength = faces.length;

  while ( offset < zLength ) {

    type = faces[ offset ++ ];

    isQuad = isBitSet( type, 0 );
    hasMaterial = isBitSet( type, 1 );
    hasFaceVertexUv = isBitSet( type, 3 );
    hasFaceNormal = isBitSet( type, 4 );
    hasFaceVertexNormal = isBitSet( type, 5 );
    hasFaceColor = isBitSet( type, 6 );
    hasFaceVertexColor = isBitSet( type, 7 );

    // console.log("type", type, "bits", isQuad, hasMaterial, hasFaceVertexUv, hasFaceNormal, hasFaceVertexNormal, hasFaceColor, hasFaceVertexColor);

    if ( isQuad ) {

      faceA = []
      faceA[0] = faces[ offset ];
      faceA[1] = faces[ offset + 1 ];
      faceA[2] = faces[ offset + 3 ];

      faceB = []
      faceB[0] = faces[ offset + 1 ];
      faceB[1] = faces[ offset + 2 ];
      faceB[2] = faces[ offset + 3 ];

      offset += 4;

      if ( hasMaterial ) {

        materialIndex = faces[ offset ++ ];
        faceA.materialIndex = materialIndex;
        faceB.materialIndex = materialIndex;

      }

      // to get face <=> uv index correspondence

      fi = geometry.faces.length;

      if ( hasFaceVertexUv ) {

        for ( i = 0; i < nUvLayers; i ++ ) {

          uvLayer = json.uvs[ i ];

          geometry.faceVertexUvs[ i ][ fi ] = [];
          geometry.faceVertexUvs[ i ][ fi + 1 ] = [];

          for ( j = 0; j < 4; j ++ ) {

            uvIndex = faces[ offset ++ ];

            u = uvLayer[ uvIndex * 2 ];
            v = uvLayer[ uvIndex * 2 + 1 ];

            uv = [u, v];

            if ( j !== 2 ) geometry.faceVertexUvs[ i ][ fi ].push( uv );
            if ( j !== 0 ) geometry.faceVertexUvs[ i ][ fi + 1 ].push( uv );

          }

        }

      }

      if ( hasFaceNormal ) {

        normalIndex = faces[ offset ++ ] * 3;

        normalIndex++
        normalIndex++
        // faceA.normal.set(
        // normals[ normalIndex ++ ]
        // normals[ normalIndex ++ ]
        // normals[ normalIndex ]
        // );

        // faceB.normal.copy( faceA.normal );

      }

      if ( hasFaceVertexNormal ) {

        for ( i = 0; i < 4; i ++ ) {

          normalIndex = faces[ offset ++ ] * 3;

          normal = [
            normals[ normalIndex ++ ],
            normals[ normalIndex ++ ],
            normals[ normalIndex ]
          ];


          // if ( i !== 2 ) faceA.vertexNormals.push( normal );
          // if ( i !== 0 ) faceB.vertexNormals.push( normal );

        }

      }


      if ( hasFaceColor ) {

        colorIndex = faces[ offset ++ ];
        hex = colors[ colorIndex ];

        // faceA.color.setHex( hex );
        // faceB.color.setHex( hex );

      }


      if ( hasFaceVertexColor ) {

        for ( i = 0; i < 4; i ++ ) {

          colorIndex = faces[ offset ++ ];
          hex = colors[ colorIndex ];

          // if ( i !== 2 ) faceA.vertexColors.push( new Color( hex ) );
          // if ( i !== 0 ) faceB.vertexColors.push( new Color( hex ) );

        }

      }

      geometry.faces.push( faceA );
      geometry.faces.push( faceB );

    } else {

      face = []
      face[0] = faces[ offset ++ ];
      face[1] = faces[ offset ++ ];
      face[2] = faces[ offset ++ ];

      if ( hasMaterial ) {

        materialIndex = faces[ offset ++ ];
        face.materialIndex = materialIndex;

      }

      // to get face <=> uv index correspondence

      fi = geometry.faces.length;

      if ( hasFaceVertexUv ) {

        for ( i = 0; i < nUvLayers; i ++ ) {

          uvLayer = json.uvs[ i ];

          geometry.faceVertexUvs[ i ][ fi ] = [];

          for ( j = 0; j < 3; j ++ ) {

            uvIndex = faces[ offset ++ ];

            u = uvLayer[ uvIndex * 2 ];
            v = uvLayer[ uvIndex * 2 + 1 ];

            uv = [u, v]

            geometry.faceVertexUvs[ i ][ fi ].push( uv );

          }

        }

      }

      if ( hasFaceNormal ) {

        normalIndex = faces[ offset ++ ] * 3;

        normalIndex++
        normalIndex++
        // face.normal.set(
        // normals[ normalIndex ++ ],
        // normals[ normalIndex ++ ],
        // normals[ normalIndex ]
        // );

      }

      if ( hasFaceVertexNormal ) {

        for ( i = 0; i < 3; i ++ ) {

          normalIndex = faces[ offset ++ ] * 3;

          normal = [
            normals[ normalIndex ++ ],
            normals[ normalIndex ++ ],
            normals[ normalIndex ]
          ]

          // face.vertexNormals.push( normal );

        }

      }


      if ( hasFaceColor ) {

        colorIndex = faces[ offset ++ ];
        // face.color.setHex( colors[ colorIndex ] );

      }


      if ( hasFaceVertexColor ) {

        for ( i = 0; i < 3; i ++ ) {

          colorIndex = faces[ offset ++ ];
          // face.vertexColors.push( new Color( colors[ colorIndex ] ) );

        }

      }

      geometry.faces.push( face );

    }

  }

}

function parseSkin( json, geometry ) {

  var influencesPerVertex = ( json.influencesPerVertex !== undefined ) ? json.influencesPerVertex : 2;

  if ( json.skinWeights ) {

    for ( var i = 0, l = json.skinWeights.length; i < l; i += influencesPerVertex ) {

      var x = json.skinWeights[ i ];
      var y = ( influencesPerVertex > 1 ) ? json.skinWeights[ i + 1 ] : 0;
      var z = ( influencesPerVertex > 2 ) ? json.skinWeights[ i + 2 ] : 0;
      var w = ( influencesPerVertex > 3 ) ? json.skinWeights[ i + 3 ] : 0;

      geometry.skinWeights.push([ x, y, z, w ]);

    }

  }

  if ( json.skinIndices ) {

    for ( var i = 0, l = json.skinIndices.length; i < l; i += influencesPerVertex ) {

      var a = json.skinIndices[ i ];
      var b = ( influencesPerVertex > 1 ) ? json.skinIndices[ i + 1 ] : 0;
      var c = ( influencesPerVertex > 2 ) ? json.skinIndices[ i + 2 ] : 0;
      var d = ( influencesPerVertex > 3 ) ? json.skinIndices[ i + 3 ] : 0;

      geometry.skinIndices.push([ a, b, c, d ]);

    }

  }

  geometry.bones = json.bones;

  if ( geometry.bones && geometry.bones.length > 0 && ( geometry.skinWeights.length !== geometry.skinIndices.length || geometry.skinIndices.length !== geometry.vertices.length ) ) {

    console.warn( 'When skinning, number of vertices (' + geometry.vertices.length + '), skinIndices (' +
      geometry.skinIndices.length + '), and skinWeights (' + geometry.skinWeights.length + ') should match.' );

  }

}

function parseMorphing( json, geometry ) {

  var scale = json.scale;

  if ( json.morphTargets !== undefined ) {

    for ( var i = 0, l = json.morphTargets.length; i < l; i ++ ) {

      geometry.morphTargets[ i ] = {};
      geometry.morphTargets[ i ].name = json.morphTargets[ i ].name;
      geometry.morphTargets[ i ].vertices = [];

      var dstVertices = geometry.morphTargets[ i ].vertices;
      var srcVertices = json.morphTargets[ i ].vertices;

      for ( var v = 0, vl = srcVertices.length; v < vl; v += 3 ) {

        var vertex = new Vector3();
        vertex.x = srcVertices[ v ] * scale;
        vertex.y = srcVertices[ v + 1 ] * scale;
        vertex.z = srcVertices[ v + 2 ] * scale;

        dstVertices.push( vertex );

      }

    }

  }

  if ( json.morphColors !== undefined && json.morphColors.length > 0 ) {

    console.warn( 'THREE.JSONLoader: "morphColors" no longer supported. Using them as face colors.' );

    var faces = geometry.faces;
    var morphColors = json.morphColors[ 0 ].colors;

    for ( var i = 0, l = faces.length; i < l; i ++ ) {

      faces[ i ].color.fromArray( morphColors, i * 3 );

    }

  }

}

var AnimationUtils = {
  // function for parsing AOS keyframe formats
	flattenJSON: function ( jsonKeys, times, values, valuePropertyName ) {

		var i = 1, key = jsonKeys[ 0 ];

		while ( key !== undefined && key[ valuePropertyName ] === undefined ) {

			key = jsonKeys[ i ++ ];

		}

		if ( key === undefined ) return; // no data

		var value = key[ valuePropertyName ];
		if ( value === undefined ) return; // no data

		if ( Array.isArray( value ) ) {

			do {

				value = key[ valuePropertyName ];

				if ( value !== undefined ) {

					times.push( key.time );
					values.push.apply( values, value ); // push all elements

				}

				key = jsonKeys[ i ++ ];

			} while ( key !== undefined );

		} else if ( value.toArray !== undefined ) {

			// ...assume THREE.Math-ish

			do {

				value = key[ valuePropertyName ];

				if ( value !== undefined ) {

					times.push( key.time );
					value.toArray( values, values.length );

				}

				key = jsonKeys[ i ++ ];

			} while ( key !== undefined );

		} else {

			// otherwise push as-is

			do {

				value = key[ valuePropertyName ];

				if ( value !== undefined ) {

					times.push( key.time );
					values.push( value );

				}

				key = jsonKeys[ i ++ ];

			} while ( key !== undefined );

		}

	}
}
var AnimationClip = {
  // parse the animation.hierarchy format
  parseAnimation: function ( animation, bones ) {

    if ( ! animation ) {

      console.error( "  no animation in JSONLoader data" );
      return null;

    }

    var addNonemptyTrack = function ( trackType, trackName, animationKeys, propertyName, destTracks ) {

      // only return track if there are actually keys.
      if ( animationKeys.length !== 0 ) {

        var times = [];
        var values = [];

        AnimationUtils.flattenJSON( animationKeys, times, values, propertyName );

        // empty keys are filtered out, so check again
        if ( times.length !== 0 ) {

          destTracks.push([trackName, times, values]);

        }

      }

    };

    var tracks = [];

    var clipName = animation.name || 'default';
    // automatic length determination in AnimationClip.
    var duration = animation.length || - 1;
    var fps = animation.fps || 30;

    var hierarchyTracks = animation.hierarchy || [];

    for ( var h = 0; h < hierarchyTracks.length; h ++ ) {

      var animationKeys = hierarchyTracks[ h ].keys;

      // skip empty tracks
      if ( ! animationKeys || animationKeys.length === 0 ) continue;

      // process morph targets in a way exactly compatible
      // with AnimationHandler.init( animation )
      if ( animationKeys[ 0 ].morphTargets ) {

        // figure out all morph targets used in this track
        var morphTargetNames = {};

        for ( var k = 0; k < animationKeys.length; k ++ ) {

          if ( animationKeys[ k ].morphTargets ) {

            for ( var m = 0; m < animationKeys[ k ].morphTargets.length; m ++ ) {

              morphTargetNames[ animationKeys[ k ].morphTargets[ m ] ] = - 1;

            }

          }

        }

        // create a track for each morph target with all zero
        // morphTargetInfluences except for the keys in which
        // the morphTarget is named.
        for ( var morphTargetName in morphTargetNames ) {

          var times = [];
          var values = [];

          for ( var m = 0; m !== animationKeys[ k ].morphTargets.length; ++ m ) {

            var animationKey = animationKeys[ k ];

            times.push( animationKey.time );
            values.push( ( animationKey.morphTarget === morphTargetName ) ? 1 : 0 );

          }

          tracks.push( new NumberKeyframeTrack( '.morphTargetInfluence[' + morphTargetName + ']', times, values ) );

        }

        duration = morphTargetNames.length * ( fps || 1.0 );

      } else {

        // ...assume skeletal animation

        var boneName = '.bones[' + bones[ h ].name + ']';

        var VectorKeyframeTrack = 'VectorKeyframeTrack'
        var QuaternionKeyframeTrack = 'QuaternionKeyframeTrack'

        addNonemptyTrack(
          VectorKeyframeTrack, boneName + '.position',
          animationKeys, 'pos', tracks );

        addNonemptyTrack(
          QuaternionKeyframeTrack, boneName + '.quaternion',
          animationKeys, 'rot', tracks );

        addNonemptyTrack(
          VectorKeyframeTrack, boneName + '.scale',
          animationKeys, 'scl', tracks );

      }

    }

    if ( tracks.length === 0 ) {
      return null;
    }
    return {
      clipName: clipName,
      duration: duration,
      tracks: tracks
    }
  },

  CreateClipsFromMorphTargetSequences: function (morph, fps) {
    return {}
  }
}

function parseAnimations( json, geometry ) {

  var outputAnimations = [];

  // parse old style Bone/Hierarchy animations
  var animations = [];

  if ( json.animation !== undefined ) {

    animations.push( json.animation );

  }

  if ( json.animations !== undefined ) {

    if ( json.animations.length ) {

      animations = animations.concat( json.animations );

    } else {

      animations.push( json.animations );

    }

  }

  for ( var i = 0; i < animations.length; i ++ ) {

    var clip = AnimationClip.parseAnimation( animations[ i ], geometry.bones );
    if ( clip ) outputAnimations.push( clip );

  }

  // parse implicit morph animations
  if ( geometry.morphTargets ) {

    // TODO: Figure out what an appropraite FPS is for morph target animations -- defaulting to 10, but really it is completely arbitrary.
    var morphAnimationClips = AnimationClip.CreateClipsFromMorphTargetSequences( geometry.morphTargets, 10 );
    outputAnimations = outputAnimations.concat( morphAnimationClips );

  }

  if ( outputAnimations.length > 0 ) geometry.animations = outputAnimations;

}


function parse (json) {
  var geometry = {
    faceVertexUvs: [],
    vertexNormals: [],
    vertices: [],
    faces: [],
    skinWeights: [],
    skinIndices: []
  }
  parseModel(json, geometry)
  parseSkin(json, geometry)
  parseAnimations(json, geometry)
  return geometry
}
module.exports = parse
