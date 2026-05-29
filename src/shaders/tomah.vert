// =====================================================================
// tomah.vert — the Tomah landmark (AI video generation). Glyph-cloud points
// for a tumbling torus + a cube shuttling through its centre (the torus/cube
// motion is on the object transforms). Here: a hover MORPH (pseudo-turbulence
// shimmer), a screen-space hover REPEL away from the cursor, and a generative
// FLICKER so points "resolve" like a frame being synthesized. Pairs with
// points.frag (glyph atlas).
// =====================================================================

attribute vec3 aNormal;
attribute float aSeed;

uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uPixelRatio;
uniform float uReveal;
uniform float uGlyphCount;
uniform vec3 uLightDir;
uniform vec2 uCursor; // NDC pointer
uniform float uHover; // 0..1 (cursor over the object)
uniform float uAspect; // viewport width/height — keeps the repel circular
uniform float uRepelRadius;
uniform float uRepelStrength;
uniform float uMorphAmt;

varying float vGlyph;
varying float vBright;
varying float vAlpha;

void main() {
  vec3 pos = position;

  // Hover morph — gentle pseudo-turbulence shimmer when hovered.
  pos += sin(pos.yzx * 1.6 + uTime * 2.2) * (uHover * uMorphAmt);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec4 clip = projectionMatrix * mv;

  // Hover repel — push points away from the cursor. Measure distance in
  // screen-proportional space (x scaled by aspect) so the falloff is a true
  // circle, then convert the push back to NDC so it's radial on screen.
  vec2 ndc = clip.xy / clip.w;
  vec2 d = ndc - uCursor;
  d.x *= uAspect;
  float rep = smoothstep(uRepelRadius, 0.0, length(d)) * uHover;
  vec2 push = normalize(d + 1e-5) * rep * uRepelStrength;
  push.x /= uAspect;
  ndc += push;
  clip.xy = ndc * clip.w;
  gl_Position = clip;

  gl_PointSize = uSize * uPixelRatio * (uScale / max(-mv.z, 0.1)) * (1.0 + rep * 0.6);

  // World-space lambert against the warm key light (rotates correctly as the
  // object tumbles).
  vec3 wn = normalize(mat3(modelMatrix) * aNormal);
  float grz = max(0.0, dot(wn, normalize(uLightDir)));

  // Generative flicker — points resolve/flicker like a frame being generated.
  float flick = 0.6 + 0.4 * sin(uTime * 3.0 + aSeed * 47.0);

  vBright = clamp((0.28 + grz * 0.6) * (0.75 + 0.5 * rep), 0.0, 1.0);
  vGlyph = floor(vBright * (uGlyphCount - 1.0) + 0.5);
  vAlpha = uReveal * (0.55 + 0.45 * flick);
}
