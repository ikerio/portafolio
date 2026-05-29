/* =====================================================================
   Steps — the glowing ASCII path of steps through the Systems arch. A run
   of horizontal treads (lines of glyph points) along the path direction,
   ascending through the gate, with a brightness pulse flowing up the path.
   Reuses road.vert + points.frag; reveals with the garden context.
   ===================================================================== */

import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  AdditiveBlending,
  Color,
  type Vector3,
} from 'three';
import vertexShader from '../shaders/road.vert';
import fragmentShader from '../shaders/points.frag';
import { getGlyphAtlas } from './glyphAtlas';
import { STEPS, PALETTE } from '../core/config';

export interface StepsOpts {
  center: Vector3;
  dir: Vector3; // path direction (xz, normalized)
  pixelRatio: number;
}

export class Steps {
  readonly points: Points;
  readonly material: ShaderMaterial;

  constructor(opts: StepsOpts) {
    const { center, dir } = opts;
    const px = -dir.z; // perpendicular (xz)
    const pz = dir.x;

    const total = STEPS.count * STEPS.perTread;
    const position = new Float32Array(total * 3);
    const aSeed = new Float32Array(total);
    const aBright = new Float32Array(total);
    const aT = new Float32Array(total);
    const aKeep = new Float32Array(total); // 0 → always shown

    let w = 0;
    for (let s = 0; s < STEPS.count; s++) {
      const i = s - STEPS.back; // i<0 foreground, i>0 through the arch
      const along = i * STEPS.depth;
      const y = center.y + i * STEPS.rise;
      for (let j = 0; j < STEPS.perTread; j++) {
        const lateral = (j / (STEPS.perTread - 1) - 0.5) * 2 * STEPS.halfWidth + (Math.random() - 0.5) * 0.18;
        position[w * 3 + 0] = center.x + dir.x * along + px * lateral;
        position[w * 3 + 1] = y + (Math.random() - 0.5) * 0.12;
        position[w * 3 + 2] = center.z + dir.z * along + pz * lateral;
        aSeed[w] = Math.random();
        aBright[w] = 0.55 + Math.random() * 0.4;
        aT[w] = s / (STEPS.count - 1);
        aKeep[w] = 0;
        w++;
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(position, 3));
    geo.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
    geo.setAttribute('aBright', new BufferAttribute(aBright, 1));
    geo.setAttribute('aT', new BufferAttribute(aT, 1));
    geo.setAttribute('aKeep', new BufferAttribute(aKeep, 1));

    const atlas = getGlyphAtlas();
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: STEPS.pointSize },
        uScale: { value: 30 },
        uPixelRatio: { value: opts.pixelRatio },
        uReveal: { value: 0 },
        uFlowSpeed: { value: 2.0 },
        uYOffset: { value: 0 },
        uDensity: { value: 1 },
        uGlyphCount: { value: atlas.count },
        uGlyphAtlas: { value: atlas.texture },
        uColorCore: { value: new Color(PALETTE.glowCore) },
        uColorWarm: { value: new Color(PALETTE.amber) },
      },
    });

    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  setReveal(v: number): void {
    this.material.uniforms.uReveal.value = v;
  }

  setPixelRatio(r: number): void {
    this.material.uniforms.uPixelRatio.value = r;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
