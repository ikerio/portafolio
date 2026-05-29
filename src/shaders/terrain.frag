// =====================================================================
// terrain.frag — matte relief shading: contour isolines + luminous dot
// field + warm top-right grazing light + path emphasis + distance haze.
// Reads as a high-end topographic design object, not a game terrain.
// (three injects `precision highp float;` for fragment shaders.)
// =====================================================================

#include ./lib/light.glsl;
#include ./lib/contour.glsl;

uniform float uTime;
uniform float uContourFrequency;
uniform float uContourThickness;
uniform vec3  uContourColor;
uniform float uDotDensity;
uniform float uDotSize;
uniform float uDotIntensity;
uniform float uDotFlicker;
uniform float uDotBand;   // dot gate width as a multiple of contour thickness
uniform vec3  uDotColor;
uniform vec3  uBaseColor;
uniform vec3  uAmber;
uniform vec3  uHazeColor;
uniform float uHazeDensity;
uniform vec3  uLightDir;
uniform vec3  uCameraPos;
uniform float uWorldSize;
uniform float uPathValleyWidth;
uniform float uReveal;
uniform float uStrataAmount;
uniform float uStrataStep;
uniform float uRipple;     // Discos chapter active
uniform float uAudioLevel; // 0..1, pulses the dots to the beat

varying vec3  vWorldPos;
varying float vElevation;
varying float vPathDist;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  // Geometric normal from world-position derivatives (cheap, robust).
  vec3 n = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  float graze = grazing(n, uLightDir);

  // Warm light gradient mapped from world XZ → [0,1] (top-right hot).
  vec2 luv = vWorldPos.xz / uWorldSize + 0.5;
  float lg = lightAt(luv);

  float pathEmph = 1.0 - smoothstep(0.0, uPathValleyWidth * 1.4, vPathDist);

  // Matte base.
  vec3 col = uBaseColor * (0.45 + 0.65 * graze) * (0.55 + 0.55 * lg);

  // Contour isolines — kept VERY faint and continuous; the dots (below) are
  // what actually draw the lines, as in the reference. The solid line is just
  // a whisper underneath so the topography reads even between beads.
  float c = contourLine(vElevation, uContourFrequency, uContourThickness);
  col += uContourColor * c * (0.12 + 0.4 * lg) * graze * 0.2;
  col += uAmber * pathEmph * 0.05;

  // Luminous dots: a dense grid concentrated ALONG the contour bands so the
  // isolines read as strings of beads (the dominant feature). A faint sprinkle
  // remains off-line so the surface isn't empty between contours.
  float band = contourLine(vElevation, uContourFrequency, uContourThickness * uDotBand);
  vec2 g = vWorldPos.xz * uDotDensity;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  float rnd = hash21(cell);
  float dotShape = 1.0 - smoothstep(uDotSize * 0.35, uDotSize, length(f));
  float dots = dotShape * step(0.5, rnd) * (0.14 + 0.86 * band);
  float flick = 1.0 - uDotFlicker * (0.5 + 0.5 * sin(uTime * 2.0 + rnd * 40.0));
  col += uDotColor * dots * uDotIntensity * (0.45 + 0.75 * lg) * flick
         * (0.75 + 0.5 * pathEmph) * (1.0 + uAudioLevel * uRipple * 0.9);

  // Strata (Foundations): calm the dotted field and add glowing horizontal
  // sediment bands at regular world-height intervals — the ground reads as layers.
  if (uStrataAmount > 0.001) {
    col *= (1.0 - 0.55 * uStrataAmount);
    float band = contourLine(vWorldPos.y, 1.0 / uStrataStep, uContourThickness * 3.0);
    col += uContourColor * band * uStrataAmount * (0.5 + 0.6 * lg) * (0.4 + 0.6 * graze);
  }

  // Distance haze toward the background (mirrors FogExp2 feel for the custom shader).
  float dist = distance(vWorldPos, uCameraPos);
  float fog = 1.0 - exp(-uHazeDensity * dist);
  col = mix(col, uHazeColor, clamp(fog, 0.0, 1.0));

  // Gentle brightness lift with the reveal — the flat map is already visible
  // at load (uReveal 0); the relief just brightens slightly as it rises.
  col *= (0.62 + 0.38 * uReveal);

  gl_FragColor = vec4(col, 1.0);
}
