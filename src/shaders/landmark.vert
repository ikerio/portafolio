// =====================================================================
// landmark.vert — ASCII glyph-cloud sculpture. Points are sampled on a
// mesh surface (aNormal carried for shading). They ASSEMBLE from a
// scattered cloud into the surface as uReveal 0→1 (curl-noise flow during
// transit), and brighten/scale with uFocus when the landmark is the
// protagonist. Pairs with points.frag (shared glyph atlas).
// =====================================================================

#include ./lib/noise.glsl;
#include ./lib/light.glsl;

attribute vec3  aNormal;
attribute vec3  aScatter; // random offset direction the point flies in from
attribute float aSeed;

uniform float uReveal;   // 0 = dispersed/hidden, 1 = assembled
uniform float uFocus;    // 0 = background, 1 = protagonist
uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uScatter;  // spread magnitude
uniform float uPixelRatio;
uniform float uGlyphCount;
uniform float uCullBack; // 1 = hide points whose normal faces away from camera
uniform vec3  uLightDir;

varying float vGlyph;
varying float vBright;
varying float vAlpha;

void main() {
  float r = clamp(uReveal, 0.0, 1.0);
  float er = r * r * (3.0 - 2.0 * r);

  vec3 scattered = position + aScatter * uScatter;
  vec3 flow = curlNoise(position * 0.3 + aSeed * 5.0 + vec3(0.0, 0.0, uTime * 0.03));
  scattered += flow * (1.0 - er) * uScatter * 0.5;
  vec3 pos = mix(scattered, position, er);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  // Backface culling (solid mode): hide points whose surface normal faces away
  // from the camera, so the model's back/interior never shows through the gaps
  // between glyphs. The visible near surface reads as a clean solid shape.
  if (uCullBack > 0.5) {
    vec3 vn = normalize(normalMatrix * aNormal);
    // Cull a little past true back-facing (0.08) so grazing far-side/rim points
    // don't poke through the front (e.g. the back of the head above the hair).
    if (dot(vn, normalize(-mv.xyz)) < 0.08) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
  }

  gl_Position = projectionMatrix * mv;

  gl_PointSize = uSize * uPixelRatio * (uScale / max(-mv.z, 0.1))
                 * (0.55 + 0.45 * er) * (0.85 + 0.3 * uFocus);

  // Shading from the surface normal against the warm top-right light.
  float grz = grazing(aNormal, uLightDir);
  float flick = 0.9 + 0.1 * sin(uTime * 1.3 + aSeed * 30.0);
  vBright = clamp((0.22 + grz * 0.7) * (0.55 + 0.55 * uFocus) * flick, 0.0, 1.0);
  vGlyph = floor(vBright * (uGlyphCount - 1.0) + 0.5);
  // faint while a scattered cloud (er≈0), full once assembled (er≈1)
  vAlpha = (0.18 + 0.82 * er) * (0.5 + 0.5 * uFocus);
}
