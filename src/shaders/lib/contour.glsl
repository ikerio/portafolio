// =====================================================================
// contour.glsl — anti-aliased topographic isolines from a scalar height.
// Reads as contour lines, never wireframe. Shared chunk.
// =====================================================================

// h: the scalar (world height). freq: lines per unit. thickness: 0..1 line
// width as a fraction of the band. Uses fwidth for resolution-independent AA.
float contourLine(float h, float freq, float thickness) {
  float scaled = h * freq;
  float f = fract(scaled);
  // distance to nearest integer band edge (0 or 1)
  float dist = min(f, 1.0 - f);
  float aa = fwidth(scaled) * 1.2 + 1e-5;
  // line = 1 at the band edge, fading out over `thickness`
  return 1.0 - smoothstep(thickness * 0.5, thickness * 0.5 + aa, dist);
}
