// =====================================================================
// points.vert — ASCII glyph cloud for "IT" → "IKER TOLEDO". Each point is
// a glyph sprite; the glyph index is chosen from a per-point brightness so
// the wordmark reads as shaded ASCII sculpture (not soft particles).
// position = source ("IT") grid sample; aTarget = full-name sample (equal
// count, cycled). aShade = letterform coverage; aSeed varies flicker.
// Curl-noise dispersion bulges mid-morph then resolves.
// =====================================================================

#include ./lib/noise.glsl;

attribute vec3  aTarget;
attribute float aSeed;
attribute float aShade;

uniform float uMorphProgress; // 0 = IT, 1 = IKER TOLEDO
uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uDispersion;
uniform float uPixelRatio;
uniform float uOpacity;
uniform float uGlyphCount;

varying float vGlyph;
varying float vBright;
varying float vAlpha;

void main() {
  float p = clamp(uMorphProgress, 0.0, 1.0);
  p = p * p * (3.0 - 2.0 * p);

  vec3 pos = mix(position, aTarget, p);

  // Dispersion bulges out mid-morph (sin envelope) and settles into the target.
  float env = sin(p * 3.14159265);
  float disp = env * uDispersion;
  vec3 flow = curlNoise(pos * 0.18 + vec3(0.0, 0.0, uTime * 0.04) + aSeed * 10.0);
  pos += flow * disp;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  gl_PointSize = uSize * uPixelRatio * (uScale / max(-mv.z, 0.1));

  // Shading: warm light brightens toward the top-right; coverage lifts the
  // core; the z-extrusion makes front layers brighter than back ones so the
  // wordmark reads as a 3D ASCII solid. Drives which glyph is chosen.
  float lit = 0.4 + 0.6 * smoothstep(-3.5, 3.5, pos.x * 0.6 + pos.y * 0.7);
  float depthShade = 0.5 + 0.5 * smoothstep(-1.3, 1.3, pos.z);
  float flick = 0.92 + 0.08 * sin(uTime * 1.4 + aSeed * 30.0);
  vBright = clamp((aShade * 0.32 + lit * 0.5 + depthShade * 0.32) * flick, 0.0, 1.0);

  vGlyph = floor(vBright * (uGlyphCount - 1.0) + 0.5);
  vAlpha = uOpacity * mix(1.0, 0.65, env);
}
