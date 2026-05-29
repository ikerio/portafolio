/* =====================================================================
   AmbientScatter — a sparse field of drifting ASCII glyphs that fades in
   around a composed beat (atmosphere while cards are shown). Glyphs are
   scattered in a box volume and flow slowly; overall opacity ramps in and
   back out over a progress window so the field only appears for its beat.
   ===================================================================== */

import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  NormalBlending,
  Color,
} from 'three';
import vertexShader from '../shaders/ambient.vert';
import fragmentShader from '../shaders/points.frag';
import { getGlyphAtlas } from './glyphAtlas';
import { AMBIENT, PALETTE } from '../core/config';
import { windowProgress, clamp01 } from '../core/math';

export interface AmbientOpts {
  count: number;
  pointSize: number;
  pixelRatio: number;
  center?: [number, number, number];
  revealStart?: number;
  revealEnd?: number;
  hideStart?: number;
  hideEnd?: number;
}

export class AmbientScatter {
  readonly points: Points;
  readonly material: ShaderMaterial;
  private win: { rs: number; re: number; hs: number; he: number };

  constructor(opts: AmbientOpts) {
    const { count } = opts;
    this.win = {
      rs: opts.revealStart ?? AMBIENT.revealStart,
      re: opts.revealEnd ?? AMBIENT.revealEnd,
      hs: opts.hideStart ?? AMBIENT.hideStart,
      he: opts.hideEnd ?? AMBIENT.hideEnd,
    };
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const bright = new Float32Array(count);
    const [cx, cy, cz] = opts.center ?? AMBIENT.center;
    const [ex, ey, ez] = AMBIENT.extent;
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = cx + (Math.random() * 2 - 1) * ex;
      positions[i * 3 + 1] = cy + (Math.random() * 2 - 1) * ey;
      positions[i * 3 + 2] = cz + (Math.random() * 2 - 1) * ez;
      seeds[i] = Math.random();
      bright[i] = 0.25 + Math.random() * 0.6;
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    geo.setAttribute('aBright', new BufferAttribute(bright, 1));

    const atlas = getGlyphAtlas();
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: opts.pointSize },
        uScale: { value: 30 },
        uPixelRatio: { value: opts.pixelRatio },
        uOpacity: { value: 0 },
        uDrift: { value: AMBIENT.drift },
        uGlyphCount: { value: atlas.count },
        uGlyphAtlas: { value: atlas.texture },
        uColorCore: { value: new Color(PALETTE.glowCore) },
        uColorWarm: { value: new Color(PALETTE.ink1) },
      },
    });

    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  update(time: number, progress: number): void {
    const up = windowProgress(progress, this.win.rs, this.win.re);
    const down = windowProgress(progress, this.win.hs, this.win.he);
    this.material.uniforms.uOpacity.value = clamp01(up - down) * AMBIENT.maxOpacity;
    this.material.uniforms.uTime.value = time;
  }

  setPixelRatio(r: number): void {
    this.material.uniforms.uPixelRatio.value = r;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
