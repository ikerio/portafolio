// =====================================================================
// points.frag — samples an ASCII glyph atlas (one row of cells) for the
// hero. The glyph index (vGlyph) selects the cell; gl_PointCoord indexes
// within it. Warm ivory → hot sand by brightness. Normal-blended so dense
// areas read as solid shaded ASCII rather than blown-out glow.
// =====================================================================

uniform sampler2D uGlyphAtlas;
uniform float uGlyphCount;
uniform vec3 uColorCore; // hot center
uniform vec3 uColorWarm; // warm ivory
uniform float uAlphaCut; // >0 → discard faint fragments (opaque cutout, for depth-occluded clouds)

varying float vGlyph;
varying float vBright;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord;
  float cw = 1.0 / uGlyphCount;
  vec2 atlasUv = vec2((vGlyph + uv.x) * cw, uv.y);
  float mask = texture2D(uGlyphAtlas, atlasUv).a;
  if (mask < 0.06) discard;

  float a = mask * vAlpha;
  // Cutout: with depth-write on (e.g. the self-portrait), discarding faint
  // fragments lets front glyphs occlude the back/interior instead of bleeding
  // through. uAlphaCut defaults to 0 → no effect for the additive clouds.
  if (a < uAlphaCut) discard;

  vec3 col = mix(uColorWarm, uColorCore, clamp(vBright, 0.0, 1.0));
  gl_FragColor = vec4(col, a);
}
