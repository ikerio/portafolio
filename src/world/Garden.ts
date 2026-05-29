/* =====================================================================
   Garden — ASCII vegetation around a station (the Systems arch). Fewer,
   bigger, distinct plants: each plant is a few BLADE STROKES (lines of
   glyph points) fanning from a base, so it reads as foliage rather than a
   uniform cloud. Three types — short tuft, tall grass, reed-with-bloom —
   chosen per region. Region noise drives CLUMPING (bare patches) and HEIGHT
   variation (short areas vs tall). Warm, density-ramp glyphs, swaying.
   ===================================================================== */

import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  NormalBlending,
  Color,
  type Vector3,
} from 'three';
import vertexShader from '../shaders/garden.vert';
import fragmentShader from '../shaders/points.frag';
import { getGlyphAtlas } from './glyphAtlas';
import { GARDEN, PALETTE } from '../core/config';

export interface GardenOpts {
  center: Vector3;
  plantCount: number;
  pixelRatio: number;
  pathDir?: Vector3; // if set, clear a lane along this direction for the steps
}

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// cheap deterministic value noise for region clumping / height fields
const nhash = (x: number, z: number) => {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
};
function vnoise(x: number, z: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = nhash(xi, zi);
  const b = nhash(xi + 1, zi);
  const c = nhash(xi, zi + 1);
  const d = nhash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b + d - c) * u * v;
}

// dynamic accumulators (plant point counts vary by type)
interface Acc {
  pos: number[];
  off: number[];
  t: number[];
  phase: number[];
  mix: number[];
  seed: number[];
}

function addBlade(
  acc: Acc,
  bx: number,
  by: number,
  bz: number,
  rot: number,
  bend: number,
  height: number,
  k: number,
  mix: number,
  phase: number,
  seed: number,
): void {
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < k; i++) {
    const t = i / (k - 1);
    const lat = bend * t * t; // blade's own static curve
    acc.pos.push(bx, by, bz);
    acc.off.push(cr * lat, t * height, sr * lat);
    acc.t.push(t);
    acc.phase.push(phase);
    acc.mix.push(mix);
    acc.seed.push(seed);
  }
}

function addBloom(
  acc: Acc,
  bx: number,
  by: number,
  bz: number,
  topY: number,
  radius: number,
  count: number,
  mix: number,
  phase: number,
  seed: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const r = radius * Math.sqrt(Math.random());
    acc.pos.push(bx, by, bz);
    acc.off.push(Math.cos(a) * r, topY + (Math.random() - 0.5) * radius, Math.sin(a) * r);
    acc.t.push(1.0); // bloom sits at the tip (brightest)
    acc.phase.push(phase);
    acc.mix.push(mix);
    acc.seed.push(seed);
  }
}

export class Garden {
  readonly points: Points;
  readonly material: ShaderMaterial;

  constructor(opts: GardenOpts) {
    const { center, plantCount } = opts;
    const R = GARDEN.regionRadius;
    const r0 = GARDEN.clearRadius;
    const hs = GARDEN.heightScale;

    const annulusFrac = (R * R - r0 * r0) / (4 * R * R);
    const gridN = Math.max(1, Math.ceil(Math.sqrt(plantCount / Math.max(0.05, annulusFrac))));
    const cell = (R * 2) / gridN;
    const jitter = 0.9;

    const acc: Acc = { pos: [], off: [], t: [], phase: [], mix: [], seed: [] };

    // perpendicular to the path direction, for clearing the steps' lane
    const perpX = opts.pathDir ? -opts.pathDir.z : 0;
    const perpZ = opts.pathDir ? opts.pathDir.x : 0;

    for (let gx = 0; gx < gridN; gx++) {
      for (let gz = 0; gz < gridN; gz++) {
        const lx = (gx + 0.5 + (Math.random() - 0.5) * jitter) * cell - R;
        const lz = (gz + 0.5 + (Math.random() - 0.5) * jitter) * cell - R;
        const d = Math.hypot(lx, lz);
        if (d < r0 || d > R) continue;

        const wx = center.x + lx;
        const wz = center.z + lz;

        // clear a corridor for the path of steps
        if (opts.pathDir && Math.abs(lx * perpX + lz * perpZ) < GARDEN.laneHalfWidth) continue;

        // CLUMPING — small scattered bare patches (higher freq + lower threshold
        // so no single large gap, e.g. on one side)
        if (vnoise(wx * 0.12, wz * 0.12) < 0.22) continue;
        // region HEIGHT field (short areas vs tall)
        const hf = vnoise(wx * 0.045 + 11, wz * 0.045 + 11); // 0..1
        const localH = lerp(0.8, 1.35, hf) * hs;

        const plantRot = Math.random() * TAU;
        const mix = Math.random();
        const phase = Math.random() * TAU;
        const seed = Math.random();

        // type by region height + chance
        const tr = Math.random();
        let type: 'tuft' | 'tall' | 'reed';
        if (hf > 0.62 && tr < 0.45) type = 'reed';
        else if (hf > 0.45) type = 'tall';
        else type = 'tuft';

        if (type === 'tuft') {
          const blades = 5 + ((Math.random() * 3) | 0);
          for (let b = 0; b < blades; b++) {
            const rot = plantRot + (b / blades - 0.5) * 1.3 + (Math.random() - 0.5) * 0.4;
            addBlade(acc, wx, center.y, wz, rot, 0.15 + Math.random() * 0.25,
              lerp(0.8, 1.4, Math.random()) * localH, 7, mix, phase, seed);
          }
        } else if (type === 'tall') {
          const blades = 4 + ((Math.random() * 3) | 0);
          for (let b = 0; b < blades; b++) {
            const rot = plantRot + (b / blades - 0.5) * 0.8 + (Math.random() - 0.5) * 0.3;
            addBlade(acc, wx, center.y, wz, rot, 0.25 + Math.random() * 0.45,
              lerp(2.2, 3.4, Math.random()) * localH, 9, mix, phase, seed);
          }
        } else {
          const blades = 2 + ((Math.random() * 2) | 0);
          const h = lerp(3.2, 5.0, Math.random()) * localH;
          for (let b = 0; b < blades; b++) {
            const rot = plantRot + (b / blades - 0.5) * 0.4;
            addBlade(acc, wx, center.y, wz, rot, 0.08 + Math.random() * 0.2, h, 10, mix, phase, seed);
          }
          addBloom(acc, wx, center.y, wz, h, 0.45, 14, Math.min(1, mix + 0.2), phase, seed);
        }
      }
    }

    const position = new Float32Array(acc.pos);
    const aOffset = new Float32Array(acc.off);
    const aT = new Float32Array(acc.t);
    const aWindPhase = new Float32Array(acc.phase);
    const aColorMix = new Float32Array(acc.mix);
    const aSeed = new Float32Array(acc.seed);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(position, 3));
    geo.setAttribute('aOffset', new BufferAttribute(aOffset, 3));
    geo.setAttribute('aT', new BufferAttribute(aT, 1));
    geo.setAttribute('aWindPhase', new BufferAttribute(aWindPhase, 1));
    geo.setAttribute('aColorMix', new BufferAttribute(aColorMix, 1));
    geo.setAttribute('aSeed', new BufferAttribute(aSeed, 1));

    const atlas = getGlyphAtlas();
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: GARDEN.pointSize },
        uScale: { value: 30 },
        uPixelRatio: { value: opts.pixelRatio },
        uReveal: { value: 0 },
        uWindStrength: { value: GARDEN.windStrength },
        uWindSpeed: { value: GARDEN.windSpeed },
        uGlyphCount: { value: atlas.count },
        uGlyphAtlas: { value: atlas.texture },
        uColorWarm: { value: new Color(PALETTE.amberDim) },
        uColorCore: { value: new Color(PALETTE.glowWarm) },
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
