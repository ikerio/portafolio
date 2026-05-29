/* =====================================================================
   GradienteMosaic — the Gradiente MX landmark (station 5, under NDA). Instead
   of a 3D glyph slab, it replicates the product's own UI — a content MOSAIC of
   brushed-glass tiles and an OPEN/CLOSE reader OVERLAY — as classified ASCII.
   The mosaic is a glass panel anchored to the station (projected each frame,
   like the info cards) that CRT-boots in with the chapter; clicking a tile
   opens a reader overlay (CRT grow + phosphor flash, ESC/backdrop closes) with
   a fake "decryption" that stalls at ACCESO DENEGADO. Everything is redacted
   (█/▓ ASCII), framed in the NGE chrome recolored to amber — no NDA leak.
   ===================================================================== */

import { Vector3, type PerspectiveCamera } from 'three';
import { clamp01 } from '../core/math';

interface TileDef {
  type: string;
  cls: string; // size-tier classes
  art: string; // redacted ASCII content
}

// The mosaic tiles — size/position carry prominence (the product's only signal),
// content fully redacted into ASCII blocks + small terminal motifs.
const TILES: TileDef[] = [
  { type: '//EN PORTADA', cls: 'feature', art: '████████████  ███████   ██ ████' },
  { type: '//CASO·07', cls: 'w2 h2', art: '▓▓▓▓▓▓\n██ █████\n███████\n[ SELLADO ]' },
  { type: '//SEÑAL', cls: '', art: '▁▂▃▅▇█▇▅' },
  { type: '//VIBE', cls: 'w2', art: 'GLACIAL ├───●────┤ VOLCÁN' },
  { type: '//ARCHIVO', cls: '', art: '████\n██ █' },
  { type: '//DATA', cls: '', art: '[███··]\n41%' },
  { type: '//EXPEDIENTE', cls: 'w2', art: '███████ ████  ▓▓▓ ██' },
  { type: '//NODO', cls: '', art: '◢▓◣\n▓█▓' },
  { type: '//ESCENA·MX', cls: '', art: '██ ███' },
];

const TICKER =
  'CLEARANCE·REQUERIDO // EXPEDIENTE·SELLADO // SUBJECT·REDACTED // NIVEL·DE·ACCESO·03 // DO·NOT·DISTRIBUTE // ';

export class GradienteMosaic {
  private el: HTMLElement; // anchored mosaic panel (in #card-layer)
  private overlay: HTMLElement; // fullscreen reader overlay (in body)
  private progEl?: HTMLElement;
  private readonly anchor = new Vector3();
  private readonly world = new Vector3();
  private reduced = false;
  private progTimer?: number;

  constructor() {
    const layer = document.getElementById('card-layer')!;
    this.el = document.createElement('div');
    this.el.className = 'grad-mosaic';
    this.el.style.setProperty('--reveal', '0');
    const tiles = TILES.map(
      (t) => `
        <div class="grad-tile clickable ${t.cls}">
          <span class="accent"></span>
          <div class="tt">${t.type}</div>
          <div class="art">${t.art}</div>
          <span class="corner">⌐</span>
        </div>`,
    ).join('');
    this.el.innerHTML = `
      <div class="grad-panel">
        <span class="bracket tl"></span><span class="bracket tr"></span>
        <span class="bracket bl"></span><span class="bracket br"></span>
        <div class="grad-head">
          <span class="grad-id">// GRADIENTE·MX · EXPEDIENTE</span>
          <span class="grad-status"><span class="dot">●</span> CLASIFICADO</span>
        </div>
        <div class="grad-grid">${tiles}</div>
        <div class="grad-ticker"><span>${TICKER.repeat(2)}</span></div>
      </div>`;
    layer.appendChild(this.el);

    // Fullscreen reader overlay.
    this.overlay = document.createElement('div');
    this.overlay.className = 'grad-overlay';
    this.overlay.innerHTML = `
      <div class="grad-overlay-bg"></div>
      <article class="grad-reader">
        <div class="grad-phosphor"></div>
        <div class="grad-sess"><span>// EXPEDIENTE · GRADIENTE-MX · ● CLASIFICADO</span><span class="x">[ESC] CERRAR</span></div>
        <div class="grad-rtitle">█████████  ████ ███████</div>
        <div class="grad-rbody">
          <div>████████ ███████████ ████ ██████████████ ███████ ████.</div>
          <div>███ ████████ · ████-████████ · ███████████████ ████████.</div>
          <div>██████████████ ████ ███████ ████████████ ███ ████████.</div>
        </div>
        <div class="grad-rail">
          <div class="mod"><b>01</b> ARCHIVO ··········· ▓▓▓▓▓▓</div>
          <div class="mod"><b>02</b> CONTEXTO ·········· ████ · ████</div>
          <div class="mod"><b>03</b> ETIQUETAS ········· # ████  # ████</div>
        </div>
        <div class="grad-prog">DESCIFRANDO [··········] 00%</div>
        <div class="grad-hazard"></div>
      </article>`;
    document.body.appendChild(this.overlay);
    this.progEl = this.overlay.querySelector('.grad-prog') as HTMLElement;

    // Open on tile click; close on ESC / backdrop / X.
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.grad-tile')) this.open();
    });
    this.overlay.querySelector('.grad-overlay-bg')!.addEventListener('click', () => this.close());
    this.overlay.querySelector('.grad-sess .x')!.addEventListener('click', () => this.close());
    window.addEventListener('keydown', this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.overlay.classList.contains('on')) this.close();
  };

  private open(): void {
    this.overlay.classList.remove('closing');
    this.overlay.classList.add('on');
    // Restart the CRT boot-in by reflowing the animated nodes.
    this.overlay.querySelectorAll<HTMLElement>('.grad-reader, .grad-overlay-bg, .grad-phosphor').forEach((n) => {
      n.style.animation = 'none';
      void n.offsetWidth;
      n.style.animation = '';
    });
    // Fake decryption: climbs, then stalls at ACCESO DENEGADO.
    window.clearInterval(this.progTimer);
    if (this.reduced) {
      this.setProg(37, true);
      return;
    }
    let p = 0;
    this.progTimer = window.setInterval(() => {
      p += 3 + Math.random() * 5;
      if (p >= 37) {
        this.setProg(37, true);
        window.clearInterval(this.progTimer);
      } else {
        this.setProg(p, false);
      }
    }, 90);
  }

  private setProg(p: number, denied: boolean): void {
    if (!this.progEl) return;
    const f = Math.round(clamp01(p / 100) * 10);
    const bar = '█'.repeat(f) + '·'.repeat(10 - f);
    this.progEl.textContent = denied
      ? `ACCESO DENEGADO [${bar}] NIVEL·03`
      : `DESCIFRANDO [${bar}] ${Math.round(p).toString().padStart(2, '0')}%`;
  }

  private close(): void {
    window.clearInterval(this.progTimer);
    if (this.reduced) {
      this.overlay.classList.remove('on', 'closing');
      return;
    }
    this.overlay.classList.add('closing');
    const bg = this.overlay.querySelector('.grad-overlay-bg')!;
    const done = (): void => {
      this.overlay.classList.remove('on', 'closing');
      bg.removeEventListener('animationend', done);
    };
    bg.addEventListener('animationend', done);
  }

  /** Station world point the mosaic floats at. */
  setAnchor(point: Vector3, lift = 6): void {
    this.anchor.copy(point);
    this.anchor.y += lift;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  /** reveal = station-5 reveal (0..1); positions + CRT-boots the panel. */
  update(reveal: number, camera: PerspectiveCamera): void {
    const r = clamp01(reveal);
    this.el.style.setProperty('--reveal', r.toFixed(3));
    this.world.copy(this.anchor).project(camera);
    const behind = this.world.z > 1;
    if (behind || r < 0.002) {
      this.el.style.opacity = '0';
      this.el.style.pointerEvents = 'none';
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = (this.world.x * 0.5 + 0.5) * w;
    const y = (-this.world.y * 0.5 + 0.5) * h;
    this.el.style.opacity = r.toFixed(3);
    this.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.el.style.pointerEvents = r > 0.85 ? 'auto' : 'none';
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    window.clearInterval(this.progTimer);
    this.el.remove();
    this.overlay.remove();
  }
}
