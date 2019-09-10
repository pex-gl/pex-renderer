module.exports = /* glsl */ `
#ifdef USE_METALLIC_ROUGHNESS_WORKFLOW

  // Source: Google/Filament/Overview/4.8.3.3 Roughness remapping and clamping, 07/2019
  // Minimum roughness to avoid division by zerio when 1/a^2 and to limit specular aliasing
  // This could be 0.045 when using single precision float fp32
  #define MIN_ROUGHNESS 0.089

  #ifdef USE_METALLIC_ROUGHNESS_MAP
    // R = ?, G = roughness, B = metallic
    uniform sampler2D uMetallicRoughnessMap;

    #ifdef USE_METALLIC_ROUGHNESS_MAP_TEX_COORD_TRANSFORM
      uniform mat3 uMetallicRoughnessMapTexCoordTransform;
    #endif

    // TODO: sampling the same texture twice
    void getMetallic(inout PBRData data) {
      #ifdef USE_METALLIC_ROUGHNESS_MAP_TEX_COORD_TRANSFORM
        vec2 texCoord = getTextureCoordinates(data, METALLIC_ROUGHNESS_MAP_TEX_COORD_INDEX, uMetallicRoughnessMapTexCoordTransform);
      #else
        vec2 texCoord = getTextureCoordinates(data, METALLIC_ROUGHNESS_MAP_TEX_COORD_INDEX);
      #endif
      vec4 texelColor = texture2D(uMetallicRoughnessMap, texCoord);
      data.metallic = texelColor.b;
      data.roughness = texelColor.g;
    }

    void getRoughness(inout PBRData data) {
      // NOP, already read in getMetallic
    }
  #else
    uniform float uMetallic;
    uniform float uRoughness;

    #ifdef USE_METALLIC_MAP
      uniform sampler2D uMetallicMap; //assumes linear, TODO: check gltf

      #ifdef USE_METALLIC_MAP_TEX_COORD_TRANSFORM
        uniform mat3 uMetallicMapTexCoordTransform;
      #endif

      void getMetallic(inout PBRData data) {
        #ifdef USE_METALLIC_MAP_TEX_COORD_TRANSFORM
          vec2 texCoord = getTextureCoordinates(data, METALLIC_MAP_TEX_COORD_INDEX, uMetallicMapTexCoordTransform);
        #else
          vec2 texCoord = getTextureCoordinates(data, METALLIC_MAP_TEX_COORD_INDEX);
        #endif
        data.metallic = uMetallic * texture2D(uMetallicMap, texCoord).r;
      }
    #else
      void getMetallic(inout PBRData data) {
        data.metallic = uMetallic;
      }
    #endif

    #ifdef USE_ROUGHNESS_MAP
      uniform sampler2D uRoughnessMap; //assumes linear, TODO: check glTF

      #ifdef USE_ROUGHNESS_MAP_TEX_COORD_TRANSFORM
        uniform mat3 uRoughnessMapTexCoordTransform;
      #endif

      void getRoughness(inout PBRData data) {
        #ifdef USE_ROUGHNESS_MAP_TEX_COORD_TRANSFORM
          vec2 texCoord = getTextureCoordinates(data, ROUGHNESS_MAP_TEX_COORD_INDEX, uRoughnessMapTexCoordTransform);
        #else
          vec2 texCoord = getTextureCoordinates(data, ROUGHNESS_MAP_TEX_COORD_INDEX);
        #endif
        data.roughness = uRoughness * texture2D(uRoughnessMap, getTextureCoordinates(data, ROUGHNESS_MAP_TEX_COORD_INDEX)).r + 0.01;
      }
    #else
      void getRoughness(inout PBRData data) {
        data.roughness = uRoughness + 0.01;
      }
    #endif
  #endif
#endif
`
