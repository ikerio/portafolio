/* =====================================================================
   Chrome — the only persistent UI: brand, minimal nav, a live section
   indicator, a scroll hint that fades after departure, and reduce-motion
   + sound (placeholder) toggles. Built in JS so it can react to scroll.

   The nav is real: each item carries a normalized journey progress and,
   when clicked, scrolls the camera there. The active item + the right-side
   indicator are driven by the current scroll progress.
   ===================================================================== */

export interface NavItem {
  label: string;
  progress: number;
}

interface ChromeOptions {
  navItems: NavItem[];
  onNavigate: (progress: number) => void;
  onReduceMotion: (reduced: boolean) => void;
  onBackToTop: () => void;
  onToggleSound: (on: boolean) => void;
  startReduced: boolean;
}

export class Chrome {
  private root: HTMLElement;
  private indicator!: HTMLElement;
  private hint!: HTMLElement;
  private navEls: HTMLElement[] = [];
  private reduced: boolean;
  private active = -1;

  constructor(private opts: ChromeOptions) {
    this.root = document.getElementById('chrome')!;
    this.reduced = opts.startReduced;
    this.render();
  }

  private render(): void {
    const items = this.opts.navItems;
    this.root.innerHTML = `
      <div class="chrome-left">
        <span class="brand">IT<span>/</span></span>
        <span class="tagline">Mitos ejecutables<br>mecanismos vivos</span>
      </div>
      <nav class="chrome-nav">
        ${items
          .map(
            (n, i) =>
              `<span class="nav-item${i === 0 ? ' on' : ''}" role="button" tabindex="0">0${i + 1} ${n.label}</span>`,
          )
          .join('')}
      </nav>
      <div class="chrome-right">
        <span class="indicator" id="chrome-indicator">01 · ${items[0]?.label ?? ''}</span>
        <button class="toggle" id="toggle-motion" aria-pressed="${this.reduced}">
          ${this.reduced ? 'Movimiento reducido' : 'Reducir movimiento'}
        </button>
        <button class="toggle" id="toggle-sound" aria-pressed="false">Sonido apagado</button>
      </div>`;

    this.indicator = this.root.querySelector('#chrome-indicator')!;

    // Wire nav items: click + keyboard (Enter/Space) navigate to their progress.
    this.navEls = Array.from(this.root.querySelectorAll<HTMLElement>('.nav-item'));
    this.navEls.forEach((el, i) => {
      const go = () => this.opts.onNavigate(items[i].progress);
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });

    this.hint = document.createElement('div');
    this.hint.className = 'scroll-hint';
    this.hint.innerHTML = `<span class="mouse"></span><span>Desplázate para navegar</span>`;
    document.body.appendChild(this.hint);

    this.root.querySelector('#toggle-motion')!.addEventListener('click', (e) => {
      this.reduced = !this.reduced;
      const btn = e.currentTarget as HTMLButtonElement;
      btn.setAttribute('aria-pressed', String(this.reduced));
      btn.textContent = this.reduced ? 'Movimiento reducido' : 'Reducir movimiento';
      this.opts.onReduceMotion(this.reduced);
    });

    this.root.querySelector('.brand')!.addEventListener('click', () => this.opts.onBackToTop());

    let soundOn = false;
    this.root.querySelector('#toggle-sound')!.addEventListener('click', (e) => {
      soundOn = !soundOn;
      const btn = e.currentTarget as HTMLButtonElement;
      btn.setAttribute('aria-pressed', String(soundOn));
      btn.textContent = soundOn ? 'Sonido encendido' : 'Sonido apagado';
      this.opts.onToggleSound(soundOn);
    });
  }

  update(progress: number): void {
    const items = this.opts.navItems;
    // Active = the last nav item we've reached (small epsilon so a checkpoint
    // lights up as soon as we arrive, not one frame late).
    let idx = 0;
    for (let i = 0; i < items.length; i++) {
      if (progress >= items[i].progress - 0.01) idx = i;
    }
    if (idx !== this.active) {
      this.navEls.forEach((el, i) => el.classList.toggle('on', i === idx));
      this.active = idx;
      const n = String(idx + 1).padStart(2, '0');
      this.indicator.textContent = `${n} · ${items[idx].label}`;
    }

    // Fade the scroll hint once the visitor has begun the journey.
    this.hint.style.opacity = progress > 0.04 ? '0' : '1';
  }
}
