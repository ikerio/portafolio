/* =====================================================================
   proxies.ts — procedural placeholder meshes for landmark stations. Rough
   but distinct silhouettes (bust, temple, arch, sphere, obelisk, monolith,
   ring, structure) so the laid-out path reads like the diorama. Each is
   centered with its base near y=0, height ~3.5; swapped for Blender-authored
   sculptures in Phase 2 (same ASCII shader). makeStationProxy(i) cycles them.
   ===================================================================== */

import {
  SphereGeometry,
  CylinderGeometry,
  BoxGeometry,
  TorusGeometry,
  ConeGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function finish(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  merged.computeVertexNormals();
  return merged;
}

/** Greco-Roman bust: head + neck + tapered shoulders on a plinth. */
export function makeBustProxy(): BufferGeometry {
  const head = new SphereGeometry(1.0, 28, 22);
  head.scale(0.92, 1.12, 0.96);
  head.translate(0, 2.35, 0.05);
  const neck = new CylinderGeometry(0.42, 0.52, 0.8, 18);
  neck.translate(0, 1.5, 0);
  const shoulders = new CylinderGeometry(0.6, 1.55, 1.5, 24);
  shoulders.translate(0, 0.75, 0);
  const plinth = new BoxGeometry(1.9, 0.5, 1.3);
  plinth.translate(0, -0.25, 0);
  return finish([head, neck, shoulders, plinth]);
}

/** Stepped temple / ziggurat. */
export function makeTempleProxy(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const s = 3.0 - i * 0.6;
    const b = new BoxGeometry(s, 0.7, s);
    b.translate(0, 0.35 + i * 0.72, 0);
    parts.push(b);
  }
  return finish(parts);
}

/** Free-standing archway: two pillars + a lintel. */
export function makeArchProxy(): BufferGeometry {
  const left = new BoxGeometry(0.5, 3.0, 0.5);
  left.translate(-1.1, 1.5, 0);
  const right = new BoxGeometry(0.5, 3.0, 0.5);
  right.translate(1.1, 1.5, 0);
  const lintel = new BoxGeometry(2.9, 0.55, 0.6);
  lintel.translate(0, 3.25, 0);
  return finish([left, right, lintel]);
}

/** Sphere on a pedestal. */
export function makeSphereProxy(): BufferGeometry {
  const ball = new SphereGeometry(1.15, 30, 24);
  ball.translate(0, 2.5, 0);
  const ped = new CylinderGeometry(0.8, 1.0, 1.6, 22);
  ped.translate(0, 0.8, 0);
  return finish([ball, ped]);
}

/** Tapered obelisk with a pyramidal cap. */
export function makeObeliskProxy(): BufferGeometry {
  const shaft = new CylinderGeometry(0.45, 0.7, 3.0, 4);
  shaft.translate(0, 1.5, 0);
  const cap = new ConeGeometry(0.55, 0.8, 4);
  cap.translate(0, 3.4, 0);
  return finish([shaft, cap]);
}

/** Leaning monolith slab. */
export function makeMonolithProxy(): BufferGeometry {
  const slab = new BoxGeometry(1.7, 3.4, 0.45);
  slab.rotateZ(0.09);
  slab.translate(0, 1.7, 0);
  return finish([slab]);
}

/** Standing ring on a base. */
export function makeRingProxy(): BufferGeometry {
  const ring = new TorusGeometry(1.2, 0.2, 16, 48);
  ring.rotateX(Math.PI / 2);
  ring.translate(0, 2.2, 0);
  const base = new BoxGeometry(1.0, 1.0, 1.0);
  base.translate(0, 0.5, 0);
  return finish([ring, base]);
}

/** A little clustered structure (building). */
export function makeStructureProxy(): BufferGeometry {
  const a = new BoxGeometry(1.4, 2.6, 1.4);
  a.translate(-0.6, 1.3, 0.2);
  const b = new BoxGeometry(1.0, 1.7, 1.0);
  b.translate(0.8, 0.85, -0.3);
  const c = new BoxGeometry(0.8, 3.2, 0.8);
  c.translate(0.3, 1.6, 0.9);
  return finish([a, b, c]);
}

const STATION_PROXIES = [
  makeBustProxy,
  makeTempleProxy,
  makeArchProxy,
  makeSphereProxy,
  makeObeliskProxy,
  makeMonolithProxy,
  makeRingProxy,
  makeStructureProxy,
];

/** A distinct proxy per station (cycles through the set). */
export function makeStationProxy(i: number): BufferGeometry {
  return STATION_PROXIES[i % STATION_PROXIES.length]();
}
