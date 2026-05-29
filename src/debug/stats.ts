/* =====================================================================
   stats.ts — fps/ms overlay (dev only). Thin wrapper around stats.js.
   ===================================================================== */

import Stats from 'stats.js';

export class PerfMonitor {
  private stats: Stats;

  constructor() {
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps
    this.stats.dom.style.cssText =
      'position:fixed;top:auto;bottom:8px;left:8px;z-index:9999;opacity:0.7;';
    document.body.appendChild(this.stats.dom);
  }

  begin(): void {
    this.stats.begin();
  }

  end(): void {
    this.stats.end();
  }

  dispose(): void {
    this.stats.dom.remove();
  }
}
