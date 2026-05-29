// =====================================================================
// light.glsl — warm top-right grazing light, matching ascii.js lightAt().
// Shared chunk.
// =====================================================================

// Screen/UV-space warm gradient, brightest toward the top-right corner.
// nuv in [0,1]; returns a 0..~1.15 brightness multiplier.
float lightAt(vec2 nuv) {
  vec2 src = vec2(1.02, 1.06); // top-right (y up)
  float d = distance(nuv, src);
  return clamp(1.15 - d * 0.92, 0.0, 1.2);
}

// Lambert term against a fixed world light direction, lifted so shadows
// stay warm-grey rather than black (matte studio feel).
float grazing(vec3 normal, vec3 lightDir) {
  float diff = max(dot(normalize(normal), normalize(lightDir)), 0.0);
  return clamp(diff * 0.8 + 0.2, 0.0, 1.0);
}
