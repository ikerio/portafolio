/* =====================================================================
   CVFallback — the accessible spine of the site. The full CV lives in the
   DOM at all times (screen readers reach it even during the 3D experience,
   where it is visually hidden). It is revealed as a readable document when
   WebGL is unavailable, or when the visitor turns the experience off.
   Content mirrors the storyboard; contact = deikerio@gmail.com.
   ===================================================================== */

const FOUNDATIONS = [
  ['Diseño Industrial', 'Universidad Iberoamericana', 'Forma, función, la disciplina de hacer.'],
  ['Producción Musical', 'SAE Institute', 'Diseño de sonido, señal, el estudio como sistema.'],
  ['Music Business', 'Alquimia', 'La economía y los derechos detrás del disco.'],
];

const TRAJECTORY = [
  ['2017 a 2018', 'Amyntor Group', 'Consultor de ciberseguridad'],
  ['2018 a 2019', 'Discos Movimiento', 'Fundador, colectivo de música electrónica'],
  ['2021 a 2023', 'Witzil', 'Fundador'],
  ['2024 a hoy', 'Echo · Agente de IA / Echo Isle', 'Creador'],
  ['2026', 'Gradiente MX', 'Fundador / CTO'],
  ['2026', 'Tomah', 'Fundador / CTO'],
];

export class CVFallback {
  private root: HTMLElement;

  constructor() {
    this.root = document.getElementById('cv-fallback')!;
    this.render();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="cv-doc">
        <button class="cv-close" id="cv-close" aria-label="Volver a la experiencia">Cerrar ✕</button>
        <header class="cv-head">
          <p class="cv-eyebrow">Currículum</p>
          <h1>Iker Toledo</h1>
          <p class="cv-role">Mitos ejecutables, mecanismos vivos</p>
          <p class="cv-lede">Diseñador industrial convertido en fundador y tecnólogo. Me muevo entre
            disciplinas (forma, sonido, software, sistemas), unidas por el pensamiento sistémico.</p>
        </header>

        <section class="cv-section">
          <h2>Fundamentos</h2>
          <ul class="cv-list">
            ${FOUNDATIONS.map(
              ([t, i, d]) =>
                `<li><span class="cv-t">${t}</span><span class="cv-i">${i}</span><span class="cv-d">${d}</span></li>`,
            ).join('')}
          </ul>
        </section>

        <section class="cv-section">
          <h2>Trayectoria</h2>
          <ul class="cv-list">
            ${TRAJECTORY.map(
              ([date, org, role]) =>
                `<li><span class="cv-date">${date}</span><span class="cv-org">${org}</span><span class="cv-d">${role}</span></li>`,
            ).join('')}
          </ul>
        </section>

        <footer class="cv-foot">
          <h2>Contacto</h2>
          <p>
            <a href="mailto:deikerio@gmail.com">deikerio@gmail.com</a>
            &nbsp;·&nbsp;
            <a href="#" rel="noopener">LinkedIn</a>
          </p>
          <p class="cv-note">© 2025 Iker Toledo</p>
        </footer>
      </div>`;

    this.root.querySelector('#cv-close')!.addEventListener('click', () => this.hide());
  }

  reveal(): void {
    document.body.classList.add('cv-open');
  }

  hide(): void {
    document.body.classList.remove('cv-open');
  }

  /** Permanent fallback when WebGL is unavailable — no way back to the 3D view. */
  forcePermanent(): void {
    document.body.classList.add('cv-open', 'cv-permanent');
    this.root.querySelector('#cv-close')?.remove();
  }
}
