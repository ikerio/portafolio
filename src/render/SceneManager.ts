/* =====================================================================
   SceneManager — scene graph, atmosphere (a baked warm top-right gradient
   backdrop + exponential fog) and the cinematic light rig. Custom shaders
   self-light from config.lightDir; these lights exist for any standard
   materials added later (e.g. the Phase-2 bust).
   ===================================================================== */

import {
  Scene,
  FogExp2,
  Color,
  CanvasTexture,
  SRGBColorSpace,
  DirectionalLight,
  HemisphereLight,
  AmbientLight,
} from 'three';
import { PALETTE, SCENE, TERRAIN_DEFAULTS } from '../core/config';

export class SceneManager {
  readonly scene = new Scene();
  private fog: FogExp2;

  constructor() {
    this.scene.background = this.makeBackdrop();

    this.fog = new FogExp2(new Color(SCENE.fogColor).getHex(), SCENE.fogDensityNear);
    this.scene.fog = this.fog;

    this.buildLights();
  }

  /** Warm radial bloom toward top-right over the matte base (echoes ascii.js). */
  private makeBackdrop(): CanvasTexture {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = PALETTE.bg0;
    ctx.fillRect(0, 0, size, size);

    const g = ctx.createRadialGradient(
      size * 1.0, size * -0.05, 0,
      size * 1.0, size * -0.05, size * 1.15,
    );
    g.addColorStop(0.0, 'rgba(244,232,201,0.20)');
    g.addColorStop(0.4, 'rgba(210,186,140,0.06)');
    g.addColorStop(1.0, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }

  private buildLights(): void {
    const [lx, ly, lz] = TERRAIN_DEFAULTS.lightDir;

    const key = new DirectionalLight(new Color(PALETTE.glowWarm).getHex(), 1.6);
    key.position.set(lx, ly, lz).multiplyScalar(40);

    const fill = new HemisphereLight(
      new Color(PALETTE.glowWarm).getHex(),
      new Color(PALETTE.void).getHex(),
      0.25,
    );

    const ambient = new AmbientLight(new Color(PALETTE.bg2).getHex(), 0.4);

    const rim = new DirectionalLight(new Color(PALETTE.ink1).getHex(), 0.3);
    rim.position.set(-lx, ly * 0.4, -lz).multiplyScalar(40);

    this.scene.add(key, fill, ambient, rim);
  }

  /** Drive fog density from scroll (dense at arrival/contact, thin mid-world). */
  setFogDensity(density: number): void {
    this.fog.density = density;
  }

  dispose(): void {
    (this.scene.background as CanvasTexture)?.dispose?.();
  }
}
