/* =====================================================================
   TrajectoryPanel — the closing "Trajectory" finale. As the camera lifts to a
   near top-down survey of the whole route (journey finale node) and the path
   lights up as a spine, this glass panel fades in: a vertical timeline of the
   dated roles, its own spine line + node dots echoing the lit path. Revealed by
   scroll progress over the finale window. Spanish, no em dashes.
   ===================================================================== */

import { smoothstep } from '../core/math';

// Dated roles (from the CV), chronological. No em dashes anywhere.
const ROLES: [string, string, string][] = [
  ['2017 a 2018', 'Amyntor Group', 'Consultor de ciberseguridad'],
  ['2018 a 2019', 'Discos Movimiento', 'Fundador, colectivo de música electrónica'],
  ['2021 a 2023', 'Witzil', 'Fundador'],
  ['2024 a hoy', 'Echo', 'Creador'],
  ['2026', 'Gradiente MX', 'Fundador / CTO'],
  ['2026', 'Tomah', 'Fundador / CTO'],
];

export class TrajectoryPanel {
  private el: HTMLElement;
  private start = 0.9; // progress at which the finale begins
  private reduced = false;

  constructor() {
    const layer = document.getElementById('card-layer')!;
    this.el = document.createElement('section');
    this.el.className = 'traj';
    this.el.style.setProperty('--reveal', '0');
    const rows = ROLES.map(
      ([d, o, r]) =>
        `<li><span class="traj-date">${d}</span><span class="traj-org">${o}</span><span class="traj-role">${r}</span></li>`,
    ).join('');
    this.el.innerHTML = `
      <div class="traj-panel">
        <span class="bracket tl"></span><span class="bracket tr"></span>
        <span class="bracket bl"></span><span class="bracket br"></span>
        <div class="traj-kicker">// TRAYECTORIA</div>
        <h2 class="traj-title">Una sola línea, muchos mundos</h2>
        <ul class="traj-list">${rows}</ul>
      </div>`;
    layer.appendChild(this.el);
  }

  /** Progress at which the finale beat begins (last station → 1.0). */
  setWindow(start: number): void {
    this.start = start;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  update(progress: number): void {
    const o = smoothstep(this.start, Math.min(1, this.start + 0.06), progress);
    this.el.style.opacity = o.toFixed(3);
    this.el.style.setProperty('--reveal', o.toFixed(3));
    this.el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
    const ty = this.reduced ? 0 : (1 - o) * 16;
    this.el.style.transform = `translate(-50%, -50%) translateY(${ty.toFixed(1)}px)`;
  }

  dispose(): void {
    this.el.remove();
  }
}
