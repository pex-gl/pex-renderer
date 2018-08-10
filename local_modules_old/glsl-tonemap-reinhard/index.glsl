//Based on Filmic Tonemapping Operators http://filmicgames.com/archives/75
vec3 tonemapReinhard(vec3 color) {
  return color / (color + vec3(1.0));
}

#pragma glslify: export(tonemapReinhard)
