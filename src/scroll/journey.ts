/* =====================================================================
   journey.ts — derives the camera path from the route. The journey is:
   Arrival (hero in fog) → hero composed (IT → IKER TOLEDO) → a composed
   3/4 shot at each station along the route. Camera poses for stations are
   computed from the route point + tangent (approach from behind, lifted,
   offset to the side). Also returns the progress mapping + snap points so
   the timeline can hold at each checkpoint.
   ===================================================================== */

import { Vector3, CatmullRomCurve3 } from 'three';
import { ROUTE, STATIONS, HERO } from '../core/config';

export interface Journey {
  positions: Vector3[]; // camera node per checkpoint
  targets: Vector3[]; // look-at per checkpoint
  tValues: number[]; // uniform curve param per camera node (i/(N-1))
  progress: number[]; // scroll progress per camera node (drives the camU timeline)
  snapPoints: number[]; // progress values the scroll snaps to (a subset of nodes)
  snapFlags: boolean[]; // per node — is it a snap stop? (the timeline only eases at stops)
  framing: number[]; // per node — portrait pull-back weight (0 = original close framing)
  stationProgress: number[]; // progress at each station checkpoint
  stationPoints: Vector3[]; // world point of each station
  stationDirs: Vector3[]; // route tangent (xz, normalized) at each station
}

const CAM_HEIGHT = 11;
const BACK_DIST = 17;
const SIDE_OFFSET = 8;
const LOOK_UP = 3.2;

// The Systems station (index 2) is a fly-THROUGH the arch instead of a side shot.
const SYS_INDEX = 2;
const SYS_APPROACH = 13; // camera starts this far before the gate
const SYS_EXIT = 12; // and ends this far past it
const SYS_HEIGHT = 3.6; // eye height — passes under the lintel, through the opening
const SYS_LOOK = 16; // look-ahead down the path

// Per-shot portrait framing weights (0 = keep the original close framing; 1 =
// fully fit the landscape width on a narrow screen). Only applied on portrait
// viewports, scaled by CAMERA.portraitPullback. The arch fly-through and the
// model-assembly shots stay close (that's their charm); the wide hero wordmark
// pulls back; the side 3/4 showcase shots get a gentle pull-back so the models
// read fully without feeling distant.
const HERO_FRAMING = 0.6;
const STATION_FRAMING = 0.25;
const ARCH_FRAMING = 0;
const FINALE_FRAMING = 0;

export function buildJourney(): Journey {
  const route = ROUTE.map((n) => new Vector3(n[0], n[1], n[2]));
  const curve = new CatmullRomCurve3(route, false, 'catmullrom', 0.5);
  const up = new Vector3(0, 1, 0);

  const positions: Vector3[] = [];
  const targets: Vector3[] = [];
  const snapNode: boolean[] = []; // is this camera node a scroll snap stop?
  const framing: number[] = []; // per node — portrait pull-back weight

  // Arrival + hero (near the origin, framing IT → IKER TOLEDO).
  const hero = new Vector3(HERO.position[0], HERO.position[1], HERO.position[2]);
  positions.push(new Vector3(0, 10, 26));
  targets.push(hero.clone());
  snapNode.push(true);
  framing.push(HERO_FRAMING);
  positions.push(new Vector3(0, 9, 12));
  targets.push(hero.clone());
  snapNode.push(true);
  framing.push(HERO_FRAMING);

  // A composed 3/4 shot at each station — except the Systems arch, which is a
  // forward fly-through (two nodes on the path: before the gate, then past it).
  const stationPoints: Vector3[] = [];
  const stationDirs: Vector3[] = [];
  const stationNodeIndex: number[] = []; // camera node where each station "focuses"
  const last = route.length - 1;
  for (let si = 0; si < STATIONS.length; si++) {
    const st = STATIONS[si];
    const idx = Math.min(Math.max(st.point, 0), last);
    const t = idx / last;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    tan.y = 0;
    tan.normalize();
    const side = tan.clone().cross(up).normalize();

    stationPoints.push(p.clone());
    stationDirs.push(tan.clone());
    stationNodeIndex.push(positions.length);

    if (si === SYS_INDEX) {
      // A — composed establishing shot of the arch (snap: the initial landmark view)
      positions.push(
        p.clone().addScaledVector(up, CAM_HEIGHT).addScaledVector(tan, -BACK_DIST).addScaledVector(side, SIDE_OFFSET),
      );
      targets.push(p.clone().addScaledVector(up, LOOK_UP));
      snapNode.push(true);
      framing.push(ARCH_FRAMING);
      // B — on the path, looking through the gate (NOT a snap stop: the through
      // view happens during the fly, not as a separate stop)
      positions.push(p.clone().addScaledVector(tan, -SYS_APPROACH).addScaledVector(up, SYS_HEIGHT));
      targets.push(p.clone().addScaledVector(tan, SYS_LOOK).addScaledVector(up, SYS_HEIGHT * 0.5));
      snapNode.push(false);
      framing.push(ARCH_FRAMING);
      // C — past the gate (NOT a snap stop: scroll flies through here straight on to the next landmark)
      positions.push(p.clone().addScaledVector(tan, SYS_EXIT).addScaledVector(up, SYS_HEIGHT));
      targets.push(p.clone().addScaledVector(tan, SYS_EXIT + SYS_LOOK).addScaledVector(up, SYS_HEIGHT * 0.5));
      snapNode.push(false);
      framing.push(ARCH_FRAMING);
    } else {
      const cam = p
        .clone()
        .addScaledVector(up, CAM_HEIGHT)
        .addScaledVector(tan, -BACK_DIST)
        .addScaledVector(side, SIDE_OFFSET);
      positions.push(cam);
      targets.push(p.clone().addScaledVector(up, LOOK_UP));
      snapNode.push(true);
      framing.push(STATION_FRAMING);
    }
  }

  // Trajectory finale — rise to a near top-down survey of the whole route, so
  // the path you travelled reads as a single timeline spine.
  let cx = 0;
  let cz = 0;
  for (const p of route) { cx += p.x; cz += p.z; }
  cx /= route.length;
  cz /= route.length;
  positions.push(new Vector3(cx, 150, cz + 36));
  targets.push(new Vector3(cx, 0, cz));
  snapNode.push(true);
  framing.push(FINALE_FRAMING);

  const n = positions.length;
  const tValues = positions.map((_, i) => i / (n - 1));

  // Progress: arrival 0, hero 0.16, the remaining camera nodes spread 0.28 → 1.0.
  const progress: number[] = [0, 0.16];
  const remaining = n - 2;
  for (let k = 0; k < remaining; k++) {
    progress.push(remaining > 1 ? 0.28 + (k / (remaining - 1)) * (1.0 - 0.28) : 0.64);
  }
  const stationProgress = stationNodeIndex.map((ni) => progress[ni]);
  const snapPoints = progress.filter((_, i) => snapNode[i]);

  return {
    positions,
    targets,
    tValues,
    progress,
    snapPoints,
    snapFlags: snapNode,
    framing,
    stationProgress,
    stationPoints,
    stationDirs,
  };
}
