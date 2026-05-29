/* =====================================================================
   ScrollController — owns ScrollSmoother (inertia) + a single scrubbed
   ScrollTrigger that maps page scroll to a normalized 0..1 progress. The
   fixed WebGL canvas lives outside #smooth-wrapper, so only the content is
   transformed. Reduced-motion skips the smoother (native scroll).

   Free scrolling — NO snapping. The snap-to-checkpoint behaviour fought the
   user (mis-firing, jumping back to the hero) so it was removed; the camera
   timeline is still scrubbed continuously by `progress`.
   ===================================================================== */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { SCROLL } from '../core/config';
import type { QualitySettings } from '../core/tiers';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export class ScrollController {
  private _progress = 0;
  private smoother?: ScrollSmoother;
  private trigger: ScrollTrigger;
  private scrollTween?: gsap.core.Tween;

  constructor(settings: QualitySettings) {
    if (settings.enableSmoothScroll) {
      this.smoother = ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: SCROLL.smooth,
        smoothTouch: SCROLL.smoothTouch,
        effects: true,
        normalizeScroll: true,
      });
    }

    this.trigger = ScrollTrigger.create({
      trigger: '#scroll-sections',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self: ScrollTrigger) => {
        this._progress = self.progress;
      },
    });
  }

  get progress(): number {
    return this._progress;
  }

  /** The eased duration a jump to `p` will take, so a caller can run a matching
      camera glide in lockstep (both finish together → clean handoff). */
  navDuration(p: number): number {
    const dist = Math.abs(Math.max(0, Math.min(1, p)) - this._progress);
    return Math.min(3.0, 1.3 + dist * 2.2);
  }

  refresh(): void {
    ScrollTrigger.refresh();
  }

  /** Stop an in-flight programmatic scroll (e.g. the user grabbed the wheel). */
  cancelScrollTween(): void {
    this.scrollTween?.kill();
    this.scrollTween = undefined;
  }

  /** True while a nav scroll animation is running. */
  get isAutoScrolling(): boolean {
    return !!this.scrollTween?.isActive();
  }

  scrollToTop(): void {
    this.scrollToProgress(0);
  }

  /** Animate the scroll to a normalized journey progress (0..1). Maps progress
      onto the scrubbed trigger's scroll range so it lands on the same camera
      state the ticker reads.

      We drive it with our own eased tween (power2.inOut: gentle start AND stop)
      instead of ScrollSmoother's built-in scrollTo, whose exponential catch-up
      lurches fast at the start. Duration scales with travel distance so a short
      hop stays brisk and a full-page jump isn't a blink. */
  scrollToProgress(p: number, durationOverride?: number): void {
    const t = Math.max(0, Math.min(1, p));
    const y = this.trigger.start + (this.trigger.end - this.trigger.start) * t;
    const dist = Math.abs(t - this._progress);
    const duration = durationOverride ?? Math.min(3.0, 1.3 + dist * 2.2);

    this.scrollTween?.kill();
    const setY = this.smoother
      ? (v: number) => this.smoother!.scrollTo(v, false)
      : (v: number) => window.scrollTo(0, v);
    const proxy = { y: this.smoother ? this.smoother.scrollTop() : window.scrollY };
    this.scrollTween = gsap.to(proxy, {
      y,
      duration,
      ease: 'power3.inOut',
      overwrite: true,
      onUpdate: () => setY(proxy.y),
    });
  }

  dispose(): void {
    this.scrollTween?.kill();
    this.trigger.kill();
    this.smoother?.kill();
  }
}
