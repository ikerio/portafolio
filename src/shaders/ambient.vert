// =====================================================================
// ambient.vert — sparse drifting ASCII glyphs (atmosphere around a beat).
// Points slowly flow on curl noise + a gentle bob; per-point brightness
// picks the glyph. Global uOpacity fades the whole field in/out with the
// beat. Pairs with points.frag (shared glyph atlas).
// =====================================================================

#include ./lib/noise.glsl;

attribute float aSeed;
attribute float aBright;

uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uGlyphCount;
uniform float uDrift;

varying float vGlyph;
varying float vBright;
varying float vAlpha;

void main() {
  vec3 pos = position;
  vec3 flow = curlNoise(position * 0.08 + aSeed * 7.0 + vec3(0.0, 0.0, uTime * 0.02));
  pos += flow * uDrift;
  pos.y += sin(uTime * 0.3 + aSeed * 20.0) * 0.3;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (uScale / max(-mv.z, 0.1));

  float flick = 0.7 + 0.3 * sin(uTime * 1.5 + aSeed * 30.0);
  vBright = clamp(aBright * flick, 0.0, 1.0);
  vGlyph = floor(vBright * (uGlyphCount - 1.0) + 0.5);
  vAlpha = uOpacity * (0.3 + 0.6 * aBright);
}
