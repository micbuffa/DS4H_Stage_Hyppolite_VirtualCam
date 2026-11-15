/** Original procedural GLSL. One pair of live samplers for the entire grid. */
export const gridTransitionFunctions = `
uniform vec2 gridSize;
uniform float gridSeed;
uniform float strength;
float cellOrder(vec2 cell) {
  float value = mod((cell.y * gridSize.x + cell.x) * 37.0 + gridSeed * 17.0, 4093.0);
  return mod(value * 61.0 + 19.0, 4093.0) / 4093.0;
}
vec4 linearBlend(vec4 a, vec4 b, float p) {
  return vec4(toGammaSpace(mix(toLinearSpace(a.rgb), toLinearSpace(b.rgb), p)), 1.0);
}
vec4 gridTransition(vec2 uv) {
  vec2 cell = min(floor(uv * gridSize), gridSize - 1.0);
  vec2 local = uv * gridSize - cell;
  float order = cellOrder(cell);
  float p = clamp((progress - order * 0.4) / 0.6, 0.0, 1.0);
  if (effectMode < 3.5) {
    // Orthographic projection of two adjacent cube faces rotating through 90 degrees.
    // Their union always covers the cell; clipping the silhouette prevents overlaps.
    float angle = p * 1.57079632679;
    float c = cos(angle), s = sin(angle);
    float x = local.x - 0.5;
    float seam = 0.5 * (c - s);
    bool nextFace = x >= seam;
    float faceX = nextFace ? (x - seam) / max(s, 0.00001) : (x + 0.5 * (c + s)) / max(c, 0.00001);
    vec2 sampleUV = (cell + vec2(clamp(faceX, 0.0, 1.0), local.y)) / gridSize;
    vec4 color = nextFace ? texture2D(sourceB, sampleUV) : texture2D(sourceA, sampleUV);
    float light = 1.0 - strength * 0.65 * (1.0 - (nextFace ? s : c));
    return vec4(toGammaSpace(toLinearSpace(color.rgb) * light), 1.0);
  }
  if (effectMode < 4.5) {
    return linearBlend(texture2D(sourceA, uv), texture2D(sourceB, uv), smoothstep(0.0, 1.0, p));
  }
  // Zero displacement at every cell boundary and both temporal endpoints.
  float envelope = sin(local.x * 3.14159265359) * sin(local.y * 3.14159265359) * sin(p * 3.14159265359);
  vec2 direction = vec2(cos(order * 6.28318530718), sin(order * 6.28318530718));
  vec2 offset = direction * envelope * strength * 0.8 / gridSize;
  vec2 aUV = clamp(uv - offset, vec2(0.0), vec2(1.0));
  vec2 bUV = clamp(uv + offset, vec2(0.0), vec2(1.0));
  return linearBlend(texture2D(sourceA, aUV), texture2D(sourceB, bUV), smoothstep(0.0, 1.0, p));
}
`;
