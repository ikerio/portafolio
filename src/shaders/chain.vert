// =====================================================================
// chain.vert — the Witzil chain (blockchain donation transparency). Glyph
// points form a rising helix of linked ledger blocks. A single bright
// "transaction" pulse climbs the chain (aT = height) and lights each block in
// turn as it passes — funds traced, block by block, to their destination — over
// an always-visible baseline. A fainter trailing pulse adds richness; the pulse
// also swells the points. Pairs with points.frag (glyph atlas).
// =====================================================================

attribute float aSeed;
attribute float aBright; // baseline brightness
attribute float aT; // 0..1 height up the chain — the pulse climbs this
attribute float aIsBlock; // 1 = block edge, 0 = link bead

uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uPixelRatio;
uniform float uReveal;
uniform float uGlyphCount;
uniform float uFlowSpeed; // chain climbs per second

varying float vGlyph;
varying float vBright;
varying float vAlpha;

// Narrow band centred on `head`, wrapping over 0..1 so it loops smoothly.
float band(float t, float head, float width) {
  float d = t - head;
  d = d - floor(d + 0.5); // wrap to [-0.5, 0.5]
  return exp(-d * d / width);
}

void main() {
  vec3 pos = position;
  pos.y += sin(uTime * 0.8 + aSeed * 30.0) * 0.04; // faint shimmer

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  // The climbing transaction (+ a fainter trailing one).
  float head = fract(uTime * uFlowSpeed);
  float pulse = band(aT, head, 0.012);
  pulse = max(pulse, band(aT, fract(uTime * uFlowSpeed + 0.5), 0.025) * 0.5);

  float baseB = aBright * (0.45 + 0.2 * aIsBlock); // blocks read a touch brighter
  vBright = clamp(baseB + pulse * 0.9, 0.0, 1.0);
  vGlyph = floor(vBright * (uGlyphCount - 1.0) + 0.5);
  vAlpha = uReveal * clamp(0.3 + baseB * 0.45 + pulse * 0.85, 0.0, 1.0);

  gl_PointSize = uSize * uPixelRatio * (uScale / max(-mv.z, 0.1)) * (1.0 + pulse * 0.9);
}
