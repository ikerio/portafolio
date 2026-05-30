/* =====================================================================
   PlayerCard — an interactive glass card at the Discos Movimiento landmark:
   play/pause + a track list that drives the AudioReactor. Anchored to the
   station (projected each frame) and revealed with the Discos chapter.
   ===================================================================== */

import { Vector3, type PerspectiveCamera } from 'three';
import { clamp01 } from '../core/math';
import { AUDIO } from '../core/config';
import type { AudioReactor } from '../core/AudioReactor';

// On mobile the player anchors to the BOTTOM of the screen (by its own bottom
// edge, translate -100% Y) with this gap in px — so the full track list always
// fits on screen and grows upward, never clipping the last track.
const M_PLAYER_BOTTOM = 28;

export class PlayerCard {
  private el: HTMLElement;
  private toggleBtn: HTMLButtonElement;
  private trackEls: HTMLButtonElement[] = [];
  private anchor = new Vector3();
  private readonly offset = new Vector3(10, -7, -1);
  private cur = 0;
  private base?: Vector3;
  private mq = window.matchMedia('(max-width: 700px)');
  private mobile = this.mq.matches;
  private onMq = (e: MediaQueryListEvent): void => {
    this.mobile = e.matches;
  };

  constructor(private audio: AudioReactor) {
    this.el = document.createElement('article');
    this.el.className = 'card player';
    this.el.style.setProperty('--reveal', '0');
    this.el.innerHTML = `
      <span class="bracket tl"></span><span class="bracket tr"></span>
      <span class="bracket bl"></span><span class="bracket br"></span>
      <div class="card-inner">
        <div class="card-num">SOUNDSYSTEM</div>
        <div class="player-row">
          <button class="player-toggle" aria-label="Play / pause">▶</button>
          <div class="player-now"></div>
        </div>
        <div class="player-list"></div>
      </div>`;
    document.getElementById('card-layer')!.appendChild(this.el);

    this.toggleBtn = this.el.querySelector('.player-toggle')!;
    this.toggleBtn.addEventListener('click', () => this.audio.toggle());

    const list = this.el.querySelector('.player-list')!;
    AUDIO.tracks.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'player-track';
      b.textContent = t.name;
      b.addEventListener('click', () => void this.audio.select(i));
      list.appendChild(b);
      this.trackEls.push(b);
    });

    this.mq.addEventListener('change', this.onMq);
  }

  /** Live station position (the Discos landmark). */
  setAnchor(base: Vector3): void {
    this.base = base;
  }

  update(reveal: number, camera: PerspectiveCamera, dt: number): void {
    this.cur += (reveal - this.cur) * Math.min(1, dt * 6);
    if (this.cur < 0.002 || (!this.mobile && !this.base)) {
      this.el.style.opacity = '0';
      this.el.style.setProperty('--reveal', '0');
      this.el.style.pointerEvents = 'none';
      return;
    }
    this.el.style.setProperty('--reveal', clamp01(this.cur).toFixed(3));

    if (this.mobile) {
      // Anchored to the bottom edge (grows upward) so the full track list fits.
      const x = window.innerWidth * 0.5;
      const y = window.innerHeight - M_PLAYER_BOTTOM;
      this.el.style.opacity = '1';
      this.el.style.pointerEvents = this.cur > 0.85 ? 'auto' : 'none';
      this.el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    } else {
      this.anchor.copy(this.base!).add(this.offset).project(camera);
      const behind = this.anchor.z > 1;
      this.el.style.opacity = behind ? '0' : '1';
      this.el.style.pointerEvents = !behind && this.cur > 0.85 ? 'auto' : 'none';
      if (!behind) {
        const x = (this.anchor.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-this.anchor.y * 0.5 + 0.5) * window.innerHeight;
        this.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    }

    // reflect playback state
    this.toggleBtn.textContent = this.audio.isPlaying ? '❚❚' : '▶';
    const now = this.el.querySelector('.player-now')!;
    now.textContent = this.audio.isPlaying ? AUDIO.tracks[this.audio.index]?.name ?? '' : 'paused';
    this.trackEls.forEach((b, i) => b.classList.toggle('on', i === this.audio.index));
  }

  get offsetVec(): Vector3 {
    return this.offset;
  }

  dispose(): void {
    this.mq.removeEventListener('change', this.onMq);
    this.el.remove();
  }
}
