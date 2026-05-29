/* =====================================================================
   chapters.ts — the master choreography. A single paused GSAP timeline
   (normalized to duration 1) tweens the shared DirectorState across
   labeled chapter segments. ScrollTrigger scrubs it via timeline.progress().
   Editing the journey = editing this one timeline + config.CHAPTERS.
   ===================================================================== */

import { gsap } from 'gsap';
import { SCENE } from '../core/config';
import type { Journey } from './journey';

/** Everything the journey animates. Read by SceneDirector each frame. */
export interface DirectorState {
  camU: number; // 0..1 arc-length param on the camera position curve
  targetU: number; // 0..1 on the look-at curve
  morph: number; // hero: 0 = IT, 1 = IKER TOLEDO
  heroOpacity: number;
  terrainReveal: number;
  pathReveal: number;
  fogDensity: number;
}

export function makeInitialState(): DirectorState {
  return {
    camU: 0,
    targetU: 0,
    morph: 0,
    heroOpacity: 0,
    terrainReveal: 0,
    pathReveal: 0,
    fogDensity: SCENE.fogDensityNear,
  };
}

export function buildTimeline(state: DirectorState, journey: Journey): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });

  // Camera travels its checkpoints: hero (arrival) → a composed shot at each
  // station. camU/targetU ease to each checkpoint's curve param at the
  // checkpoint's scroll progress; ScrollSmoother snaps to those progress values.
  const { progress, tValues, snapFlags } = journey;
  for (let i = 1; i < progress.length; i++) {
    const dur = Math.max(0.001, progress[i] - progress[i - 1]);
    // Ease only into/out of actual snap stops; pass LINEARLY through non-snap
    // nodes (e.g. the arch fly-through) so the camera doesn't decelerate there.
    const startSnap = snapFlags[i - 1];
    const endSnap = snapFlags[i];
    let ease = 'none';
    if (startSnap && endSnap) ease = 'power2.inOut';
    else if (startSnap) ease = 'power2.in'; // accelerate out of a stop
    else if (endSnap) ease = 'power2.out'; // decelerate into a stop
    tl.to(state, { camU: tValues[i], duration: dur, ease }, progress[i - 1]);
    tl.to(state, { targetU: tValues[i], duration: dur, ease }, progress[i - 1]);
  }

  // Hero fades up out of fog and morphs IT → IKER TOLEDO during arrival.
  tl.to(state, { heroOpacity: 1, duration: 0.07, ease: 'power2.out' }, 0.02);
  tl.to(state, { morph: 1, duration: 0.09, ease: 'power1.inOut' }, 0.05);
  tl.to(state, { heroOpacity: 0, duration: 0.05, ease: 'power2.in' }, 0.16);

  // World reveals early and the atmosphere opens as we set off.
  tl.to(state, { terrainReveal: 1, duration: 0.28, ease: 'power2.out' }, 0.04);
  tl.to(state, { pathReveal: 1, duration: 0.3, ease: 'power2.out' }, 0.1);
  tl.to(state, { fogDensity: SCENE.fogDensityFar, duration: 0.32, ease: 'power2.out' }, 0.05);

  return tl;
}
