// =====================================================================
// terrain.vert — FBM displacement of a high-subdivision plane (pre-rotated
// into the XZ plane in JS, so local xz == world xz and we displace +Y).
// A path-valley term lowers the relief along the authored 2D route.
// ShaderMaterial supplies position/uv/modelMatrix/viewMatrix/projectionMatrix.
// =====================================================================

#include ./lib/noise.glsl;

uniform float uTime;
uniform float uElevationScale;
uniform float uNoiseFrequency;
uniform int   uNoiseOctaves;
uniform float uPathValleyDepth;
uniform float uPathValleyWidth;
uniform float uWaveAmount; // 0 = topo, 1 = wave-field (Systems chapter)
uniform float uWaveAmp;
uniform float uWaveFreq;
uniform float uWaveSpeed;
uniform float uStrataAmount; // 0 = topo, 1 = terraced sediment (Foundations)
uniform float uStrataStep;
uniform float uFlatten;       // 0..1 — flatten a clearing (for the garden)
uniform vec2  uFlattenCenter; // world xz
uniform float uFlattenRadius;
uniform float uFlattenLevel;  // target ground height in the clearing
uniform float uRipple;        // 0..1 — audio-reactive sound rings (Discos)
uniform vec2  uRippleCenter;
uniform float uRippleFreq;
uniform float uRippleSpeed;
uniform float uRippleAmp;
uniform float uAudioBass;     // 0..1, drives ripple amplitude
uniform vec2  uPathPoints[64];
uniform int   uPathCount;
uniform float uReveal; // 0..1 terrain rises into place

varying vec3  vWorldPos;
varying float vElevation;
varying float vPathDist;

// Shortest distance from p to the path polyline (world XZ).
float distToPath(vec2 p) {
  float d = 1e9;
  for (int i = 0; i < 63; i++) {
    if (i >= uPathCount - 1) break;
    vec2 a = uPathPoints[i];
    vec2 b = uPathPoints[i + 1];
    vec2 pa = p - a;
    vec2 ba = b - a;
    float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
    d = min(d, length(pa - ba * t));
  }
  return d;
}

void main() {
  vec3 pos = position;          // (x, 0, z)
  vec2 xz = pos.xz;

  // Slow drift gives the relief life (the isolines breathe). Kept gentle so
  // they read as a living topographic map, not foam.
  float e = fbm(vec3(xz * uNoiseFrequency, uTime * 0.02), uNoiseOctaves);
  e = e * 0.5 + 0.5;            // ~0..1
  float elev = e * uElevationScale;

  float pd = distToPath(xz);
  vPathDist = pd;
  float valley = (1.0 - smoothstep(0.0, uPathValleyWidth, pd)) * uPathValleyDepth;
  elev -= valley;

  // Strata: terrace the elevation into discrete sediment layers (Foundations).
  float strataE = floor(elev / uStrataStep) * uStrataStep;
  elev = mix(elev, strataE, uStrataAmount);

  // Wave-field: a flowing surface that the terrain morphs into for the Systems
  // chapter (uWaveAmount 0→1). Animated so the dunes of dots flow.
  float wsum =
      sin(xz.x * uWaveFreq + uTime * uWaveSpeed) * 0.5
    + sin(xz.y * uWaveFreq * 0.8 - uTime * uWaveSpeed * 0.8) * 0.5
    + fbm(vec3(xz * uWaveFreq * 0.6 + vec2(0.0, uTime * uWaveSpeed * 0.3), 0.0), 3);
  float waveElev = wsum * uElevationScale * uWaveAmp;
  elev = mix(elev, waveElev, uWaveAmount);

  // Local flatten — carve a level clearing around a center (the garden ground),
  // smoothly blending back into the relief at the edge.
  float fdist = distance(xz, uFlattenCenter);
  float fmask = (1.0 - smoothstep(uFlattenRadius * 0.55, uFlattenRadius, fdist)) * uFlatten;
  elev = mix(elev, uFlattenLevel, fmask);

  // Audio-reactive sound ripples (Discos) — concentric rings from the station,
  // decaying outward, amplitude pulsing with the bass.
  if (uRipple > 0.001) {
    float rd = distance(xz, uRippleCenter);
    float ring = sin(rd * uRippleFreq - uTime * uRippleSpeed) * exp(-rd * 0.025);
    elev += ring * uRippleAmp * (0.3 + 1.2 * uAudioBass) * uRipple;
  }

  // Shading (contours + dots) uses this elevation, so the pattern follows the
  // current surface — topo isolines, dots riding the wave crests, or the rings.
  vElevation = elev;
  pos.y += elev * uReveal;

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorldPos = world.xyz;

  gl_Position = projectionMatrix * viewMatrix * world;
}
