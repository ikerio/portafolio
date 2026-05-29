// =====================================================================
// road.vert — the luminous ASCII bead-road along the route. Beads sit on
// the path with a little lateral scatter; a brightness pulse travels along
// the route length (aT) so the road reads as flowing light. uReveal fades
// it in as the journey lights up. Pairs with points.frag (glyph atlas).
// =====================================================================

attribute float aSeed;
attribute float aBright;
attribute float aT; // 0..1 position along the route
attribute float aKeep; // 0..1; bead shows when aKeep <= uDensity

uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uPixelRatio;
uniform float uReveal;
uniform float uGlyphCount;
uniform float uFlowSpeed;
uniform float uYOffset; // lift/lower the whole road to sit in the valley
uniform float uDensity; // 0..1 fraction of beads shown

varying float vGlyph;
varying float vBright;
varying float vAlpha;

void main() {
  // density culling — hide beads above the threshold
  if (aKeep > uDensity) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  vec3 pos = position;
  pos.y += uYOffset + sin(uTime * 0.8 + aSeed * 30.0) * 0.05; // offset + faint shimmer

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (uScale / max(-mv.z, 0.1));

  // Brightness pulse flowing along the road.
  float flow = 0.5 + 0.5 * sin(aT * 42.0 - uTime * uFlowSpeed + aSeed * 2.0);
  vBright = clamp(aBright * 0.55 + flow * 0.55, 0.0, 1.0);
  vGlyph = floor(vBright * (uGlyphCount - 1.0) + 0.5);
  vAlpha = uReveal * (0.35 + 0.65 * flow);
}
