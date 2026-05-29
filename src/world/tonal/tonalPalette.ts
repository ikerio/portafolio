/* =====================================================================
   tonalPalette — trait + expression data for the Tonal creature, ported
   verbatim from EchoIsleV1.1/TonalViewer.jsx + traits.js (read-only source).
   Six 0..1 traits drive every colour; computePalette() turns them into the
   body / rim / eye / sparkle palette. EYE_EXPRESSIONS are the 12 iris+lid
   presets the eyes lerp between. No audio, no UI — pure data.
   ===================================================================== */

import { Color, MathUtils } from 'three';

export interface TonalTraits {
  openness: number;
  energyOrientation: number;
  riskThreshold: number;
  attachmentStyle: number;
  tempo: number;
  sensitivity: number;
}

export interface TonalCosmetic {
  /** 0 = dark interior, 1 = pale ivory. */
  bodyShade: number;
}

/** DEFAULT_SOUL.traits + cosmetic from traits.js (the canonical Tonal). */
export const DEFAULT_TRAITS: TonalTraits = {
  openness: 0.82,
  energyOrientation: 0.74,
  riskThreshold: 0.48,
  attachmentStyle: 0.55,
  tempo: 0.31,
  sensitivity: 0.71,
};

export const DEFAULT_COSMETIC: TonalCosmetic = { bodyShade: 0.0 };

export type ExpressionKey =
  | 'neutral' | 'happy' | 'sad' | 'sleepy' | 'suspicious' | 'angry'
  | 'surprised' | 'determined' | 'confused' | 'shy' | 'delighted' | 'worried';

export interface Expression {
  key: ExpressionKey;
  label: string;
  // iris params
  openness: number; width: number; tilt: number; yShift: number; asym: number; pinch: number;
  // eyelid params
  lidTopH: number; lidTopSlant: number; lidTopCurve: number;
  lidBotH: number; lidBotSlant: number; lidBotCurve: number;
}

// VERBATIM from TonalViewer.jsx — the 12 iris+lid presets.
export const EYE_EXPRESSIONS: Expression[] = [
  { key: 'neutral',    label: 'Neutral',    openness: 1.00, width: 1.00, tilt:  0.00, yShift:  0.00, asym: 0.00, pinch: 0.00, lidTopH: 0.00, lidTopSlant: 0.00, lidTopCurve: 0.00, lidBotH: 0.00, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'happy',      label: 'Happy',      openness: 1.00, width: 1.00, tilt:  0.00, yShift:  0.00, asym: 0.00, pinch: 0.00, lidTopH: 0.00, lidTopSlant: 0.00, lidTopCurve: 0.00, lidBotH: 0.30, lidBotSlant: 0.00, lidBotCurve: -0.40 },
  { key: 'sad',        label: 'Sad',        openness: 1.00, width: 0.95, tilt:  0.00, yShift:  0.05, asym: 0.00, pinch: 0.00, lidTopH: 0.30, lidTopSlant: -0.45, lidTopCurve: 0.00, lidBotH: 0.00, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'sleepy',     label: 'Sleepy',     openness: 1.00, width: 1.00, tilt:  0.00, yShift:  0.00, asym: 0.00, pinch: 0.00, lidTopH: 0.50, lidTopSlant: 0.00, lidTopCurve: 0.00, lidBotH: 0.35, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'suspicious', label: 'Suspicious', openness: 1.00, width: 1.00, tilt:  0.00, yShift:  0.05, asym: 0.00, pinch: 0.00, lidTopH: 0.55, lidTopSlant: 0.00, lidTopCurve: 0.00, lidBotH: 0.10, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'angry',      label: 'Angry',      openness: 1.00, width: 0.85, tilt:  0.00, yShift:  0.00, asym: 0.00, pinch: 0.45, lidTopH: 0.45, lidTopSlant: 0.55, lidTopCurve: 0.00, lidBotH: 0.00, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'surprised',  label: 'Surprised',  openness: 1.35, width: 1.20, tilt:  0.00, yShift:  0.00, asym: 0.00, pinch: 0.00, lidTopH: 0.00, lidTopSlant: 0.00, lidTopCurve: 0.00, lidBotH: 0.00, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'determined', label: 'Determined', openness: 0.85, width: 0.75, tilt:  0.00, yShift:  0.00, asym: 0.00, pinch: 0.50, lidTopH: 0.40, lidTopSlant: 0.50, lidTopCurve: 0.00, lidBotH: 0.05, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'confused',   label: 'Confused',   openness: 1.00, width: 1.00, tilt:  0.00, yShift:  0.00, asym: 0.30, pinch: 0.00, lidTopH: 0.00, lidTopSlant: 0.00, lidTopCurve: 0.00, lidBotH: 0.00, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'shy',        label: 'Shy',        openness: 0.65, width: 0.75, tilt:  0.00, yShift:  0.05, asym: 0.00, pinch: 0.00, lidTopH: 0.10, lidTopSlant: 0.00, lidTopCurve: 0.00, lidBotH: 0.00, lidBotSlant: 0.00, lidBotCurve: 0.00 },
  { key: 'delighted',  label: 'Delighted',  openness: 1.00, width: 1.00, tilt:  0.30, yShift:  0.00, asym: 0.00, pinch: 0.05, lidTopH: 0.00, lidTopSlant: 0.00, lidTopCurve: 0.00, lidBotH: 0.20, lidBotSlant: 0.00, lidBotCurve: -0.30 },
  { key: 'worried',    label: 'Worried',    openness: 1.00, width: 1.00, tilt:  0.00, yShift:  0.05, asym: 0.00, pinch: 0.00, lidTopH: 0.20, lidTopSlant: -0.30, lidTopCurve: 0.00, lidBotH: 0.00, lidBotSlant: 0.00, lidBotCurve: 0.00 },
];

export const EXPRESSION_BY_KEY: Record<string, Expression> = Object.fromEntries(
  EYE_EXPRESSIONS.map((e) => [e.key, e]),
);
export const NEUTRAL = EXPRESSION_BY_KEY.neutral;

// VERBATIM endpoints from TonalViewer.jsx.
const PALETTE_ENDPOINTS = {
  // DARK body
  coolBody: new Color('#1a3530'),
  warmBody: new Color('#2a2515'),
  coolRim: new Color('#6dd6cc'),
  warmRim: new Color('#ffba66'),
  // PALE body
  coolBodyPale: new Color('#e8efe9'),
  warmBodyPale: new Color('#f1e7d4'),
  coolRimPale: new Color('#1a4842'),
  warmRimPale: new Color('#5a3320'),
  // BRIGHT eyes (dark-bodied)
  coolEyeCore: new Color(0.98, 1.0, 0.96),
  coolEyeMid: new Color(0.5, 0.96, 0.86),
  coolEyeRing: new Color(0.3, 0.78, 0.72),
  warmEyeCore: new Color(1.0, 0.98, 0.92),
  warmEyeMid: new Color(1.0, 0.84, 0.6),
  warmEyeRing: new Color(0.8, 0.62, 0.38),
  // DARK eyes (pale-bodied)
  coolEyeCoreDark: new Color(0.02, 0.03, 0.03),
  coolEyeMidDark: new Color(0.04, 0.05, 0.05),
  coolEyeRingDark: new Color(0.1, 0.13, 0.13),
  warmEyeCoreDark: new Color(0.03, 0.02, 0.01),
  warmEyeMidDark: new Color(0.06, 0.04, 0.03),
  warmEyeRingDark: new Color(0.12, 0.09, 0.06),
};

export interface TonalPalette {
  body: Color;
  rim: Color;
  eyeCore: Color;
  eyeMid: Color;
  eyeRing: Color;
  sparkleCool: Color;
  sparkleWarm: Color;
  sparkleAccent: Color;
  tealRatio: number;
  accentRate: number;
  warmth: number;
  bodyShade: number;
}

const { lerp, clamp, smoothstep } = MathUtils;

/** COMPLETE VERBATIM port of computePalette(traits, cosmetic). Note: Color.lerp
    mutates in place — the clone/lerp chaining below preserves that behaviour.
    `warmthOverride` (0..1) optionally replaces the trait-derived warmth so the
    creature can be pushed toward its warm (amber/olive/cream) endpoints to blend
    with the site's warm-dark palette. */
export function computePalette(
  traits?: Partial<TonalTraits>,
  cosmetic?: Partial<TonalCosmetic>,
  warmthOverride?: number,
): TonalPalette {
  const t = traits ?? {};
  const tempo = t.tempo ?? 0.5;
  const energy = t.energyOrientation ?? 0.5;
  const open = t.openness ?? 0.5;
  const sens = t.sensitivity ?? 0.5;
  const risk = t.riskThreshold ?? 0.5;
  const attach = t.attachmentStyle ?? 0.5;
  const bodyShade = cosmetic?.bodyShade ?? 0; // 0 = dark, 1 = pale

  const warmth = warmthOverride ?? (tempo + energy) * 0.5;
  const brightness = (open + sens) * 0.5;
  const warmthEye = lerp(0.25, 0.75, warmth);
  const bodyMul = lerp(0.65, 1.25, brightness) * lerp(1.0, 0.85, bodyShade);
  const rimMul = lerp(1.2, 1.7, brightness);

  // Body
  const bodyDark = PALETTE_ENDPOINTS.coolBody.clone().lerp(PALETTE_ENDPOINTS.warmBody, warmth);
  const bodyPale = PALETTE_ENDPOINTS.coolBodyPale.clone().lerp(PALETTE_ENDPOINTS.warmBodyPale, warmth);
  const body = bodyDark.lerp(bodyPale, bodyShade).multiplyScalar(bodyMul);

  // Rim
  const rimWarmShift = warmth * 0.5;
  const rimDark = PALETTE_ENDPOINTS.coolRim.clone().lerp(PALETTE_ENDPOINTS.warmRim, rimWarmShift);
  const rimPale = PALETTE_ENDPOINTS.coolRimPale.clone().lerp(PALETTE_ENDPOINTS.warmRimPale, rimWarmShift);
  const rim = rimDark.lerp(rimPale, bodyShade).multiplyScalar(rimMul);

  // Bright eye palette
  const eyeBrightCore = PALETTE_ENDPOINTS.coolEyeCore.clone().lerp(PALETTE_ENDPOINTS.warmEyeCore, warmthEye);
  const eyeBrightMid = PALETTE_ENDPOINTS.coolEyeMid.clone().lerp(PALETTE_ENDPOINTS.warmEyeMid, warmthEye);
  const eyeBrightRing = PALETTE_ENDPOINTS.coolEyeRing.clone().lerp(PALETTE_ENDPOINTS.warmEyeRing, warmthEye);
  // Dark eye palette
  const eyeDarkCore = PALETTE_ENDPOINTS.coolEyeCoreDark.clone().lerp(PALETTE_ENDPOINTS.warmEyeCoreDark, warmthEye);
  const eyeDarkMid = PALETTE_ENDPOINTS.coolEyeMidDark.clone().lerp(PALETTE_ENDPOINTS.warmEyeMidDark, warmthEye);
  const eyeDarkRing = PALETTE_ENDPOINTS.coolEyeRingDark.clone().lerp(PALETTE_ENDPOINTS.warmEyeRingDark, warmthEye);
  const eyeDarkBlend = smoothstep(bodyShade, 0.4, 0.9);
  const eyeCore = eyeBrightCore.lerp(eyeDarkCore, eyeDarkBlend);
  const eyeMid = eyeBrightMid.lerp(eyeDarkMid, eyeDarkBlend);
  const eyeRing = eyeBrightRing.lerp(eyeDarkRing, eyeDarkBlend);

  // Sparkle palette
  const coolHueDeg = 190 + (tempo - 0.5) * 90 - (energy - 0.5) * 40 + (risk - 0.5) * 60;
  const warmHueDeg = 35 + (energy - 0.5) * 35 - (tempo - 0.5) * 20 + (1 - attach - 0.5) * 25;
  const accentHueDeg = 290 + (tempo - 0.5) * 80;

  const satScale = lerp(0.45, 1.3, sens) * lerp(0.85, 1.15, energy);
  const sparkleLightness = clamp(0.55 * lerp(0.7, 1.3, brightness), 0.3, 0.85);

  const sparkleCool = new Color().setHSL(
    ((((coolHueDeg % 360) + 360) % 360) / 360),
    clamp(0.55 * satScale, 0.1, 1.0),
    sparkleLightness,
  );
  const sparkleWarm = new Color().setHSL(
    ((((warmHueDeg % 360) + 360) % 360) / 360),
    clamp(0.8 * satScale, 0.2, 1.0),
    sparkleLightness * 0.92,
  );
  const sparkleAccent = new Color().setHSL(
    ((((accentHueDeg % 360) + 360) % 360) / 360),
    clamp(0.95 * satScale, 0.3, 1.0),
    Math.min(sparkleLightness * 1.15, 0.78),
  );

  const tealRatio = lerp(0.85, 0.45, warmth);
  const accentRate = clamp((risk - 0.5) * 2 * 0.22, 0, 0.22);

  return {
    body, rim, eyeCore, eyeMid, eyeRing,
    sparkleCool, sparkleWarm, sparkleAccent,
    tealRatio, accentRate,
    warmth, bodyShade,
  };
}
