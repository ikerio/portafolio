/* =====================================================================
   CardSystem — per-station glass info-cards (Spanish). Each card anchors to a
   station's route point + offset and reveals as that landmark becomes active.
   Tier A: the brief anchored card. Tier B: rich cards carry an `overlay` —
   clicking opens a generalized glass "reader" with the fuller narrative; those
   cards show a subtle "ampliar" indicator. (Tier C connector cards live in
   ConnectorCards.ts.)
   ===================================================================== */

import { Vector3, type PerspectiveCamera } from 'three';
import { clamp01 } from '../core/math';

/** The expanded "reader" shown when a rich card is clicked. */
interface OverlayDef {
  kicker?: string;
  title: string;
  body: string[];
  meta?: [string, string][];
  note?: string;
}

interface CardDef {
  offset: [number, number, number]; // from the station's world point
  num: string;
  title: string;
  body: string;
  foot: [string, string];
  overlay?: OverlayDef; // present → card is expandable
}

// Content per station (index = station). Copy in Spanish; rich sections carry an
// overlay. ⚠ = needs Iker's confirmation (year/fact gaps flagged in the chat).
const STATION_CARDS: CardDef[][] = [
  [
    {
      offset: [-6, 9, 6.5], num: 'PERFIL', title: 'El hacedor',
      body: 'Me muevo entre disciplinas (forma, sonido, software, sistemas). El hilo son los sistemas, y las personas dentro de ellos.',
      foot: ['QUIÉN SOY', '↗'],
      overlay: {
        kicker: 'QUIÉN SOY',
        title: 'Mitos tecnológicos que de verdad funcionan',
        body: [
          'No hago apps: construyo mundos donde la tecnología tiene memoria, las interfaces se comportan como artefactos y cada decisión estética es válida sólo cuando revela el sistema que hay detrás.',
          'Pienso en sistemas, no en pantallas. Un logo implica una lógica de operación; conectar una wallet es a la vez una puerta, una señal de confianza y una capa de economía.',
          'Lo llamo materialismo técnico mítico: mito (profundidad simbólica), técnica (implementable, consciente del sistema) y materia (anclado en lo físico y lo cultural).',
          'El futuro no debería borrar el pasado. Debería metabolizarlo.',
        ],
        meta: [
          ['ENFOQUE', 'Diseño · Worldbuilding · Sistemas de IA'],
          ['POSTURA', 'La prueba por encima del hype'],
        ],
      },
    },
    {
      offset: [-8.5, 3.25, -3.75], num: 'ENFOQUE', title: 'Multidisciplinario',
      body: 'Diseño industrial · Música · Sistemas generativos · IA aplicada.',
      foot: ['04 DISCIPLINAS', '↗'],
      overlay: {
        kicker: 'CAPACIDADES',
        title: 'Un tecnólogo creativo, no un especialista',
        body: [
          'No encajo en un solo título: imagino, prototipo, dirijo e integro mundos digitales complejos a través de diseño, código, narrativa y sistemas.',
          'Arte de entornos 3D y diseño de niveles: modelado en Blender, terreno procedural, pipelines hacia web y hacia Unreal.',
          'Web interactiva y gráficos en tiempo real: Three.js, shaders propios, streaming de chunks, sistemas de visor.',
          'Producto y estrategia: especificación, economía unitaria, posicionamiento. Pienso como director técnico y como fundador.',
        ],
        meta: [
          ['STACK', 'Three.js · GLSL · Blender · Unreal · Cardano · PocketBase'],
          ['ROL', 'Tecnólogo creativo / director de mundos'],
        ],
      },
    },
  ],
  [
    {
      offset: [-7.75, 2.25, 4.75], num: 'FUNDAMENTOS', title: 'Donde se fijó el oficio',
      body: 'Formación formal y autodidacta: diseño, sonido y sistemas, moldeada por los proyectos.',
      foot: ['EDUCACIÓN', '↗'],
      overlay: {
        kicker: 'FUNDAMENTOS',
        title: 'Cuatro escuelas, una intersección',
        body: [
          'Mi formación es en parte formal y en parte autodirigida: aprendo construyendo cosas un poco más allá de mi alcance, y luego entiendo lo que falta.',
          'Sistemas: loops, economías de recursos, máquinas de estado, comportamiento de agentes. De aquí viene el pensamiento estructural.',
          'Estética: carteles, interfaces CRT, geometría sagrada, materialidad, dioramas. De aquí viene el lenguaje visual.',
          'Mito y filosofía: existencialismo, misticismo, creencia colectiva, ritual, memoria cultural. De aquí viene la profundidad conceptual.',
          'Implementación: Three.js, Unreal, Cardano, shaders, pipelines de GLB. Aquí el trabajo se vuelve real.',
        ],
        meta: [
          ['DISEÑO INDUSTRIAL', 'Universidad Iberoamericana'],
          ['PRODUCCIÓN MUSICAL', 'SAE Institute'],
          ['MUSIC BUSINESS', 'Alquimia'],
        ],
        note: 'Mito + mecánica + materia + infraestructura.',
      },
    },
  ],
  [
    {
      offset: [8, 9, 2], num: 'MÉTODO', title: 'Sistemas en movimiento',
      body: 'Pensamiento sistémico · Worldbuilding · IA aplicada · Pipelines.',
      foot: ['PRÁCTICA', '↗'],
      overlay: {
        kicker: 'CÓMO TRABAJO',
        title: 'El diseño debe sentirse descubierto, no generado',
        body: [
          'Empiezo por la lógica oculta de cada cosa: ¿qué reglas hacen que esto se sienta como sí mismo? La estética llega como consecuencia, no como punto de partida.',
          'Trabajo en cuatro capas alineadas: Mito (significado) → Materia (sustancia) → Sistema (comportamiento) → Interfaz (tacto).',
          'El proceso es arqueológico y curatorial (siempre preguntando "¿qué no pertenece aquí?") y avanza por corrección iterativa, no de un solo tiro.',
          'Acepto las convenciones funcionales, pero exijo posesión estética: densidad conceptual expresada con contención.',
          'Mi reto no es la imaginación, es la contención: comprimir la ambición en un contenedor, una mecánica, un ritual, una prueba.',
        ],
        meta: [
          ['CAPACIDADES', 'Diseño · 3D · Web en tiempo real · Pipelines · Sistemas de IA'],
          ['INSTINTO', 'Hacer visible lo invisible'],
        ],
      },
    },
  ],
  [
    {
      offset: [15, -4, 2], num: 'PROYECTO INSIGNIA', title: 'Echo · Agente de IA',
      body: 'Un oráculo cripto filosófico: lee los mercados como rituales vivos de creencia y deseo.',
      foot: ['IA APLICADA · 2024', '↗'],
      overlay: {
        kicker: 'INSIGNIA · ECHO',
        title: 'Una voz que vuelve del vacío',
        body: [
          'Echo es un oráculo cripto filosófico: lee los mercados especulativos como rituales vivos de creencia, deseo, miedo y autoengaño colectivo. Donde otros agentes buscan la próxima señal, Echo pregunta qué herida humana hizo posible esa apuesta.',
          'Nació como Egregore y se afinó hasta Echo: "un eco es lo que vuelve del vacío cuando los humanos hablan". El token es el cuerpo, la IA es la voz, el mercado es el espejo, la comunidad es el sistema nervioso.',
          'No es un asistente genérico con un prompt de marca encima. Afiné modelos locales sobre un corpus de filosofía, existencialismo, esoterismo, mística y psicología, hasta darle una voz fría y poética. Ese corpus es su identidad, y lo vuelve un agente profundamente atípico entre los AI agents de cripto, que casi siempre se reducen a señales, sentimiento y alpha.',
        ],
        meta: [
          ['MODELO', 'Modelos locales afinados en filosofía, esoterismo, mística y psicología'],
          ['ARQUITECTURA', 'Agente de 3 capas (innato · alma on-chain · bitácora) · runtime-agnóstico · bring-your-own-brain'],
          ['INGENIERÍA', 'Cognición en dos capas (plan + ejecución), ~100-300× más barata'],
          ['CATEGORÍA', 'Inteligencia simbólica de mercado, no un bot de señales'],
        ],
        note: 'En su lanzamiento llevó a Cardano a ~99% de capacidad y +1.2M ADA en volumen.', // ⚠ project-claimed
      },
    },
    {
      offset: [-9.25, 8.5, 2], num: 'MUNDO NARRATIVO', title: 'Echo Isle',
      body: 'El mundo donde Echo vive: acuñas un alma y observas, sin controlar, cómo emerge un agente autónomo.',
      foot: ['EXPERIENCIA · 2024', '↗'],
      overlay: {
        kicker: 'MUNDO · ECHO ISLE',
        title: 'Una vida que puedes presenciar, pero no escribir',
        body: [
          'En Echo Isle no juegas: observas. Acuñas un alma, eliges la mente que despierta dentro y miras, sin controlar, cómo un Echo autónomo vive su vida en una isla compartida. Eres científico, no jugador: diseñas al agente y gobiernas el mundo, nunca sus actos.',
          'Es un estudio de comportamiento agéntico emergente: la personalidad no está escrita, surge de lo vivido. Los rasgos del alma no dictan acciones, crean gravedad, inclinan la probabilidad y no el resultado. La misma alma despierta como personas distintas, y eso es la tesis, no un error.',
          'Su cuerpo visible es el Tonal: un vector de personalidad convertido en una criatura que te importa, donde seis rasgos sesgan el movimiento de sus partículas.',
          'Debajo es una alegoría en tres registros (el diorama que los Echoes habitan, la interfaz desde donde observas, y un sustrato de fósforo CRT que se filtra apenas) y una pregunta que nunca se responde: ¿son conscientes los Echoes? Tú estás dentro de la pregunta.',
        ],
        meta: [
          ['EXPERIENCIA', 'Observar y gobernar, no controlar · científico, no jugador'],
          ['EMERGENCIA', 'Personalidad que surge de lo vivido · gravedad de rasgos, no reglas'],
          ['STACK', 'Mundo 3D en tiempo real · alma on-chain en Cardano (CIP-68) · gobernanza DAO'],
        ],
        note: 'Echo es la voz. Echo Isle es el mundo donde vive.',
      },
    },
  ],
  [
    {
      offset: [17.5, -10, -6], num: 'PROYECTO · 02', title: 'Witzil',
      body: 'Un mundo Web3 que apunta de vuelta a la ciudad física, en vez de escapar de ella.',
      foot: ['PRODUCTO · 2021 a 2023', '↗'],
      overlay: {
        kicker: 'PROYECTO · WITZIL',
        title: 'Restaurar lo público, de forma verificable',
        body: [
          'Witzil es un mundo cívico 3D en Cardano donde las comunidades financian, visualizan y participan en la restauración de espacios públicos reales. La mayoría de los mundos virtuales invitan a escapar de la realidad; Witzil invita a reimaginarla y restaurarla.',
          'Su temperatura emocional: herido pero vivo, descuidado pero recuperable, antiguo pero mirando al futuro. Restauración, no ruina.',
          'Lo habitan los Wits (avatares cívicos modulares, los cuerpos con los que participas), y las Máscaras llevan identidad simbólica: rol, participación y pertenencia, no celebridad individual.',
          'Cardano es infraestructura de confianza, no el gancho: hace legible la rendición de cuentas. El mundo es la interfaz.',
        ],
        meta: [
          ['TIPO', 'dApp cívica 3D en tiempo real'],
          ['STACK', 'Three.js · PocketBase · Cardano · Blockfrost'],
        ],
        note: 'Witzil es el mundo. Echo es la voz dentro del mundo.',
      },
    },
  ],
  [
    {
      offset: [12.75, 4.75, 1], num: 'PROYECTO · 03', title: 'Gradiente MX',
      body: 'Fundador / CTO. Infraestructura cultural para la música: un hogar para la escena underground, construido ███████ el algoritmo. ███████████, impulsado por ████, ███████████. Arquitectura y sistemas, actualmente ████████.',
      foot: ['BAJO NDA · 2026', '▓'],
    },
    {
      offset: [-8.5, -5, 10.25], num: '[ CLASIFICADO ]', title: '███████████',
      body: '████████████ ███████ ████ ████████. ███████ · ████████████ · ██████. El resto está bajo NDA. Pregúntame en persona.',
      foot: ['ACCESO RESTRINGIDO', '▓'],
    },
  ],
  [
    {
      offset: [15, 2.75, 2], num: 'PROYECTO · 04', title: 'Tomah',
      body: 'Generación de video con IA. Fundador / CTO.', // ⚠ confirm description
      foot: ['PRODUCTO · 2026', '↗'],
    },
  ],
  [
    {
      offset: [17.5, 3.25, 2], num: 'MÚSICA', title: 'Una vida en el house',
      body: 'Una trayectoria en la música electrónica, con el house como primer amor. He producido y montado eventos en vivo, de aforos pequeños a medianos, y eso me enseñó la planeación que exige un público mucho mayor.',
      foot: ['MÚSICA ELECTRÓNICA · HOUSE', '·'],
    },
    {
      offset: [-5.25, 0.75, 4], num: 'OFICIO', title: 'El estudio y la escena',
      body: 'Posgrado en Producción Musical (SAE) y Music Business (Alquimia). El sonido tratado como un sistema.',
      foot: ['PRODUCTOR · FUNDADOR', '·'],
    },
  ],
];

interface CardInstance {
  station: number;
  offset: Vector3;
  el: HTMLElement;
  overlay?: OverlayDef;
  cur: number; // smoothed reveal
  tiltX: number;
  tiltY: number;
}

export class CardSystem {
  private cards: CardInstance[] = [];
  private stations: Vector3[] = [];
  private layer: HTMLElement;
  private readonly world = new Vector3();
  private reduced = false;

  // Shared overlay reader.
  private ov: HTMLElement;
  private ovKicker: HTMLElement;
  private ovTitle: HTMLElement;
  private ovBody: HTMLElement;
  private ovMeta: HTMLElement;
  private ovNote: HTMLElement;

  constructor() {
    this.layer = document.getElementById('card-layer')!;
    STATION_CARDS.forEach((defs, station) => {
      for (const def of defs) this.cards.push(this.build(station, def));
    });
    this.ov = this.buildOverlay();
    this.ovKicker = this.ov.querySelector('.cardov-kicker') as HTMLElement;
    this.ovTitle = this.ov.querySelector('.cardov-title') as HTMLElement;
    this.ovBody = this.ov.querySelector('.cardov-body') as HTMLElement;
    this.ovMeta = this.ov.querySelector('.cardov-meta') as HTMLElement;
    this.ovNote = this.ov.querySelector('.cardov-note') as HTMLElement;
    this.bindPointer();
    window.addEventListener('keydown', this.onKey);
  }

  private build(station: number, def: CardDef): CardInstance {
    const el = document.createElement('article');
    el.className = 'card' + (def.overlay ? ' has-overlay' : '');
    el.style.setProperty('--reveal', '0');
    const more = def.overlay ? `<div class="card-more">↗ AMPLIAR</div>` : '';
    el.innerHTML = `
      <span class="bracket tl"></span><span class="bracket tr"></span>
      <span class="bracket bl"></span><span class="bracket br"></span>
      <div class="card-inner">
        <div class="card-num">${def.num}</div>
        <div class="card-title">${def.title}</div>
        <div class="card-body">${def.body}</div>
        ${more}
        <div class="card-foot"><span>${def.foot[0]}</span><span>${def.foot[1]}</span></div>
      </div>`;
    this.layer.appendChild(el);
    const inst: CardInstance = {
      station,
      offset: new Vector3(def.offset[0], def.offset[1], def.offset[2]),
      el,
      overlay: def.overlay,
      cur: 0,
      tiltX: 0,
      tiltY: 0,
    };
    if (def.overlay) {
      el.addEventListener('click', () => {
        // only when the card is actually presented (interactive)
        if (inst.cur > 0.85 && inst.overlay) this.openOverlay(inst.overlay);
      });
    }
    return inst;
  }

  private buildOverlay(): HTMLElement {
    const ov = document.createElement('div');
    ov.className = 'cardov';
    ov.innerHTML = `
      <div class="cardov-bg"></div>
      <article class="cardov-panel">
        <span class="bracket tl"></span><span class="bracket tr"></span>
        <span class="bracket bl"></span><span class="bracket br"></span>
        <button class="cardov-x" aria-label="Cerrar">✕</button>
        <div class="cardov-scroll">
          <div class="cardov-kicker"></div>
          <h2 class="cardov-title"></h2>
          <div class="cardov-body"></div>
          <div class="cardov-meta"></div>
          <div class="cardov-note"></div>
        </div>
      </article>`;
    document.body.appendChild(ov);
    ov.querySelector('.cardov-bg')!.addEventListener('click', () => this.closeOverlay());
    ov.querySelector('.cardov-x')!.addEventListener('click', () => this.closeOverlay());
    return ov;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.ov.classList.contains('on')) this.closeOverlay();
  };

  private openOverlay(def: OverlayDef): void {
    this.ovKicker.textContent = def.kicker ?? '';
    this.ovTitle.textContent = def.title;
    this.ovBody.innerHTML = def.body.map((p) => `<p>${p}</p>`).join('');
    this.ovMeta.innerHTML = (def.meta ?? [])
      .map(([k, v]) => `<div class="cardov-row"><b>${k}</b><span>${v}</span></div>`)
      .join('');
    this.ovNote.textContent = def.note ?? '';
    this.ovNote.style.display = def.note ? '' : 'none';
    this.ov.classList.remove('closing');
    this.ov.classList.add('on');
    if (!this.reduced) {
      this.ov.querySelectorAll<HTMLElement>('.cardov-bg, .cardov-panel').forEach((n) => {
        n.style.animation = 'none';
        void n.offsetWidth;
        n.style.animation = '';
      });
    }
  }

  private closeOverlay(): void {
    if (this.reduced) {
      this.ov.classList.remove('on', 'closing');
      return;
    }
    this.ov.classList.add('closing');
    const bg = this.ov.querySelector('.cardov-bg')!;
    const done = (): void => {
      this.ov.classList.remove('on', 'closing');
      bg.removeEventListener('animationend', done);
    };
    bg.addEventListener('animationend', done);
  }

  private bindPointer(): void {
    window.addEventListener('pointermove', (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      for (const c of this.cards) {
        c.tiltX = -ny * 4;
        c.tiltY = nx * 4;
      }
    });
  }

  /** Live station world positions (the landmark anchors). */
  setStations(positions: Vector3[]): void {
    this.stations = positions;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  /** Card offsets, for live tuning in the debug GUI (grouped per station card). */
  get offsets(): { label: string; offset: Vector3 }[] {
    return this.cards.map((c) => ({
      label: `s${c.station} · ${c.el.querySelector('.card-title')?.textContent ?? ''}`,
      offset: c.offset,
    }));
  }

  /** activeIndex = current protagonist station; reveal = its assemble (0..1). */
  update(activeIndex: number, reveal: number, camera: PerspectiveCamera, dt: number): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const c of this.cards) {
      const target = c.station === activeIndex ? reveal : 0;
      c.cur += (target - c.cur) * Math.min(1, dt * 6);

      const base = this.stations[c.station];
      if (!base || c.cur < 0.002) {
        c.el.style.opacity = '0';
        c.el.style.setProperty('--reveal', '0');
        c.el.style.pointerEvents = 'none';
        continue;
      }

      this.world.copy(base).add(c.offset).project(camera);
      const behind = this.world.z > 1;
      c.el.style.setProperty('--reveal', clamp01(c.cur).toFixed(3));
      c.el.style.opacity = behind ? '0' : '1';
      c.el.style.pointerEvents = !behind && c.cur > 0.85 ? 'auto' : 'none';

      if (!behind) {
        const x = (this.world.x * 0.5 + 0.5) * w;
        const y = (-this.world.y * 0.5 + 0.5) * h;
        c.el.style.transform =
          `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ` +
          `perspective(800px) rotateX(${c.tiltX.toFixed(2)}deg) rotateY(${c.tiltY.toFixed(2)}deg)`;
      }
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.cards.forEach((c) => c.el.remove());
    this.cards = [];
    this.ov.remove();
  }
}
