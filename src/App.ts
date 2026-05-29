/* =====================================================================
   App — composition root. Detects capabilities, loads assets, assembles
   the world, and drives everything from a single gsap.ticker loop (no
   competing rAF). Scroll → progress → SceneDirector → camera + world →
   post. Handles resize, reduced motion, and the no-WebGL CV fallback.
   ===================================================================== */

import { gsap } from 'gsap';
import { Scene, type BufferGeometry } from 'three';
import { detectCapabilities } from './core/tiers';
import { Assets } from './core/assets';
import { AudioReactor } from './core/AudioReactor';
import { RendererManager } from './render/RendererManager';
import { SceneManager } from './render/SceneManager';
import { CameraRig } from './render/CameraRig';
import { PostManager } from './render/PostManager';
import { Terrain } from './world/Terrain';
import { PathSpline } from './world/PathSpline';
import { ParticleType } from './world/ParticleType';
import { LandmarkObject } from './world/LandmarkObject';
import { AmbientScatter } from './world/AmbientScatter';
import { Garden } from './world/Garden';
import { Steps } from './world/Steps';
import { ChainNetwork } from './world/ChainNetwork';
import { Tomah } from './world/Tomah';
import { makeStationProxy } from './world/proxies';
import { loadAsciiGeometry } from './world/modelGeometry';
import { withBase } from './core/paths';
import { createTonal, type TonalHandle } from './world/Tonal';
import { LANDMARK, AMBIENT, PATH, GARDEN, CONTEXTS, TONAL, CHAIN, BUST, GRADIENTE, TOMAH } from './core/config';
import { ScrollController } from './scroll/ScrollController';
import { SceneDirector } from './scroll/SceneDirector';
import { buildJourney, type Journey } from './scroll/journey';
import { CardSystem } from './ui/CardSystem';
import { ConnectorCards } from './ui/ConnectorCards';
import { TrajectoryPanel } from './ui/TrajectoryPanel';
import { GradienteMosaic } from './ui/GradienteMosaic';
import { PlayerCard } from './ui/PlayerCard';
import { Chrome } from './ui/Chrome';
import { CVFallback } from './ui/CVFallback';
import type { DebugState } from './debug/gui';
import type { PerfMonitor } from './debug/stats';
import type { CameraDebug } from './debug/CameraDebug';

export class App {
  private renderer!: RendererManager;
  private scene!: SceneManager;
  private cameraRig!: CameraRig;
  private post!: PostManager;
  private terrain!: Terrain;
  private pathSpline!: PathSpline;
  private hero!: ParticleType;
  private landmarks: LandmarkObject[] = [];
  private ambient!: AmbientScatter;
  private garden!: Garden;
  private steps!: Steps;
  private chain!: ChainNetwork;
  private tomah!: Tomah;
  private gradiente!: GradienteMosaic;
  private tonal?: TonalHandle;
  // The Tonal creature lives in its own scene and is rendered in a separate
  // raw pass on top of the world (no AgX, no bloom) — exactly how the source
  // EchoIsleV1.1 renders it. Keeps the world's post pipeline untouched.
  private readonly tonalScene = new Scene();
  private scroll!: ScrollController;
  private director!: SceneDirector;
  private journey!: Journey;
  private cards!: CardSystem;
  private connectors!: ConnectorCards;
  private trajectory!: TrajectoryPanel;
  private trajStart = 0.92; // progress where the Trajectory finale begins
  private player!: PlayerCard;
  private chrome!: Chrome;
  private cv!: CVFallback;

  private activeLandmark = -1; // only one landmark assembles at a time
  private candidateIdx = -1;
  private candidateDwell = 0;
  private currentWave = 0; // smoothed chapter-context transforms
  private currentStrata = 0;
  private currentGarden = 0;
  private currentRipple = 0;
  private audio = new AudioReactor();

  private debug: DebugState = { override: false, progress: 0, forceChapter: -1 };
  private perf?: PerfMonitor;
  private cameraDebug?: CameraDebug;
  private disposeGui?: () => void;

  async start(): Promise<void> {
    const { webgl, settings } = detectCapabilities();

    this.cv = new CVFallback();
    if (!webgl) {
      this.cv.forcePermanent();
      this.hideLoader();
      return;
    }

    // Derive the camera path from the route (hero arrival → composed shot per station).
    this.journey = buildJourney();

    const canvas = document.getElementById('gl') as HTMLCanvasElement;
    this.renderer = new RendererManager(canvas, settings);
    this.scene = new SceneManager();
    this.cameraRig = new CameraRig(
      window.innerWidth / window.innerHeight,
      this.journey.positions,
      this.journey.targets,
    );
    this.post = new PostManager(
      this.renderer.renderer,
      this.scene.scene,
      this.cameraRig.camera,
      settings,
    );

    // --- assets (fonts) ---
    const assets = new Assets();
    assets.events.on('progress', ({ ratio }) => this.setLoader(ratio));
    await assets.load();

    // WHO I AM self-portrait — load + normalize Iker's bust GLB; falls back to
    // the procedural proxy if it fails to load.
    let bustGeo: BufferGeometry | null = null;
    try {
      bustGeo = await loadAsciiGeometry(withBase(BUST.url), {
        targetSize: BUST.targetSize,
        restOnGround: BUST.restOnGround,
      });
    } catch (e) {
      console.warn('[bust] failed to load iker.glb — using placeholder', e);
    }

    // --- world ---
    this.terrain = new Terrain(settings.terrainSegments);
    // The Systems garden needs flat ground — define a clearing at that station.
    const sysC = this.journey.stationPoints[2];
    this.terrain.setFlattenZone(sysC.x, sysC.z, GARDEN.regionRadius + 4, sysC.y);
    const discC = this.journey.stationPoints[7]; // Discos Movimiento (now station 7) — sound ripples
    this.terrain.setRippleZone(discC.x, discC.z);
    this.pathSpline = new PathSpline(
      PATH.count[settings.tier],
      this.renderer.renderer.getPixelRatio(),
    );
    this.hero = new ParticleType(
      settings.heroCell,
      settings.heroLayers,
      settings.heroPointSize,
      this.renderer.renderer.getPixelRatio(),
    );
    // One ASCII sculpture per station, anchored to its station's route point.
    // Always visible for now (layout review); per-chapter reveal comes later.
    const pr = this.renderer.renderer.getPixelRatio();
    // Each landmark assembles from a scattered cloud when it comes into view
    // (after a small delay) and dissolves once it passes — handled in update().
    this.landmarks = this.pathSpline.stations.map((_st, i) => {
      const isBust = i === BUST.station && bustGeo;
      return new LandmarkObject({
        geometry: isBust ? bustGeo! : makeStationProxy(i),
        position: [0, 0, 0], // set by syncLandmarks()
        scale: isBust ? BUST.scale : LANDMARK.scale,
        count: (isBust ? BUST.count : LANDMARK.count)[settings.tier],
        pointSize: isBust ? BUST.glyphSize : LANDMARK.glyphSize,
        scatter: LANDMARK.scatter,
        pixelRatio: pr,
        solid: !!isBust, // depth-occluded so the face doesn't show its back through gaps
        alphaCut: BUST.alphaCut,
        wireframe: !!isBust && BUST.wireframe,
        wireOpacity: BUST.wireOpacity,
      });
    });

    // Self-portrait orientation (object-level so it's live-tunable in the GUI).
    if (bustGeo) {
      this.landmarks[BUST.station].points.rotation.set(
        BUST.rotation[0], BUST.rotation[1], BUST.rotation[2],
      );
    }

    const s0 = this.journey.stationPoints[0];
    const sp0 = this.journey.stationProgress[0];
    this.ambient = new AmbientScatter({
      count: AMBIENT.count[settings.tier],
      pointSize: AMBIENT.pointSize,
      pixelRatio: pr,
      center: [s0.x, s0.y + 5, s0.z],
      revealStart: sp0 - 0.06,
      revealEnd: sp0 - 0.02,
      hideStart: sp0 + 0.03,
      hideEnd: sp0 + 0.08,
    });

    this.garden = new Garden({
      center: this.journey.stationPoints[2], // the Systems station (arch)
      plantCount: GARDEN.plantCount[settings.tier],
      pixelRatio: pr,
      pathDir: this.journey.stationDirs[2],
    });
    this.steps = new Steps({
      center: this.journey.stationPoints[2],
      dir: this.journey.stationDirs[2],
      pixelRatio: pr,
    });
    this.chain = new ChainNetwork({
      center: this.journey.stationPoints[CHAIN.station],
      pixelRatio: pr,
    });
    this.chain.points.scale.setScalar(CHAIN.scale);
    {
      // Nudge the chain toward the camera (closer). The Witzil composed shot
      // sits at −17·tan + 8·side from the station (mirrors journey.ts).
      const tan = this.journey.stationDirs[CHAIN.station];
      let dx = -17 * tan.x - 8 * tan.z;
      let dz = -17 * tan.z + 8 * tan.x;
      const len = Math.hypot(dx, dz) || 1;
      this.chain.points.position.x += (dx / len) * CHAIN.forward;
      this.chain.points.position.z += (dz / len) * CHAIN.forward;
    }
    this.tomah = new Tomah({
      center: this.journey.stationPoints[TOMAH.station],
      pixelRatio: pr,
    });
    this.scene.scene.add(
      this.terrain.mesh,
      this.pathSpline.mesh,
      this.hero.points,
      this.ambient.points,
      this.garden.points,
      this.steps.points,
      this.chain.points,
      this.tomah.group,
      ...this.landmarks.map((l) => l.points),
    );

    this.syncLandmarks();

    // --- Echo flagship: the Tonal creature replaces the glyph proxy at its
    // station. We keep the (now-hidden) LandmarkObject for view-scoring + card
    // reveal, and drive the creature's reveal from that same value. ---
    this.landmarks[TONAL.station].points.visible = false;
    // Witzil: the chain-network helix replaces the placeholder proxy (the
    // LandmarkObject is kept, hidden, for view-scoring + card reveal).
    this.landmarks[CHAIN.station].points.visible = false;
    // Gradiente: the classified glass mosaic (DOM) replaces the placeholder
    // proxy; the LandmarkObject stays hidden for view-scoring + reveal.
    this.landmarks[GRADIENTE.station].points.visible = false;
    // Tomah: the animated torus+cube sculpture replaces the placeholder proxy.
    this.landmarks[TOMAH.station].points.visible = false;
    this.tonal =
      (await createTonal({
        displayScale: TONAL.displayScale,
        expression: TONAL.expression,
        warmth: TONAL.warmth,
        translucency: TONAL.translucency,
        exposure: TONAL.exposure,
        reducedMotion: settings.reducedMotion,
      })) ?? undefined;
    if (this.tonal) {
      this.tonalScene.add(this.tonal.group);
      this.positionTonal();
    }

    // --- scroll + direction ---
    this.scroll = new ScrollController(settings);
    this.director = new SceneDirector(
      {
        cameraRig: this.cameraRig,
        scene: this.scene,
        terrain: this.terrain,
        pathSpline: this.pathSpline,
        hero: this.hero,
      },
      this.journey,
    );

    // --- ui ---
    this.cards = new CardSystem();
    // Lock page scroll while a reader overlay is open so it scrolls, not the scene.
    this.cards.onOverlayToggle = (open) => this.scroll.setLocked(open);
    this.syncCardAnchors();

    // Connector pull-quotes between stations (Tier C).
    this.connectors = new ConnectorCards();
    this.connectors.setStationProgress(this.journey.stationProgress);
    if (settings.reducedMotion) this.connectors.setReducedMotion(true);

    // Trajectory finale — timeline panel revealed over the last beat (last
    // station → 1.0), while the camera lifts top-down and the path lights up.
    const sp = this.journey.stationProgress;
    this.trajStart = sp[sp.length - 1] ?? 0.92;
    this.trajectory = new TrajectoryPanel();
    this.trajectory.setWindow(this.trajStart);
    if (settings.reducedMotion) this.trajectory.setReducedMotion(true);

    // Gradiente classified glass mosaic (DOM), anchored at its station.
    this.gradiente = new GradienteMosaic();
    this.gradiente.setAnchor(this.journey.stationPoints[GRADIENTE.station], GRADIENTE.anchorLift);
    if (settings.reducedMotion) this.gradiente.setReducedMotion(true);

    // Face the Systems arch down the path so the steps run through its gate.
    const sysDir = this.journey.stationDirs[2];
    this.landmarks[2].points.rotation.y = Math.atan2(sysDir.x, sysDir.z);

    // Discos player card, anchored to the Discos landmark (now station 7).
    this.player = new PlayerCard(this.audio);
    this.player.setAnchor(this.landmarks[7].points.position);
    // Nav items map to real journey checkpoints (station progress values).
    const sProg = this.journey.stationProgress;
    this.chrome = new Chrome({
      navItems: [
        { label: 'Inicio', progress: 0 },
        { label: 'Sobre mí', progress: sProg[0] }, // Who I Am (self bust)
        { label: 'Trabajo', progress: sProg[3] }, // Echo (first project)
        { label: 'Música', progress: sProg[7] }, // Discos Movimiento
        { label: 'Trayectoria', progress: 1 }, // finale timeline
      ],
      onNavigate: (p) => this.navigateTo(p),
      startReduced: settings.reducedMotion,
      onBackToTop: () => this.navigateTo(0),
      onReduceMotion: (reduced) => this.applyMotionPreference(reduced),
      onToggleSound: (on) => void this.audio.enable(on),
    });
    if (settings.reducedMotion) this.applyMotionPreference(true);

    window.addEventListener('resize', this.onResize);
    // If the visitor grabs the wheel/touch mid-glide, hand control straight
    // back: stop the programmatic scroll + camera glide.
    window.addEventListener('wheel', this.onUserScrollInterrupt, { passive: true });
    window.addEventListener('touchstart', this.onUserScrollInterrupt, { passive: true });

    if (import.meta.env.DEV) await this.initDebug();

    this.hideLoader();
    this.scroll.refresh();
    gsap.ticker.add(this.tick);
  }

  /** Header nav / back-to-top: scroll to a journey progress while gliding the
      camera straight there (no per-station dwells), both eased in lockstep. */
  private navigateTo(p: number): void {
    const duration = this.scroll.navDuration(p);
    this.scroll.scrollToProgress(p, duration);
    this.director.glideCameraTo(p, duration);
  }

  private onUserScrollInterrupt = (): void => {
    if (!this.scroll.isAutoScrolling) return;
    this.scroll.cancelScrollTween();
    this.director.cancelCameraGlide();
  };

  private tick = (time: number, deltaMs: number): void => {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.perf?.begin();

    if (!document.hidden) {
      const free = this.cameraDebug?.enabled ?? false;
      const progress = this.debug.override ? this.debug.progress : this.scroll.progress;

      this.director.seek(progress);
      this.director.apply(time, !free); // skip camera move while free-flying
      if (free) this.cameraDebug!.update();
      this.terrain.update(time, this.cameraRig.camera.position);
      this.hero.update(time);
      this.updateLandmarks(time, dt);
      this.ambient.update(time, progress);
      this.garden.update(time);
      this.steps.update(time);
      this.chain.update(time);
      this.pathSpline.update(time);
      this.chrome.update(progress);
      this.connectors.update(progress);
      // Trajectory finale: reveal the timeline + light the path as a spine.
      this.trajectory.update(progress);
      const tf = Math.max(0, Math.min(1, (progress - this.trajStart) / Math.max(0.001, 1 - this.trajStart)));
      this.pathSpline.material.uniforms.uDensity.value = PATH.density + (1 - PATH.density) * tf;
      this.post.render(dt);
      this.renderTonal();
    }

    this.perf?.end();
  };

  /** Single-active landmark controller: pick the best in-view landmark and let
      only it assemble; it dissolves once it leaves view, and only then can the
      next one claim — so close neighbours never both show. */
  private updateLandmarks(time: number, dt: number): void {
    const MARGIN = 0.08; // hysteresis so we don't flicker between near-equal candidates
    const cam = this.cameraRig.camera;
    const scores = this.landmarks.map((l) => l.viewScore(cam));

    // best in-view candidate
    let best = -1;
    let bestScore = 0;
    scores.forEach((s, i) => {
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });

    if (best < 0) {
      // nothing in view → release; the active dissolves
      this.activeLandmark = -1;
      this.candidateDwell = 0;
      this.candidateIdx = -1;
    } else if (best === this.activeLandmark) {
      // the active is still the best — keep it
      this.candidateDwell = 0;
      this.candidateIdx = -1;
    } else {
      // a different landmark is the best. Take over only if the active has left
      // view OR the newcomer clearly beats it (handles travelling either direction),
      // and only after a short dwell so brief glimpses don't trigger it.
      const activeScore = this.activeLandmark >= 0 ? scores[this.activeLandmark] : -1;
      const wins = activeScore <= 0 || bestScore > activeScore + MARGIN;
      if (wins) {
        this.candidateDwell = best === this.candidateIdx ? this.candidateDwell + dt : 0;
        this.candidateIdx = best;
        if (this.candidateDwell > LANDMARK.assembleDelay) {
          this.activeLandmark = best;
          this.candidateDwell = 0;
          this.candidateIdx = -1;
        }
      } else {
        this.candidateDwell = 0;
        this.candidateIdx = -1;
      }
    }

    this.landmarks.forEach((l, i) => {
      const target = i === this.activeLandmark && scores[i] > 0 ? 1 : 0;
      l.applyReveal(time, target, dt);
    });

    // Chapter context: blend the world toward the active chapter's transform
    // (e.g. the terrain morphs into the wave-field at the Systems station).
    const ci = this.debug.forceChapter >= 0 ? this.debug.forceChapter : this.activeLandmark;
    const ctx =
      ci >= 0 && ci < CONTEXTS.length ? CONTEXTS[ci] : { wave: 0, strata: 0, garden: 0, ripple: 0 };
    const k = Math.min(1, dt * 1.2);
    this.currentWave += (ctx.wave - this.currentWave) * k;
    this.currentStrata += (ctx.strata - this.currentStrata) * k;
    this.currentGarden += (ctx.garden - this.currentGarden) * k;
    this.currentRipple += (ctx.ripple - this.currentRipple) * k;
    this.terrain.setWave(this.currentWave);
    this.terrain.setStrata(this.currentStrata);
    this.terrain.setFlatten(this.currentGarden); // flatten the clearing for the garden
    this.garden.setReveal(this.currentGarden);
    this.steps.setReveal(this.currentGarden);

    // Discos: play the track while its chapter is active, drive the ripples by audio.
    this.audio.setActive(this.currentRipple > 0.3);
    this.audio.update();
    this.terrain.setRipple(this.currentRipple);
    this.terrain.setAudio(this.audio.bass, this.audio.level);
    this.player.update(this.currentRipple, this.cameraRig.camera, dt);

    // Cards: the active station's card(s) reveal in sync with its assemble.
    const activeReveal = this.activeLandmark >= 0 ? this.landmarks[this.activeLandmark].revealValue : 0;
    this.cards.update(this.activeLandmark, activeReveal, this.cameraRig.camera, dt);

    // Echo: the Tonal creature fades/animates in sync with its station's reveal.
    this.tonal?.setReveal(this.landmarks[TONAL.station].revealValue);
    this.tonal?.update(time, dt, this.cameraRig.camera);

    // Witzil: the chain-network helix reveals with its station.
    this.chain.setReveal(this.landmarks[CHAIN.station].revealValue);
    // Gradiente: the classified glass mosaic projects/reveals with its station.
    this.gradiente.update(this.landmarks[GRADIENTE.station].revealValue, this.cameraRig.camera);
    // Tomah: the torus+cube sculpture animates + reveals with its station.
    this.tomah.update(time, dt, this.cameraRig.camera, this.landmarks[TOMAH.station].revealValue);
  }

  /** Anchor each landmark to its station's route point (call after route edits). */
  private syncLandmarks(): void {
    const pts = this.pathSpline.routePoints;
    const last = pts.length - 1;
    this.landmarks.forEach((lm, i) => {
      const st = this.pathSpline.stations[i];
      const bp = pts[Math.min(Math.max(st.point, 0), last)];
      lm.setPosition(bp.x, bp.y, bp.z);
    });
    this.positionBust();
    this.positionTonal();
    this.syncCardAnchors();
  }

  /** Anchor cards to each station's fixed route point (NOT the live landmark
      transform) so moving/scaling a landmark never drags its cards. */
  private syncCardAnchors(): void {
    if (!this.cards) return;
    const rp = this.pathSpline.routePoints;
    const last = rp.length - 1;
    this.cards.setStations(
      this.pathSpline.stations.map((st) => rp[Math.min(Math.max(st.point, 0), last)].clone()),
    );
  }

  /** Anchor the self-portrait at its route point + a world offset (BUST.offset).
      Offset/rotation/scale are tuned live in the debug GUI; cards/ambient follow
      (anchored to this position). */
  private positionBust(): void {
    const i = BUST.station;
    const pts = this.pathSpline.routePoints;
    const last = pts.length - 1;
    const st = this.pathSpline.stations[i];
    const bp = pts[Math.min(Math.max(st.point, 0), last)];
    this.landmarks[i].setPosition(
      bp.x + BUST.offset[0],
      bp.y + BUST.offset[1],
      bp.z + BUST.offset[2],
    );
  }

  /** Render the Tonal creature in its own raw pass, composited on top of the
      world (after the composer). No AgX, no bloom, no fog/background — matching
      the source's standalone ACES/raw render. Drawn only while it's visible
      (near the Echo station). The world's pipeline is never touched. */
  private renderTonal(): void {
    if (!this.tonal || !this.tonal.group.visible) return;
    const r = this.renderer.renderer;
    r.setRenderTarget(null);
    r.autoClear = false;
    r.clearDepth(); // fresh depth so the creature self-sorts, composites over world
    r.render(this.tonalScene, this.cameraRig.camera);
    r.autoClear = true;
  }

  /** Anchor the Tonal creature above its station's route point. */
  private positionTonal(): void {
    if (!this.tonal) return;
    const a = this.landmarks[TONAL.station].points.position;
    this.tonal.group.position.set(a.x, a.y + TONAL.hover, a.z);
  }

  private applyMotionPreference(reduced: boolean): void {
    this.cameraRig.setIdle(!reduced);
    this.hero.setSway(!reduced);
    this.tonal?.setReducedMotion(reduced);
    this.gradiente?.setReducedMotion(reduced);
    this.tomah?.setReducedMotion(reduced);
    this.cards?.setReducedMotion(reduced);
    this.connectors?.setReducedMotion(reduced);
    this.trajectory?.setReducedMotion(reduced);
    this.hero.material.uniforms.uDispersion.value = reduced ? 0.4 : 1.4;
    document.body.classList.toggle('reduced', reduced);
    if (reduced) this.cv.reveal();
    else this.cv.hide();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h);
    this.post.resize(w, h);
    this.cameraRig.resize(w / h);
    const pr = this.renderer.renderer.getPixelRatio();
    this.hero.setPixelRatio(pr);
    for (const l of this.landmarks) l.setPixelRatio(pr);
    this.ambient.setPixelRatio(pr);
    this.garden.setPixelRatio(pr);
    this.steps.setPixelRatio(pr);
    this.chain.setPixelRatio(pr);
    this.tomah.setPixelRatio(pr);
    this.pathSpline.setPixelRatio(pr);
    this.scroll.refresh();
  };

  private async initDebug(): Promise<void> {
    const [{ createDebugGui }, { PerfMonitor }, { CameraDebug }] = await Promise.all([
      import('./debug/gui'),
      import('./debug/stats'),
      import('./debug/CameraDebug'),
    ]);
    this.perf = new PerfMonitor();
    this.cameraDebug = new CameraDebug(
      this.cameraRig.camera,
      this.renderer.renderer,
      this.cameraRig,
      this.scene.scene,
      this.journey.positions,
      this.journey.targets,
    );
    this.disposeGui = createDebugGui({
      terrain: this.terrain,
      hero: this.hero,
      landmarks: this.landmarks.map((obj, i) => ({ label: `station ${i}`, obj })),
      onRouteChange: () => this.syncLandmarks(),
      path: this.pathSpline,
      cameraRig: this.cameraRig,
      cameraDebug: this.cameraDebug,
      post: this.post,
      cards: this.cards,
      garden: this.garden,
      debug: this.debug,
    });
  }

  private setLoader(ratio: number): void {
    const fill = document.getElementById('loader-fill');
    if (fill) fill.style.width = `${Math.round(ratio * 100)}%`;
  }

  private hideLoader(): void {
    document.getElementById('loader')?.classList.add('loaded');
  }

  dispose(): void {
    gsap.ticker.remove(this.tick);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('wheel', this.onUserScrollInterrupt);
    window.removeEventListener('touchstart', this.onUserScrollInterrupt);
    this.disposeGui?.();
    this.cameraDebug?.dispose();
    this.perf?.dispose();
    this.scroll?.dispose();
    this.cards?.dispose();
    this.connectors?.dispose();
    this.trajectory?.dispose();
    this.player?.dispose();
    this.hero?.dispose();
    for (const l of this.landmarks) l.dispose();
    this.ambient?.dispose();
    this.garden?.dispose();
    this.steps?.dispose();
    this.chain?.dispose();
    this.tomah?.dispose();
    this.gradiente?.dispose();
    this.tonal?.dispose();
    this.audio.dispose();
    this.pathSpline?.dispose();
    this.terrain?.dispose();
    this.post?.dispose();
    this.scene?.dispose();
    this.renderer?.dispose();
  }
}
