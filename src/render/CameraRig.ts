/* =====================================================================
   CameraRig — a PerspectiveCamera flown along a position curve while
   looking along a separate target curve. Both are CatmullRomCurve3 and
   sampled by arc length (getPointAt) so motion is even regardless of how
   the control points are spaced. A faint idle float adds life without
   inducing motion sickness (disabled under reduced motion).
   ===================================================================== */

import { PerspectiveCamera, CatmullRomCurve3, Vector3 } from 'three';
import { CAMERA } from '../core/config';

export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly positionCurve: CatmullRomCurve3;
  readonly targetCurve: CatmullRomCurve3;

  private idleEnabled = true;
  private readonly basePos = new Vector3();
  private readonly lookTarget = new Vector3();
  private readonly back = new Vector3();
  /** Per-node portrait framing weights (0..1, parallel to the curve nodes) and
      the aspect-driven scale. The pull-back at a curve param is the interpolated
      weight × aspectComp — so each shot keeps its authored framing on portrait. */
  private framingWeights: number[] = [];
  private aspectComp = 0;

  constructor(
    aspect: number,
    positionNodes: Vector3[],
    targetNodes: Vector3[],
    framingWeights: number[] = [],
  ) {
    this.camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);

    this.positionCurve = new CatmullRomCurve3(positionNodes, false, 'catmullrom', 0.5);
    this.targetCurve = new CatmullRomCurve3(targetNodes, false, 'catmullrom', 0.5);

    this.framingWeights = framingWeights;
    this.updateFraming(aspect);
    // Place at the start so the very first frame is composed.
    this.apply(0, 0, 0);
  }

  /** Aspect-driven pull-back scale: 0 on screens wider than the design aspect,
      growing as the viewport gets narrower (portrait). Multiplied by each node's
      weight so only shots that want it pull back. No FOV change → no distortion. */
  private updateFraming(aspect: number): void {
    this.aspectComp = Math.max(0, CAMERA.designAspect / aspect - 1) * CAMERA.portraitPullback;
  }

  /** Interpolated pull-back fraction at curve param u (0 on desktop / no weights). */
  private framingAt(u: number): number {
    const w = this.framingWeights;
    if (this.aspectComp <= 0 || w.length === 0) return 0;
    const f = clamp01(u) * (w.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, w.length - 1);
    const weight = w[i0] + (w[i1] - w[i0]) * (f - i0);
    return weight * this.aspectComp;
  }

  setIdle(enabled: boolean): void {
    this.idleEnabled = enabled;
  }

  /** Live look-at point (updated each apply) — used to seed the debug controls. */
  get currentTarget(): Vector3 {
    return this.lookTarget;
  }

  /**
   * Position the camera. posU / targetU are 0..1 arc-length parameters into
   * their curves; time drives the idle float.
   */
  apply(posU: number, targetU: number, time: number): void {
    // Uniform param (getPoint, not getPointAt): node i sits exactly at
    // t = i/(n-1), so authored checkpoints are precise hold targets.
    this.positionCurve.getPoint(clamp01(posU), this.basePos);
    this.targetCurve.getPoint(clamp01(targetU), this.lookTarget);

    // On narrow screens, dolly the camera straight back along its view axis so
    // more of the landscape composition fits (the look-at point stays centered).
    // The amount is per-shot (this node's framing weight) so the arch fly-through
    // and model assembles keep their close framing while the hero pulls back.
    const pull = this.framingAt(posU);
    if (pull > 0) {
      this.back.copy(this.basePos).sub(this.lookTarget);
      this.basePos.addScaledVector(this.back, pull);
    }

    this.camera.position.copy(this.basePos);
    if (this.idleEnabled) {
      this.camera.position.x += Math.sin(time * 0.21) * 0.18;
      this.camera.position.y += Math.sin(time * 0.17 + 1.3) * 0.12;
    }
    this.camera.lookAt(this.lookTarget);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.updateFraming(aspect);
    this.camera.updateProjectionMatrix();
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
