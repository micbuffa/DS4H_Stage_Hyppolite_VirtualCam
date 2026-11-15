/** Original local effects; source textures and camera definitions stay untouched. */
export const graphicTransitionFunctions = `
float graphicNoise(vec2 cell) {
  float value = mod(cell.y * 37.0 + cell.x * 61.0 + gridSeed * 17.0, 4093.0);
  return mod(value * 61.0 + 19.0, 4093.0) / 4093.0;
}
float proceduralLuminance(vec2 uv) {
  vec2 coordinate = uv * gridSize, cell = floor(coordinate);
  vec2 f = smoothstep(vec2(0.0), vec2(1.0), fract(coordinate));
  return mix(mix(graphicNoise(cell), graphicNoise(cell + vec2(1.0, 0.0)), f.x),
    mix(graphicNoise(cell + vec2(0.0, 1.0)), graphicNoise(cell + vec2(1.0)), f.x), f.y);
}
vec4 graphicTransition(vec2 uv) {
  float p = smoothstep(0.0, 1.0, progress);
  if (effectMode < 6.5) {
    float phase = min(7.0, floor(progress * 8.0));
    float band = min(gridSize.y - 1.0, floor(uv.y * gridSize.y));
    float offset = (graphicNoise(vec2(phase, band)) * 2.0 - 1.0) * strength * 0.08 * 4.0 * progress * (1.0 - progress);
    vec2 sampleUV = clamp(uv + vec2(offset, 0.0), vec2(0.0), vec2(1.0));
    return linearBlend(texture2D(sourceA, sampleUV), texture2D(sourceB, sampleUV), p);
  }
  if (effectMode < 7.5) {
    vec2 aUV = (uv - 0.5) / (1.0 + strength * p) + 0.5;
    vec2 bUV = (uv - 0.5) / (1.0 + strength * (1.0 - p)) + 0.5;
    return linearBlend(texture2D(sourceA, aUV), texture2D(sourceB, bUV), p);
  }
  if (effectMode < 8.5) {
    float mask = proceduralLuminance(uv), feather = strength * 0.1;
    float threshold = 1.0 + feather - progress * (1.0 + 2.0 * feather);
    float weight = feather == 0.0 ? step(threshold, mask) : smoothstep(threshold - feather, threshold + feather, mask);
    return linearBlend(texture2D(sourceA, uv), texture2D(sourceB, uv), weight);
  }
  float boundary = progress < 0.25 ? 1.0 - 0.5 * smoothstep(0.0, 1.0, progress * 4.0)
    : progress <= 0.75 ? 0.5 : 0.5 * (1.0 - smoothstep(0.0, 1.0, (progress - 0.75) * 4.0));
  bool from = uv.x < boundary;
  float width = from ? boundary : 1.0 - boundary;
  vec2 sampleUV = vec2((uv.x - (from ? 0.0 : boundary)) / max(width, 0.000001), (uv.y - 0.5) / max(width, 0.000001) + 0.5);
  if (sampleUV.y < 0.0 || sampleUV.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  sampleUV = clamp(sampleUV, vec2(0.0), vec2(1.0));
  return from ? texture2D(sourceA, sampleUV) : texture2D(sourceB, sampleUV);
}
`;
