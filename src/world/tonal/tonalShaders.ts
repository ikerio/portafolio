/* =====================================================================
   tonalShaders — VERBATIM GLSL ported from EchoIsleV1.1/TonalViewer.jsx.
   Audio uniforms (uAudioBass/Mid/High) are kept but always fed 0 in the
   vanilla port: at 0 the formulas reduce exactly to the silent baseline,
   so leaving the GLSL intact is byte-for-byte faithful to the source.
   sharedNoiseGLSL is prepended to BOTH the body and sparkle vertex shaders.
   ===================================================================== */

// hash / noise3d / curlNoise / applyEarRotation / bodyDisplacement.
// MUST be present identically in the body vertex shader AND the sparkle
// vertex shader (they sample the same deformed surface).
export const sharedNoiseGLSL = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3d(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(
      mix(hash(i + vec3(0.0,0.0,0.0)), hash(i + vec3(1.0,0.0,0.0)), f.x),
      mix(hash(i + vec3(0.0,1.0,0.0)), hash(i + vec3(1.0,1.0,0.0)), f.x), f.y),
    mix(
      mix(hash(i + vec3(0.0,0.0,1.0)), hash(i + vec3(1.0,0.0,1.0)), f.x),
      mix(hash(i + vec3(0.0,1.0,1.0)), hash(i + vec3(1.0,1.0,1.0)), f.x), f.y),
    f.z);
}

vec3 curlNoise(vec3 p) {
  float eps = 0.5;
  float n1x = noise3d(p + vec3(eps, 0.0, 0.0));
  float n2x = noise3d(p - vec3(eps, 0.0, 0.0));
  float n1y = noise3d(p + vec3(0.0, eps, 0.0));
  float n2y = noise3d(p - vec3(0.0, eps, 0.0));
  float n1z = noise3d(p + vec3(0.0, 0.0, eps));
  float n2z = noise3d(p - vec3(0.0, 0.0, eps));
  return vec3((n1y-n2y) - (n1z-n2z),
              (n1z-n2z) - (n1x-n2x),
              (n1x-n2x) - (n1y-n2y)) * 2.0;
}

vec3 applyEarRotation(vec3 p, float yaw, float pitch) {
  float cp = cos(pitch), sp = sin(pitch);
  float cy = cos(yaw),   sy = sin(yaw);
  vec3 v = vec3(p.x, cp*p.y - sp*p.z, sp*p.y + cp*p.z);
  return       vec3(cy*v.x + sy*v.z, v.y, -sy*v.x + cy*v.z);
}

float bodyDisplacement(
  vec3 p, float time,
  float tempo, float openness, float risk, float energy, float sensitivity,
  float audioBass, float audioMid, float audioHigh,
  float activityLevel
) {
  float sensGate = mix(0.10, 1.30, sensitivity);

  float audioFlow = audioMid * sensGate;
  float flowTime  = time * (1.0 + audioFlow * 0.35);

  vec3  nPos1 = p * 0.08 + vec3(flowTime * 0.40);
  float n1    = (noise3d(nPos1) - 0.5) * 1.0;

  vec3  nPos2 = p * 0.18 + vec3(flowTime * 0.55, flowTime * 0.45, flowTime * 0.50);
  float audioBumpLift = (audioMid * 0.45 + audioHigh * mix(0.10, 0.85, risk)) * sensGate;
  float riskMul = mix(0.4, 1.0, risk) * (1.0 + audioBumpLift);
  float n2      = (noise3d(nPos2) - 0.5) * 0.6 * riskMul;

  float tr     = mix(0.4, 1.2, tempo);
  float breath = sin(time * tr) * 0.30;

  float audioBoost = 1.0
    + audioMid * (mix(0.05, 0.20, energy) + mix(0.0, 0.30, sensitivity));
  float amp = mix(1.5, 3.0, openness)
            * mix(0.9, 1.35, energy)
            * audioBoost
            * activityLevel;
  return (n1 + n2 + breath) * amp;
}
`;

// Output grade for the creature's OWN render pass. Custom ShaderMaterials get
// NO tone-mapping or colour-space conversion from three, so the raw HDR output
// blows out ("too much bloom"). We apply three's EXACT AgX (verbatim — so the
// creature matches the site's AgX grade) + the sRGB OETF, in-shader. uExposure
// scales brightness. This is prepended to every creature fragment shader and
// called as tonalGrade(rgb) right before output.
export const tonalGradeGLSL = /* glsl */ `
uniform float uExposure;

const mat3 AGX_LIN_SRGB_TO_REC2020 = mat3(
  vec3( 0.6274, 0.0691, 0.0164 ),
  vec3( 0.3293, 0.9195, 0.0880 ),
  vec3( 0.0433, 0.0113, 0.8956 )
);
const mat3 AGX_REC2020_TO_LIN_SRGB = mat3(
  vec3( 1.6605, - 0.1246, - 0.0182 ),
  vec3( - 0.5876, 1.1329, - 0.1006 ),
  vec3( - 0.0728, - 0.0083, 1.1187 )
);
vec3 agxContrastApprox( vec3 x ) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return + 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4
         - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 tonalAgX( vec3 color ) {
  const mat3 AgXInsetMatrix = mat3(
    vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
    vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
    vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
  );
  const mat3 AgXOutsetMatrix = mat3(
    vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
    vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
    vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
  );
  const float AgxMinEv = - 12.47393;
  const float AgxMaxEv = 4.026069;
  color *= uExposure;
  color = AGX_LIN_SRGB_TO_REC2020 * color;
  color = AgXInsetMatrix * color;
  color = max( color, 1e-10 );
  color = log2( color );
  color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
  color = clamp( color, 0.0, 1.0 );
  color = agxContrastApprox( color );
  color = AgXOutsetMatrix * color;
  color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
  color = AGX_REC2020_TO_LIN_SRGB * color;
  color = clamp( color, 0.0, 1.0 );
  return color;
}
vec3 tonalSRGB( vec3 c ) {
  return mix( pow( c, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ),
              c * 12.92, vec3( lessThanEqual( c, vec3( 0.0031308 ) ) ) );
}
vec3 tonalGrade( vec3 c ) { return tonalSRGB( tonalAgX( c ) ); }
`;

export const bodyVertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;

uniform float uTime;
uniform float uOpenness;
uniform float uTempo;
uniform float uRiskThreshold;
uniform float uEnergyOrientation;
uniform float uSensitivity;
uniform float uActivityLevel;
uniform float uEarYaw;
uniform float uEarPitch;
uniform float uAudioBass;
uniform float uAudioMid;
uniform float uAudioHigh;

${sharedNoiseGLSL}

const float EAR_BASE_Y = 20.0;
const float EAR_TIP_Y  = 46.0;

#define BODY_DISP(P) bodyDisplacement((P), uTime, uTempo, uOpenness, uRiskThreshold, uEnergyOrientation, uSensitivity, uAudioBass, uAudioMid, uAudioHigh, uActivityLevel)

void main() {
  float disp = BODY_DISP(position);
  vec3 displacedPos = position + normal * disp;

  float earW = smoothstep(EAR_BASE_Y, EAR_TIP_Y, position.y);
  vec3  rotatedPos = applyEarRotation(displacedPos, uEarYaw, uEarPitch);
  vec3  finalPos   = mix(displacedPos, rotatedPos, earW);

  float eps = 0.5;
  float dpx = BODY_DISP(position + vec3(eps, 0.0, 0.0));
  float dpy = BODY_DISP(position + vec3(0.0, eps, 0.0));
  float dpz = BODY_DISP(position + vec3(0.0, 0.0, eps));
  vec3  grad = vec3(dpx - disp, dpy - disp, dpz - disp) / eps;
  vec3  adjustedNormal = normalize(normal - grad * 0.7);
  vec3 rotatedNormal = applyEarRotation(adjustedNormal, uEarYaw, uEarPitch);
  adjustedNormal = normalize(mix(adjustedNormal, rotatedNormal, earW));

  vec4 worldPos = modelMatrix * vec4(finalPos, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal   = normalize(normalMatrix * adjustedNormal);
  vViewDir  = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const bodyFragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;

uniform float uTime;
uniform float uTempo;
uniform float uEnergyOrientation;
uniform float uBodyShade;
uniform float uAudioBass;
uniform vec3  uBodyColor;
uniform vec3  uRimColor;
uniform float uReveal;
uniform float uSaturation;    // saturation lift (1.0 = none)
uniform float uTranslucency;  // body opacity multiplier (1.0 = solid)

${tonalGradeGLSL}

vec3 satComp(vec3 c, float s) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, s);
}

void main() {
  float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.4);

  vec3  keyDir   = normalize(vec3(0.4, 0.7, 0.55));
  float lambert  = max(0.0, dot(vNormal, keyDir));

  vec3  rimDir   = normalize(vec3(0.0, 0.4, -0.9));
  float rimDot   = max(0.0, dot(vNormal, rimDir));

  vec3 color = uBodyColor * (0.45 + lambert * 0.30);

  float rimAmount   = fresnel * 1.25 + rimDot * fresnel * 0.85;
  vec3  colorAdd    = color + uRimColor * rimAmount;
  vec3  colorMix    = mix(color, uRimColor, clamp(rimAmount, 0.0, 1.0));
  color             = mix(colorAdd, colorMix, uBodyShade);

  float tempo  = mix(0.4, 1.5, uTempo);
  float pulse  = sin(uTime * tempo) * 0.5 + 0.5;
  vec3  pulseAdd  = color + uRimColor * 0.05 * pulse;
  vec3  pulseMix  = mix(color, uRimColor, 0.05 * pulse);
  color           = mix(pulseAdd, pulseMix, uBodyShade);

  color *= mix(0.75, 1.30, uEnergyOrientation);

  color += uRimColor * uAudioBass * mix(0.04, 0.18, uEnergyOrientation);

  color = satComp(color, uSaturation);

  // Grade to match the site (AgX + sRGB) and fade with the chapter reveal.
  // uTranslucency gives the body a slight see-through so it sits in the world.
  gl_FragColor = vec4(tonalGrade(color), uReveal * uTranslucency);
}
`;

export const eyeVertexShader = /* glsl */ `
varying vec3 vLocalPos;

void main() {
  vLocalPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const eyeFragmentShader = /* glsl */ `
varying vec3 vLocalPos;

uniform vec3  uLeftCenter;
uniform vec3  uRightCenter;
uniform float uEyeHalfX;
uniform float uEyeHalfY;
uniform float uActivityLevel;
uniform float uTime;
uniform float uTempo;
uniform vec3  uEyeCore;
uniform vec3  uEyeMid;
uniform vec3  uEyeRing;

uniform float uExprOpenness;
uniform float uExprWidth;
uniform float uExprTilt;
uniform float uExprYShift;
uniform float uExprAsym;
uniform float uExprPinch;

uniform float uLidTopH;
uniform float uLidTopSlant;
uniform float uLidTopCurve;
uniform float uLidBotH;
uniform float uLidBotSlant;
uniform float uLidBotCurve;
uniform float uSaturation; // saturation lift (1.0 = none)

${tonalGradeGLSL}

vec3 satComp(vec3 c, float s) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, s);
}

void main() {
  vec3 deltaL = vLocalPos - uLeftCenter;
  vec3 deltaR = vLocalPos - uRightCenter;
  bool isLeft = length(deltaL.xy) < length(deltaR.xy);
  vec3 delta  = isLeft ? deltaL : deltaR;

  vec2 e = vec2(delta.x / uEyeHalfX, delta.y / uEyeHalfY);

  float side = isLeft ? -1.0 : 1.0;
  e.x = isLeft ? -e.x : e.x;

  vec2 lidE = e;

  e.y -= uExprYShift;

  float c = cos(uExprTilt), s = sin(uExprTilt);
  e = vec2(c * e.x - s * e.y, s * e.x + c * e.y);

  float innerBottom = smoothstep(0.0, 0.4, -e.x) * smoothstep(0.0, 0.4, -e.y);
  e.y *= 1.0 + uExprPinch * 1.6 * innerBottom;
  e.x *= 1.0 + uExprPinch * 0.8 * innerBottom;

  float scaleAdj = 1.0 + uExprAsym * side;
  float w = uExprWidth   * scaleAdj;
  float h = uExprOpenness * scaleAdj;
  vec2  ne = vec2(e.x / w, e.y / h);
  float r = length(ne);

  float topEdge = (1.0 - 2.0 * uLidTopH)
                + uLidTopSlant * lidE.x
                + uLidTopCurve * lidE.x * lidE.x;
  float botEdge = (-1.0 + 2.0 * uLidBotH)
                + uLidBotSlant * lidE.x
                - uLidBotCurve * lidE.x * lidE.x;
  float topMask = smoothstep(topEdge + 0.04, topEdge - 0.04, lidE.y);
  float botMask = smoothstep(botEdge - 0.04, botEdge + 0.04, lidE.y);
  float lidMask = topMask * botMask;

  float edgeFade = 1.0 - smoothstep(0.95, 1.05, length(lidE));
  float fill = edgeFade * lidMask;

  vec3 color = uEyeMid;

  float pulse = sin(uTime * 0.9 * mix(0.5, 1.6, uTempo)) * 0.05 + 1.0;
  color *= pulse;

  color = satComp(color, uSaturation);

  float alpha = fill * uActivityLevel;

  gl_FragColor = vec4(tonalGrade(color), alpha);
}
`;

export const sparkleVertexShader = /* glsl */ `
attribute float aSize;
attribute vec3  aColor;
attribute float aRandom;
attribute vec3  aOrigin;
attribute vec3  aNormalAttr;
attribute float aOffset;
attribute float aBehavior;
attribute vec4  aOrbitData;

uniform float uTime;
uniform float uOpenness;
uniform float uTempo;
uniform float uRiskThreshold;
uniform float uAttachmentStyle;
uniform float uEnergyOrientation;
uniform float uSensitivity;
uniform float uActivityLevel;
uniform float uEarYaw;
uniform float uEarPitch;
uniform float uLagAmountX;
uniform float uLagAmountY;
uniform float uAudioBass;
uniform float uAudioMid;
uniform float uAudioHigh;

varying vec3  vColor;
varying float vAlpha;

${sharedNoiseGLSL}

const float EAR_BASE_Y = 20.0;
const float EAR_TIP_Y  = 46.0;

void main() {
  float tempo     = mix(0.4, 1.5, uTempo);
  float pulseNorm = sin(uTime * tempo + aRandom * 6.2831) * 0.5 + 0.5;

  float bodyDisp = bodyDisplacement(
    aOrigin, uTime,
    uTempo, uOpenness, uRiskThreshold, uEnergyOrientation, uSensitivity,
    uAudioBass, uAudioMid, uAudioHigh, uActivityLevel
  );
  vec3  surfacePos = aOrigin + aNormalAttr * bodyDisp;

  float repelGate = mix(0.05, 1.25, uSensitivity)
                  * mix(0.70, 1.30, uOpenness)
                  * mix(0.60, 1.35, 1.0 - uAttachmentStyle);
  float audioRepel = (uAudioHigh * 5.5 + uAudioBass * 1.5) * repelGate;

  vec3  pos        = surfacePos + aNormalAttr * (aOffset + audioRepel);

  float earW = smoothstep(EAR_BASE_Y, EAR_TIP_Y, aOrigin.y);
  vec3  rotated = applyEarRotation(pos, uEarYaw, uEarPitch);
  pos = mix(pos, rotated, earW);

  float lagScale = mix(0.7, 1.6, 1.0 - uAttachmentStyle);
  float lagFactor = (0.5 + aRandom * 1.5) * lagScale;

  float driftAudioBoost = 1.0 + uAudioHigh * mix(0.05, 1.10, uSensitivity);
  vec3 drift = vec3(
    sin(uTime * 0.5 + aRandom * 6.28),
    cos(uTime * 0.4 + aRandom * 4.13),
    sin(uTime * 0.6 + aRandom * 8.21)
  ) * mix(0.2, 2.2, uOpenness) * driftAudioBoost;

  vec3 anchorPos = pos;
  anchorPos.x += uLagAmountX * lagFactor;
  anchorPos.y += uLagAmountY * lagFactor;
  anchorPos += drift * uActivityLevel;

  float shellInner = mix(2.0, 6.0, 1.0 - uAttachmentStyle);
  float shellRange = mix(8.0, 22.0, 1.0 - uAttachmentStyle);
  float orbitRadius = length(aOrigin) + shellInner + aRandom * shellRange;
  float orbitAngle  = aOrbitData.w + uTime * aOrbitData.z;

  float zigFreq   = mix(3.0, 9.0, uRiskThreshold);
  float zigAudio  = 1.0 + uAudioHigh * mix(0.2, 1.6, uRiskThreshold);
  float zigAmp    = mix(0.0, 8.0, uEnergyOrientation) * zigAudio;
  float zigT      = fract(orbitAngle * zigFreq / 6.2831853);
  float zigTri    = abs(zigT - 0.5) * 2.0;
  float radiusMod = (zigTri * 2.0 - 1.0) * zigAmp;
  float effRadius = orbitRadius + radiusMod + audioRepel;

  vec3  basePos     = vec3(
    cos(orbitAngle) * effRadius,
    0.0,
    sin(orbitAngle) * effRadius
  );
  float cx = cos(aOrbitData.x), sx = sin(aOrbitData.x);
  basePos = vec3(basePos.x, basePos.y * cx - basePos.z * sx, basePos.y * sx + basePos.z * cx);
  float cz = cos(aOrbitData.y), sz = sin(aOrbitData.y);
  basePos = vec3(basePos.x * cz - basePos.y * sz, basePos.x * sz + basePos.y * cz, basePos.z);
  vec3 orbitPos = basePos;
  orbitPos.x += uLagAmountX * lagFactor;
  orbitPos.y += uLagAmountY * lagFactor;

  float fallPeriod = 4.0 + aRandom * 4.0;
  float fallPhase  = mod(uTime + aRandom * fallPeriod, fallPeriod) / fallPeriod;
  float fallStartY = aOrigin.y;
  float fallEndY   = -55.0;
  vec3  fallPos    = vec3(
    aOrigin.x + sin(uTime * 0.5 + aRandom * 6.28) * 4.0 * fallPhase,
    mix(fallStartY, fallEndY, fallPhase),
    aOrigin.z + cos(uTime * 0.6 + aRandom * 4.13) * 4.0 * fallPhase
  );
  fallPos.x += uLagAmountX * lagFactor * 0.4;
  fallPos.y += uLagAmountY * lagFactor * 0.4;
  float fallAlphaMul = 1.0 - smoothstep(0.55, 1.0, fallPhase);

  vec3  finalPos     = anchorPos;
  float behaviorAMul = 1.0;
  if (aBehavior > 1.5) {
    finalPos     = fallPos;
    behaviorAMul = fallAlphaMul;
  } else if (aBehavior > 0.5) {
    finalPos     = orbitPos;
  }

  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * (12.0 / -mvPosition.z);

  float twinkleRate = 1.2 + aRandom * 4.0;
  float twinkle     = sin(uTime * twinkleRate + aRandom * 6.2831) * 0.5 + 0.5;
  twinkle           = pow(twinkle, 0.6);

  float audioFlare = (uAudioHigh * 0.55 + uAudioBass * 0.15) * mix(0.05, 1.10, uSensitivity);

  vColor = aColor;
  vAlpha = mix(0.0, 0.9, twinkle) * mix(0.85, 1.0, pulseNorm) * uActivityLevel * behaviorAMul * (1.0 + audioFlare);
}
`;

export const sparkleFragmentShader = /* glsl */ `
varying vec3  vColor;
varying float vAlpha;

${tonalGradeGLSL}

void main() {
  vec2  uv = gl_PointCoord - 0.5;
  float r  = length(uv);
  if (r > 0.5) discard;
  float core    = 1.0 - smoothstep(0.0, 0.18, r);
  float falloff = 1.0 - smoothstep(0.0, 0.5, r);
  float alpha   = pow(falloff, 1.5) + core * 0.4;
  gl_FragColor = vec4(tonalGrade(vColor), alpha * vAlpha);
}
`;

export const trailVertexShader = /* glsl */ `
attribute vec3  aOrigin;
attribute float aSegT;
attribute float aTrailRandom;

uniform float     uTime;
uniform float     uActivityLevel;
uniform float     uTrailAlpha;
uniform float     uOpenness;
uniform sampler2D uHistoryTexture;

varying float vAlpha;

void main() {
  float opennessScale = mix(0.6, 1.4, uOpenness);
  float lookback   = (0.45 + aTrailRandom * 0.55) * opennessScale;
  float headOffset = aTrailRandom * 0.08;
  float adjustedT  = headOffset + aSegT * lookback;

  vec2 historyOffset = texture2D(uHistoryTexture, vec2(adjustedT, 0.5)).xy;

  vec3 segPos = aOrigin + vec3(historyOffset, 0.0);

  vec4 mv = modelViewMatrix * vec4(segPos, 1.0);
  gl_Position = projectionMatrix * mv;

  float trailFade = pow(1.0 - aSegT, 1.4);
  vAlpha = trailFade * uTrailAlpha * 1.5 * uActivityLevel;
}
`;

export const trailFragmentShader = /* glsl */ `
varying float vAlpha;

${tonalGradeGLSL}

void main() {
  gl_FragColor = vec4(tonalGrade(vec3(0.85, 1.00, 0.98)), vAlpha);
}
`;

export const orbitTrailVertexShader = /* glsl */ `
attribute float aSegT;
attribute vec4  aOrbitTrailA;
attribute vec4  aOrbitTrailB;

uniform float uTime;
uniform float uLagAmountX;
uniform float uLagAmountY;
uniform float uActivityLevel;
uniform float uRiskThreshold;
uniform float uEnergyOrientation;
uniform float uOpenness;
uniform float uSensitivity;
uniform float uAttachmentStyle;
uniform float uAudioBass;
uniform float uAudioHigh;

varying float vAlpha;

void main() {
  float trailDuration = 1.6;
  float t            = uTime - aSegT * trailDuration;
  float angle        = aOrbitTrailA.w + t * aOrbitTrailA.z;
  float radius       = aOrbitTrailB.x;

  float zigFreq   = mix(3.0, 9.0, uRiskThreshold);
  float zigAudio  = 1.0 + uAudioHigh * mix(0.2, 1.6, uRiskThreshold);
  float zigAmp    = mix(0.0, 8.0, uEnergyOrientation) * zigAudio;
  float zigT      = fract(angle * zigFreq / 6.2831853);
  float zigTri    = abs(zigT - 0.5) * 2.0;
  float radiusMod = (zigTri * 2.0 - 1.0) * zigAmp;
  float repelGate = mix(0.05, 1.25, uSensitivity)
                  * mix(0.70, 1.30, uOpenness)
                  * mix(0.60, 1.35, 1.0 - uAttachmentStyle);
  float audioRepel = (uAudioHigh * 5.5 + uAudioBass * 1.5) * repelGate;
  float effRadius = radius + radiusMod + audioRepel;
  vec3  p         = vec3(cos(angle) * effRadius, 0.0, sin(angle) * effRadius);

  float cx = cos(aOrbitTrailA.x), sx = sin(aOrbitTrailA.x);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
  float cz = cos(aOrbitTrailA.y), sz = sin(aOrbitTrailA.y);
  p = vec3(p.x * cz - p.y * sz, p.x * sz + p.y * cz, p.z);

  p.x += uLagAmountX * aOrbitTrailB.y;
  p.y += uLagAmountY * aOrbitTrailB.y;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);

  float age      = uTime - aOrbitTrailB.z;
  float lifetime = aOrbitTrailB.w;
  float fadeIn   = smoothstep(0.0, 0.6, age);
  float fadeOut  = 1.0 - smoothstep(lifetime - 1.0, lifetime, age);
  float life     = fadeIn * fadeOut;

  vAlpha = pow(1.0 - aSegT, 1.4) * uActivityLevel * life;
}
`;

export const orbitTrailFragmentShader = /* glsl */ `
varying float vAlpha;

${tonalGradeGLSL}

void main() {
  gl_FragColor = vec4(tonalGrade(vec3(0.78, 0.98, 0.95)), vAlpha);
}
`;
