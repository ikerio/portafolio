/* =====================================================================
   SceneDirector — the bridge between scroll and the world. Holds the
   master timeline + shared state; seek() scrubs the timeline to a scroll
   progress, apply() pushes the resulting state onto the camera rig and
   world modules every frame. No module animates itself — all motion flows
   through here, so nothing fights.
   ===================================================================== */

import { gsap } from 'gsap';
import { clamp01 } from '../core/math';
import { buildTimeline, makeInitialState, type DirectorState } from './chapters';
import type { Journey } from './journey';
import type { CameraRig } from '../render/CameraRig';
import type { SceneManager } from '../render/SceneManager';
import type { Terrain } from '../world/Terrain';
import type { PathSpline } from '../world/PathSpline';
import type { ParticleType } from '../world/ParticleType';

export interface DirectorDeps {
  cameraRig: CameraRig;
  scene: SceneManager;
  terrain: Terrain;
  pathSpline: PathSpline;
  hero: ParticleType;
}

export class SceneDirector {
  readonly state: DirectorState = makeInitialState();
  private timeline: ReturnType<typeof buildTimeline>;
  /** While a nav glide runs, the camera follows these params instead of the
      scrubbed state.camU/targetU — so it flies straight to the destination
      rather than scrubbing through every station's eased near-stop. */
  private camGlide: { u: number; tU: number } | null = null;
  private camGlideTween?: gsap.core.Tween;

  constructor(
    private deps: DirectorDeps,
    private journey: Journey,
  ) {
    this.timeline = buildTimeline(this.state, journey);
    this.timeline.pause();
  }

  /** Scrub the timeline to a 0..1 scroll progress. */
  seek(progress: number): void {
    this.timeline.progress(clamp01(progress));
  }

  /** Push current state to the camera + world. Called once per frame.
      moveCamera=false leaves the camera alone (used by the free-fly debug tool). */
  apply(time: number, moveCamera = true): void {
    const s = this.state;
    const camU = this.camGlide ? this.camGlide.u : s.camU;
    const targetU = this.camGlide ? this.camGlide.tU : s.targetU;
    if (moveCamera) this.deps.cameraRig.apply(camU, targetU, time);
    this.deps.terrain.setReveal(s.terrainReveal);
    this.deps.pathSpline.setReveal(s.pathReveal);
    this.deps.hero.setMorph(s.morph);
    this.deps.hero.setOpacity(s.heroOpacity);
    this.deps.scene.setFogDensity(s.fogDensity);
  }

  /** Glide the camera in one smooth ease to the curve param at `progress`,
      bypassing the per-station dwells. Run for `duration` seconds in step with
      the scroll tween, then hand back to the scrub (which lands on the same
      value, so there is no pop). */
  glideCameraTo(progress: number, duration: number): void {
    const destU = this.camUAtProgress(clamp01(progress));
    this.camGlideTween?.kill();
    const g = { u: this.state.camU, tU: this.state.targetU };
    this.camGlide = g;
    this.camGlideTween = gsap.to(g, {
      u: destU,
      tU: destU,
      duration,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: () => {
        this.camGlide = null;
      },
    });
  }

  /** Cancel an in-flight glide and return camera control to the scrub. */
  cancelCameraGlide(): void {
    this.camGlideTween?.kill();
    this.camGlide = null;
  }

  /** Curve param (camU) at a given scroll progress, read straight from the
      journey's node tables — linear within the segment (endpoints are exact, so
      station/hero/finale targets land precisely). */
  private camUAtProgress(p: number): number {
    const { progress, tValues } = this.journey;
    if (p <= progress[0]) return tValues[0];
    for (let i = 1; i < progress.length; i++) {
      if (p <= progress[i]) {
        const seg = (p - progress[i - 1]) / Math.max(1e-6, progress[i] - progress[i - 1]);
        return tValues[i - 1] + (tValues[i] - tValues[i - 1]) * seg;
      }
    }
    return tValues[tValues.length - 1];
  }
}
