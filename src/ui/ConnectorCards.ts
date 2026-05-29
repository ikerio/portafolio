/* =====================================================================
   ConnectorCards (Tier C) — tiny, non-interactive pull-quotes (Spanish) that
   fade in during the scroll BETWEEN stations, bridging one chapter to the next.
   Each connector lives in the gap between station k and k+1 (by scroll
   progress), peaking at the middle of the gap and fading out by the time the
   next landmark assembles. No expansion, no clutter; narrative glue.
   ===================================================================== */

import { smoothstep } from '../core/math';

// One line per gap between consecutive stations (index k = gap k→k+1).
const CONNECTORS = [
  'Antes del sistema, el oficio.', // 0→1  Who I Am → Foundations
  'La técnica se vuelve método.', // 1→2  Foundations → Systems
  'Del método nacen los mundos.', // 2→3  Systems → Echo
  'Echo refleja el deseo. Witzil restaura lo público.', // 3→4  Echo → Witzil
  'Algunos mundos se construyen a la vista. Otros, en secreto.', // 4→5  Witzil → Gradiente
  'De la infraestructura a la imagen en movimiento.', // 5→6  Gradiente → Tomah
  'Todo sistema tiene su ritmo.', // 6→7  Tomah → Discos
];

export class ConnectorCards {
  private els: HTMLElement[] = [];
  private windows: { a: number; b: number }[] = [];
  private layer: HTMLElement;
  private reduced = false;

  constructor() {
    this.layer = document.getElementById('card-layer')!;
    CONNECTORS.forEach((text) => {
      const el = document.createElement('div');
      el.className = 'connector';
      el.innerHTML = `<span class="connector-mark">//</span><p>${text}</p>`;
      el.style.opacity = '0';
      this.layer.appendChild(el);
      this.els.push(el);
    });
  }

  /** stationProgress: scroll-progress at each station. Connector k spans the
      gap [sp[k], sp[k+1]]. */
  setStationProgress(sp: number[]): void {
    this.windows = this.els.map((_, k) => {
      const a = sp[k];
      const b = sp[k + 1];
      return a == null || b == null ? { a: 2, b: 2 } : { a, b };
    });
  }

  update(progress: number): void {
    for (let k = 0; k < this.els.length; k++) {
      const win = this.windows[k];
      if (!win) continue;
      let o = 0;
      if (progress > win.a && progress < win.b) {
        const t = (progress - win.a) / (win.b - win.a); // 0..1 across the gap
        o = Math.min(smoothstep(0, 0.35, t), 1 - smoothstep(0.65, 1, t)); // peak mid-gap
      }
      const el = this.els[k];
      el.style.opacity = o.toFixed(3);
      const ty = this.reduced ? 0 : (1 - o) * 10;
      el.style.transform = `translate(-50%, -50%) translateY(${ty.toFixed(1)}px)`;
    }
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  dispose(): void {
    this.els.forEach((e) => e.remove());
    this.els = [];
  }
}
