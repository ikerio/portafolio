/* =====================================================================
   assets.ts — boot-time asset loading with progress reporting.
   Phase-1 assets are fonts: the hero point cloud samples letterforms by
   drawing them to a 2D canvas with the Newsreader webfont, so we must
   guarantee the needed weights are loaded before sampling. GLB/DRACO/
   Meshopt wiring will be added here for Phase 2.
   ===================================================================== */

import { Emitter } from './events';

interface AssetEvents extends Record<string, unknown> {
  progress: { loaded: number; total: number; ratio: number };
  complete: void;
  error: Error;
}

// Specific font faces the hero/canvas sampling depends on.
const FONT_FACES = ['600 120px "Newsreader"', '500 32px "JetBrains Mono"'];

export class Assets {
  readonly events = new Emitter<AssetEvents>();
  private loaded = 0;
  private total = FONT_FACES.length + 1;

  private step(): void {
    this.loaded = Math.min(this.loaded + 1, this.total);
    this.events.emit('progress', {
      loaded: this.loaded,
      total: this.total,
      ratio: this.loaded / this.total,
    });
  }

  async load(): Promise<void> {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      this.step();

      for (const face of FONT_FACES) {
        try {
          if (document.fonts?.load) await document.fonts.load(face);
        } catch {
          /* fallback font is acceptable for sampling */
        }
        this.step();
      }

      this.events.emit('complete', undefined);
    } catch (err) {
      this.events.emit('error', err as Error);
      this.events.emit('complete', undefined); // surface the world regardless
    }
  }
}
