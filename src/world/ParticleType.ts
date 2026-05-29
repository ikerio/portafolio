/* =====================================================================
   ParticleType — the hero identity as an ASCII glyph cloud. "IT" reads as
   shaded ASCII characters, then morphs/disperses into "IKER TOLEDO".

   Each wordmark is drawn to a 2D canvas (Newsreader), then sampled on a
   regular grid: each filled cell becomes one glyph point carrying its
   coverage (aShade). A glyph atlas (one row of ramp characters) is sampled
   in the fragment shader, the character chosen per-point by brightness —
   so the form reads as ASCII sculpture, not soft particles. Source/target
   are cycled to an equal count so the vertex shader can lerp 1:1.
   ===================================================================== */

import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  NormalBlending,
  Color,
} from 'three';
import vertexShader from '../shaders/points.vert';
import fragmentShader from '../shaders/points.frag';
import { HERO, PALETTE } from '../core/config';
import { getGlyphAtlas } from './glyphAtlas';

interface Grid {
  positions: number[];
  shades: number[];
  count: number;
}

/** Grid-sample the filled letterforms of `text` into world-space glyph points,
    extruded across `layers` z-planes spanning `depth` so the wordmark has volume. */
function sampleTextGrid(
  text: string,
  targetHeight: number,
  cell: number,
  layers: number,
  depth: number,
  depthJitter: number,
): Grid {
  const lines = text.split('\n');
  const W = 1100;
  const H = 700;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontPx = lines.length > 1 ? 200 : 360;
  ctx.font = `${HERO.fontWeight} ${fontPx}px "${HERO.fontFamily}", Georgia, serif`;
  const lineH = fontPx * 0.96;
  const startY = H / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, W / 2, startY + i * lineH));

  const data = ctx.getImageData(0, 0, W, H).data;
  const alphaAt = (x: number, y: number) => data[(y * W + x) * 4 + 3];

  // Bounding box of the filled pixels → uniform scale + centering.
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (alphaAt(x, y) > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const scale = targetHeight / Math.max(1, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const positions: number[] = [];
  const shades: number[] = [];
  for (let gy = 0; gy < H; gy += cell) {
    for (let gx = 0; gx < W; gx += cell) {
      let cov = 0;
      let tot = 0;
      for (let sy = 0; sy < cell; sy += 2) {
        for (let sx = 0; sx < cell; sx += 2) {
          const px = gx + sx;
          const py = gy + sy;
          if (px < W && py < H) {
            tot++;
            if (alphaAt(px, py) > 128) cov++;
          }
        }
      }
      const c = tot ? cov / tot : 0;
      if (c < 0.3) continue;
      const ccx = gx + cell / 2;
      const ccy = gy + cell / 2;
      const wx = (ccx - cx) * scale;
      const wy = -(ccy - cy) * scale;
      for (let l = 0; l < layers; l++) {
        const lz = layers > 1 ? (l / (layers - 1) - 0.5) * depth : 0;
        positions.push(
          wx + (Math.random() - 0.5) * 0.04,
          wy + (Math.random() - 0.5) * 0.04,
          lz + (Math.random() - 0.5) * depthJitter,
        );
        shades.push(c);
      }
    }
  }
  return { positions, shades, count: shades.length };
}

export class ParticleType {
  readonly points: Points;
  readonly material: ShaderMaterial;
  private swayEnabled = true;

  constructor(cell: number, layers: number, pointSize: number, pixelRatio: number) {
    const a = sampleTextGrid(HERO.initials, HERO.initialsHeight, cell, layers, HERO.initialsDepth, HERO.depthJitter);
    const b = sampleTextGrid(HERO.fullName, HERO.nameHeight, cell, layers, HERO.nameDepth, HERO.depthJitter);
    const n = Math.max(a.count, b.count);

    const source = new Float32Array(n * 3);
    const target = new Float32Array(n * 3);
    const shades = new Float32Array(n);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ia = i % a.count;
      const ib = i % b.count;
      source[i * 3 + 0] = a.positions[ia * 3 + 0];
      source[i * 3 + 1] = a.positions[ia * 3 + 1];
      source[i * 3 + 2] = a.positions[ia * 3 + 2];
      target[i * 3 + 0] = b.positions[ib * 3 + 0];
      target[i * 3 + 1] = b.positions[ib * 3 + 1];
      target[i * 3 + 2] = b.positions[ib * 3 + 2];
      shades[i] = a.shades[ia];
      seeds[i] = Math.random();
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(source, 3));
    geo.setAttribute('aTarget', new BufferAttribute(target, 3));
    geo.setAttribute('aShade', new BufferAttribute(shades, 1));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1));

    const atlas = getGlyphAtlas();

    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uMorphProgress: { value: 0 },
        uTime: { value: 0 },
        uSize: { value: pointSize },
        uScale: { value: HERO.sizeScale },
        uDispersion: { value: 1.4 },
        uPixelRatio: { value: pixelRatio },
        uOpacity: { value: 1 },
        uGlyphCount: { value: atlas.count },
        uGlyphAtlas: { value: atlas.texture },
        uColorCore: { value: new Color(PALETTE.glowCore) },
        uColorWarm: { value: new Color(PALETTE.ink0) },
      },
    });

    this.points = new Points(geo, this.material);
    this.points.position.set(HERO.position[0], HERO.position[1], HERO.position[2]);
    this.points.frustumCulled = false;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
    // Gentle turntable sway reveals the z-extrusion as real volume.
    this.points.rotation.y = this.swayEnabled
      ? Math.sin(time * 0.3) * HERO.swayAmplitude
      : 0;
  }

  setSway(enabled: boolean): void {
    this.swayEnabled = enabled;
  }

  setMorph(p: number): void {
    this.material.uniforms.uMorphProgress.value = p;
  }

  setOpacity(o: number): void {
    this.material.uniforms.uOpacity.value = o;
  }

  setPixelRatio(r: number): void {
    this.material.uniforms.uPixelRatio.value = r;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    // glyph atlas is a shared singleton — not disposed here
  }
}
