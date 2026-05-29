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

  constructor(aspect: number, positionNodes: Vector3[], targetNodes: Vector3[]) {
    this.camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);

    this.positionCurve = new CatmullRomCurve3(positionNodes, false, 'catmullrom', 0.5);
    this.targetCurve = new CatmullRomCurve3(targetNodes, false, 'catmullrom', 0.5);

    // Place at the start so the very first frame is composed.
    this.apply(0, 0, 0);
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

    this.camera.position.copy(this.basePos);
    if (this.idleEnabled) {
      this.camera.position.x += Math.sin(time * 0.21) * 0.18;
      this.camera.position.y += Math.sin(time * 0.17 + 1.3) * 0.12;
    }
    this.camera.lookAt(this.lookTarget);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
