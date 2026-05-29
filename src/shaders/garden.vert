// =====================================================================
// garden.vert — ASCII vegetation. Each point's plant silhouette (blades,
// fan, static bend, bloom) is baked into aOffset; the shader grows it from
// the base and applies WIND sway (bend by t² so tips move most). Density-
// ramp glyphs, warm, brighter toward tips. Pairs with points.frag.
// =====================================================================

#include ./lib/noise.glsl;

attribute vec3  aOffset;    // local silhouette position within the plant
attribute float aT;         // 0 at base … 1 at tip
attribute float aWindPhase;
attribute float aColorMix;
attribute float aSeed;

uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uPixelRatio;
uniform float uReveal;
uniform float uGlyphCount;
uniform float uWindStrength;
uniform float uWindSpeed;

varying float vGlyph;
varying float vBright;
varying float vAlpha;

void main() {
  vec3 base = position;
  float t = aT;

  float g = clamp(uReveal * 1.3 - t * 0.3, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  vec3 local = vec3(aOffset.x, aOffset.y * g, aOffset.z);

  // wind: broad gust + slowly drifting direction + per-plant tremble
  vec2 wsamp = base.xz * 0.08 + vec2(uTime * 0.05 * uWindSpeed, uTime * 0.03 * uWindSpeed);
  float windNoise = snoise(vec3(wsamp, 0.0));
  float dirNoise = snoise(vec3(base.xz * 0.04 + uTime * 0.02, 7.0));
  float windAngle = dirNoise * 6.2831853;
  vec2 windDir = vec2(cos(windAngle), sin(windAngle));
  float gust = (0.4 + windNoise) * uWindStrength;
  float fine = sin(uTime * 2.0 + aWindPhase + aSeed * 6.2831853) * 0.05 * t;

  local.x += windDir.x * gust * t * t + fine;
  local.z += windDir.y * gust * t * t;

  vec3 pos = base + local;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (uScale / max(-mv.z, 0.1));

  float flick = 0.9 + 0.1 * sin(uTime * 1.5 + aSeed * 30.0);
  vBright = clamp((0.4 + 0.5 * t) * mix(0.8, 1.2, aColorMix) * flick, 0.0, 1.0);
  vGlyph = floor(vBright * (uGlyphCount - 1.0) + 0.5);
  vAlpha = uReveal * (0.5 + 0.45 * aColorMix) * g;
}
