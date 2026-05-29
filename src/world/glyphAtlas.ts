/* =====================================================================
   glyphAtlas.ts — ASCII glyph atlases shared across the world. The default
   ramp (dark→light density) is used by the hero, landmarks, road, scatter.
   A separate GRASS ramp of vertical blade-strokes (| ! / \ l) makes the
   garden read as blades, not dots. One row of cells, white on transparent,
   sampled per-point by brightness. Built once per char-set, cached.
   ===================================================================== */

import { CanvasTexture, LinearFilter, type Texture } from 'three';
import { HERO } from '../core/config';

export interface Atlas {
  texture: Texture;
  count: number;
}

/** Vertical blade strokes (weighted toward `|`) so the garden reads as grass. */
export const GRASS_RAMP = [' ', '.', ':', 'i', 'l', '|', '!', '/', '|', '\\', 'Y', '|'];

/** Redaction ramp — ends in solid blocks (▓ █) so dense cells read as
    blacked-out bars, not a cluster of @. Lighter chars = HUD chrome lines. */
export const REDACT_RAMP = [' ', '·', ':', '+', '=', '#', '▓', '█'];

const cache = new Map<string, Atlas>();

function buildAtlas(chars: readonly string[]): Atlas {
  const key = chars.join('');
  const hit = cache.get(key);
  if (hit) return hit;

  const cell = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cell * chars.length;
  canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(cell * 0.8)}px "JetBrains Mono", ui-monospace, monospace`;
  chars.forEach((ch, i) => ctx.fillText(ch, i * cell + cell / 2, cell / 2 + 2));

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;

  const atlas: Atlas = { texture, count: chars.length };
  cache.set(key, atlas);
  return atlas;
}

export function getGlyphAtlas(): Atlas {
  return buildAtlas(HERO.glyphRamp);
}

export function getGrassAtlas(): Atlas {
  return buildAtlas(GRASS_RAMP);
}

export function getRedactAtlas(): Atlas {
  return buildAtlas(REDACT_RAMP);
}
