/* =====================================================================
   gui.ts — lil-gui debug panel (dev only). Live-tunes the terrain shader,
   bloom, camera idle, and exposes a manual scroll-progress scrubber so the
   journey can be inspected without scrolling. Returns a dispose fn.
   ===================================================================== */

import GUI from 'lil-gui';
import type { Terrain } from '../world/Terrain';
import type { ParticleType } from '../world/ParticleType';
import type { LandmarkObject } from '../world/LandmarkObject';
import type { PathSpline } from '../world/PathSpline';
import type { Garden } from '../world/Garden';
import type { CameraRig } from '../render/CameraRig';
import type { PostManager } from '../render/PostManager';
import type { CardSystem } from '../ui/CardSystem';
import type { CameraDebug } from './CameraDebug';
import { WORLD } from '../core/config';

export interface DebugState {
  override: boolean;
  progress: number;
  forceChapter: number; // <0 = off; 0..7 = preview that chapter's world context
}

interface GuiDeps {
  terrain: Terrain;
  hero: ParticleType;
  landmarks: { label: string; obj: LandmarkObject }[];
  onRouteChange: () => void;
  path: PathSpline;
  cameraRig: CameraRig;
  cameraDebug: CameraDebug;
  post: PostManager;
  cards: CardSystem;
  garden: Garden;
  debug: DebugState;
}

export function createDebugGui(deps: GuiDeps): () => void {
  const gui = new GUI({ title: 'IT / debug' });
  const u = deps.terrain.uniforms;

  const journey = gui.addFolder('Journey');
  journey.add(deps.debug, 'override').name('manual scrub');
  journey.add(deps.debug, 'progress', 0, 1, 0.001).name('progress');
  journey.add(deps.debug, 'forceChapter', -1, 7, 1).name('preview chapter (<0 off)');

  const t = gui.addFolder('Terrain');
  t.add(u.uElevationScale, 'value', 0, 16, 0.1).name('elevation');
  t.add(u.uNoiseFrequency, 'value', 0.01, 0.12, 0.001).name('noise freq');
  t.add(u.uContourFrequency, 'value', 0.2, 6, 0.01).name('contour freq');
  t.add(u.uContourThickness, 'value', 0.002, 0.1, 0.0005).name('contour thick');
  t.add(u.uDotDensity, 'value', 0.2, 12, 0.05).name('dot density');
  t.add(u.uDotSize, 'value', 0.02, 0.4, 0.002).name('dot size');
  t.add(u.uDotIntensity, 'value', 0, 2.5, 0.01).name('dot intensity');
  t.add(u.uDotBand, 'value', 0.8, 6, 0.05).name('dot band (hug)');
  t.add(u.uDotFlicker, 'value', 0, 1, 0.01).name('dot flicker');
  t.add(u.uHazeDensity, 'value', 0, 0.09, 0.0005).name('haze');
  t.add(u.uWaveAmp, 'value', 0, 2, 0.01).name('wave amp');
  t.add(u.uWaveFreq, 'value', 0.02, 0.4, 0.005).name('wave freq');
  t.add(u.uWaveSpeed, 'value', 0, 2, 0.01).name('wave speed');
  t.add(u.uStrataStep, 'value', 0.4, 4, 0.1).name('strata step');
  t.close();

  const h = deps.hero.material.uniforms;
  const hero = gui.addFolder('Hero (IT)');
  hero.add(h.uSize, 'value', 2, 24, 0.5).name('glyph size');
  hero.add(h.uScale, 'value', 10, 60, 1).name('size scale');
  hero.add(h.uDispersion, 'value', 0, 4, 0.05).name('dispersion');
  hero.close();

  const landmarks = gui.addFolder('Landmarks');
  const r2 = (v: number) => Math.round(v * 100) / 100;
  for (const { label, obj } of deps.landmarks) {
    const lu = obj.material.uniforms;
    const scaleProxy = { v: obj.points.scale.x };
    const f = landmarks.addFolder(label);
    // Live position + rotation (note: position re-anchors to the route point on
    // any Route edit). Use 'export → console' to copy exact values.
    f.add(obj.points.position, 'x', -150, 150, 0.25).name('pos x');
    f.add(obj.points.position, 'y', -30, 40, 0.25).name('pos y');
    f.add(obj.points.position, 'z', -180, 70, 0.25).name('pos z');
    f.add(obj.points.rotation, 'x', -Math.PI, Math.PI, 0.01).name('rot x');
    f.add(obj.points.rotation, 'y', -Math.PI, Math.PI, 0.01).name('rot y');
    f.add(obj.points.rotation, 'z', -Math.PI, Math.PI, 0.01).name('rot z');
    f.add(scaleProxy, 'v', 0.5, 8, 0.05).name('scale').onChange((v: number) => obj.points.scale.setScalar(v));
    f.add(lu.uSize, 'value', 1, 20, 0.5).name('glyph size');
    f.add(lu.uScatter, 'value', 0, 14, 0.25).name('scatter');
    f.add(
      {
        exp: () => {
          const p = obj.points.position;
          const ro = obj.points.rotation;
          const out = `${label} → pos [${r2(p.x)}, ${r2(p.y)}, ${r2(p.z)}]  rot [${r2(ro.x)}, ${r2(ro.y)}, ${r2(ro.z)}]  scale ${r2(obj.points.scale.x)}`;
          // eslint-disable-next-line no-console
          console.log('[landmark] ' + out);
          navigator.clipboard?.writeText(out).catch(() => {});
        },
      },
      'exp',
    ).name('export → console');
    f.close();
  }
  landmarks.close();

  const pu = deps.path.material.uniforms;
  const road = gui.addFolder('Path (road)');
  road.add(pu.uYOffset, 'value', -6, 6, 0.1).name('height offset');
  road.add(pu.uDensity, 'value', 0, 1, 0.01).name('density');
  road.add(pu.uSize, 'value', 1, 16, 0.5).name('glyph size');
  road.add(pu.uFlowSpeed, 'value', 0, 8, 0.1).name('flow speed');
  road.close();

  // Route authoring — drag points/stations to reshape the path; the road and
  // the terrain valley rebuild live. Export logs config-ready arrays.
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const applyRoute = () => {
    deps.path.rebuild();
    deps.terrain.setRoute(deps.path.sampleCurve(WORLD.valleySamples));
    deps.onRouteChange(); // re-anchor landmarks to their stations
  };
  const route = gui.addFolder('Route (authoring)');
  const pts = route.addFolder('points');
  deps.path.routePoints.forEach((pt, i) => {
    const f = pts.addFolder(`pt ${i}`);
    f.add(pt, 'x', -150, 150, 0.5).onChange(applyRoute);
    f.add(pt, 'y', -20, 30, 0.25).onChange(applyRoute);
    f.add(pt, 'z', -180, 70, 0.5).onChange(applyRoute);
    f.close();
  });
  pts.close();
  const lastPt = deps.path.routePoints.length - 1;
  const sts = route.addFolder('stations');
  deps.path.stations.forEach((st, i) => {
    const f = sts.addFolder(`station ${i}`);
    f.add(st, 'point', 0, lastPt, 1).name('at point').onChange(applyRoute);
    f.add(st, 'radius', 1, 18, 0.25).onChange(applyRoute);
    f.close();
  });
  sts.close();
  route
    .add(
      {
        exp: () => {
          const rstr = deps.path.routePoints
            .map((p) => `  [${r1(p.x)}, ${r1(p.y)}, ${r1(p.z)}],`)
            .join('\n');
          const sstr = deps.path.stations
            .map((s) => `  { point: ${s.point}, radius: ${s.radius} },`)
            .join('\n');
          const out = `ROUTE: Vec3[] = [\n${rstr}\n];\nSTATIONS = [\n${sstr}\n];`;
          // eslint-disable-next-line no-console
          console.log('[route] paste into core/config:\n' + out);
          navigator.clipboard?.writeText(out).catch(() => {});
        },
      },
      'exp',
    )
    .name('export → console');
  route.close();

  // Card offsets are RELATIVE to each station (small range), so they never fly off.
  const cards = gui.addFolder('Cards (offset from station)');
  deps.cards.offsets.forEach(({ label, offset }) => {
    const f = cards.addFolder(label);
    f.add(offset, 'x', -30, 30, 0.25).name('x');
    f.add(offset, 'y', -10, 30, 0.25).name('y');
    f.add(offset, 'z', -30, 30, 0.25).name('z');
    f.close();
  });
  cards.close();

  const cam = gui.addFolder('Camera');
  const idle = { enabled: true };
  cam.add(idle, 'enabled').name('idle float').onChange((v: boolean) => deps.cameraRig.setIdle(v));

  // Free-fly authoring: fly the camera, review nodes, capture + export.
  const camState = { free: false, showPath: false, node: 0 };
  cam.add(camState, 'free').name('free fly').onChange((v: boolean) => deps.cameraDebug.enable(v));
  cam.add(camState, 'showPath').name('show path').onChange((v: boolean) => deps.cameraDebug.showPath(v));
  cam
    .add(camState, 'node', 0, Math.max(0, deps.cameraDebug.nodeCount - 1), 1)
    .name('review node')
    .onChange((i: number) => deps.cameraDebug.gotoNode(i));
  cam.add({ capture: () => deps.cameraDebug.captureNode() }, 'capture').name('capture node');
  cam.add({ exp: () => deps.cameraDebug.exportNodes() }, 'exp').name('export → console');
  cam.add({ clr: () => deps.cameraDebug.clearCaptured() }, 'clr').name('clear captured');
  cam.close();

  const gu = deps.garden.material.uniforms;
  const garden = gui.addFolder('Garden (Systems)');
  garden.add(gu.uSize, 'value', 1, 14, 0.5).name('glyph size');
  garden.add(gu.uWindStrength, 'value', 0, 1, 0.02).name('wind strength');
  garden.add(gu.uWindSpeed, 'value', 0, 3, 0.05).name('wind speed');
  garden.close();

  const post = gui.addFolder('Post');
  try {
    post.add(deps.post.bloom, 'intensity', 0, 2, 0.01).name('bloom');
  } catch {
    /* bloom disabled on this tier */
  }
  post.close();

  return () => gui.destroy();
}
