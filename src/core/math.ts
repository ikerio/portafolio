/* =====================================================================
   math.ts — small, dependency-free numeric helpers shared across the
   engine. Anything heavier (curves, vectors) uses three directly.
   ===================================================================== */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** GLSL-style smoothstep. */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** Remap x from [inMin,inMax] to [outMin,outMax] (unclamped). */
export const remap = (
  x: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => outMin + ((x - inMin) * (outMax - outMin)) / (inMax - inMin);

/** Remap then clamp to the output range. */
export const remapClamped = (
  x: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => {
  const t = clamp01((x - inMin) / (inMax - inMin));
  return outMin + t * (outMax - outMin);
};

/** 0..1 progress within a [start,end] window of a global 0..1 value. */
export const windowProgress = (global: number, start: number, end: number): number =>
  clamp01((global - start) / (end - start));

export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
