/* =====================================================================
   AudioReactor — plays tracks and exposes smoothed audio bands (bass /
   level) for driving the Discos Movimiento environment. Web Audio is built
   on first play (a user gesture). The player card selects tracks and toggles
   play; leaving the chapter pauses. Silent (bands→0) when not playing.
   ===================================================================== */

import { AUDIO } from './config';
import { withBase } from './paths';

/** Track URL prefixed with the deploy base (or undefined if no such track). */
const trackUrl = (i: number): string | undefined => {
  const t = AUDIO.tracks[i];
  return t ? withBase(t.url) : undefined;
};

export class AudioReactor {
  private ctx?: AudioContext;
  private el?: HTMLAudioElement;
  private analyser?: AnalyserNode;
  private freq?: Uint8Array<ArrayBuffer>;
  private enabled = false;
  private active = false; // is the Discos chapter the focus?
  private userPaused = false;
  index = 0; // selected track

  bass = 0; // smoothed 0..1
  level = 0;

  get isPlaying(): boolean {
    return !!this.el && !this.el.paused;
  }

  private ensureGraph(): void {
    if (this.ctx) return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.el = new Audio(trackUrl(this.index));
    this.el.loop = true;
    this.el.crossOrigin = 'anonymous';
    const src = this.ctx.createMediaElementSource(this.el);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = AUDIO.fftSize;
    this.analyser.smoothingTimeConstant = AUDIO.smoothing;
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
  }

  /** Sound toggle: enable/disable audio entirely. */
  async enable(on: boolean): Promise<void> {
    this.enabled = on;
    if (on) {
      this.ensureGraph();
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
    }
    this.sync();
  }

  /** Select a track (and play it if we're enabled + in-chapter). */
  async select(i: number): Promise<void> {
    this.index = i;
    this.ensureGraph();
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
    const url = trackUrl(i);
    if (this.el && url) {
      this.el.src = url;
      this.el.load();
    }
    this.enabled = true;
    this.userPaused = false;
    this.sync();
  }

  async play(): Promise<void> {
    this.userPaused = false;
    this.ensureGraph();
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
    this.enabled = true;
    this.sync();
  }

  pause(): void {
    this.userPaused = true;
    this.el?.pause();
  }

  toggle(): void {
    if (this.isPlaying) this.pause();
    else void this.play();
  }

  /** Whether the Discos chapter is currently the focus. */
  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (!active) this.userPaused = false; // re-arm auto-play next time
    this.sync();
  }

  private sync(): void {
    if (!this.el) return;
    if (this.enabled && this.active && !this.userPaused) this.el.play().catch(() => {});
    else this.el.pause();
  }

  update(): void {
    if (!this.analyser || !this.freq || !this.isPlaying) {
      this.bass *= 0.9;
      this.level *= 0.9;
      return;
    }
    this.analyser.getByteFrequencyData(this.freq);
    const n = this.freq.length;
    let bass = 0;
    let total = 0;
    const bassBins = Math.max(2, Math.floor(n * 0.08));
    for (let i = 0; i < bassBins; i++) bass += this.freq[i];
    for (let i = 0; i < n; i++) total += this.freq[i];
    const bassN = bass / bassBins / 255;
    const levelN = total / n / 255;
    this.bass += (bassN - this.bass) * 0.35;
    this.level += (levelN - this.level) * 0.35;
  }

  dispose(): void {
    this.el?.pause();
    this.ctx?.close().catch(() => {});
  }
}
