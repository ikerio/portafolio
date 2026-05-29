/* =====================================================================
   PathSpline — the luminous ASCII bead-road of the diorama. Samples the
   shared ROUTE into a dense line of glyph particles (lateral scatter for
   width) plus a glowing clearing/platform at each landmark STATION. A
   brightness pulse flows along the route. Same glyph atlas as the world.

   Authoring: routePoints + stations are mutable and rebuild() recomputes
   bead positions in place (stable per-bead seeds), so the GUI route tool
   can reshape the path live.
   ===================================================================== */

import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  AdditiveBlending,
  Color,
  CatmullRomCurve3,
  Vector3,
  DynamicDrawUsage,
} from 'three';
import vertexShader from '../shaders/road.vert';
import fragmentShader from '../shaders/points.frag';
import { getGlyphAtlas } from './glyphAtlas';
import { ROUTE, STATIONS, PATH, PALETTE } from '../core/config';

interface Station {
  point: number; // index into routePoints — the clearing follows this point
  radius: number;
}

export class PathSpline {
  readonly mesh: Points;
  readonly material: ShaderMaterial;

  /** Mutable authoring state. */
  readonly routePoints: Vector3[];
  readonly stations: Station[];

  private readonly lineCount: number;
  private readonly posArr: Float32Array;
  private readonly posAttr: BufferAttribute;
  // stable per-bead shape params (so the road doesn't re-randomise on rebuild)
  private readonly lateralFrac: Float32Array; // line beads
  private readonly discR: Float32Array; // clearing beads (normalised radius)
  private readonly discA: Float32Array; // clearing beads (angle)
  private readonly yJit: Float32Array;
  private readonly ts: Float32Array;
  private curve: CatmullRomCurve3;

  constructor(count: number, pixelRatio: number) {
    this.lineCount = count;
    this.routePoints = ROUTE.map((n) => new Vector3(n[0], n[1], n[2]));
    this.stations = STATIONS.map((s) => ({ point: s.point, radius: s.radius }));
    this.curve = new CatmullRomCurve3(this.routePoints, false, 'catmullrom', 0.5);

    const clearingTotal = this.stations.length * PATH.clearingPerStation;
    const total = count + clearingTotal;

    this.posArr = new Float32Array(total * 3);
    const seeds = new Float32Array(total);
    const bright = new Float32Array(total);
    const keep = new Float32Array(total);
    this.ts = new Float32Array(total);
    this.lateralFrac = new Float32Array(count);
    this.discR = new Float32Array(clearingTotal);
    this.discA = new Float32Array(clearingTotal);
    this.yJit = new Float32Array(total);

    // line beads
    for (let i = 0; i < count; i++) {
      seeds[i] = Math.random();
      bright[i] = 0.4 + Math.random() * 0.5;
      keep[i] = Math.random();
      this.ts[i] = i / (count - 1);
      this.lateralFrac[i] = Math.random() * 2 - 1;
      this.yJit[i] = (Math.random() - 0.5) * 0.3;
    }
    // clearing beads
    for (let c = 0; c < clearingTotal; c++) {
      const idx = count + c;
      const r = Math.sqrt(Math.random()); // normalised 0..1
      this.discR[c] = r;
      this.discA[c] = Math.random() * Math.PI * 2;
      seeds[idx] = Math.random();
      bright[idx] = 0.55 + (1 - r) * 0.4; // brighter toward the centre
      keep[idx] = Math.random();
      this.ts[idx] = Math.random();
      this.yJit[idx] = (Math.random() - 0.5) * 0.3;
    }

    this.computePositions();

    const geo = new BufferGeometry();
    this.posAttr = new BufferAttribute(this.posArr, 3);
    this.posAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    geo.setAttribute('aBright', new BufferAttribute(bright, 1));
    geo.setAttribute('aT', new BufferAttribute(this.ts, 1));
    geo.setAttribute('aKeep', new BufferAttribute(keep, 1));

    const atlas = getGlyphAtlas();
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: PATH.pointSize },
        uScale: { value: 30 },
        uPixelRatio: { value: pixelRatio },
        uReveal: { value: 0 },
        uFlowSpeed: { value: PATH.flowSpeed },
        uYOffset: { value: 0 },
        uDensity: { value: PATH.density },
        uGlyphCount: { value: atlas.count },
        uGlyphAtlas: { value: atlas.texture },
        uColorCore: { value: new Color(PALETTE.glowCore) },
        uColorWarm: { value: new Color(PALETTE.amber) },
      },
    });

    this.mesh = new Points(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  /** Recompute bead positions from the current route + stations (stable shape). */
  private computePositions(): void {
    this.curve = new CatmullRomCurve3(this.routePoints, false, 'catmullrom', 0.5);
    const curve = this.curve;
    const p = new Vector3();
    const tan = new Vector3();
    const up = new Vector3(0, 1, 0);
    const perp = new Vector3();

    for (let i = 0; i < this.lineCount; i++) {
      const t = this.ts[i];
      curve.getPoint(t, p);
      curve.getTangent(t, tan);
      perp.copy(tan).cross(up).normalize();
      const lateral = this.lateralFrac[i] * PATH.width;
      this.posArr[i * 3 + 0] = p.x + perp.x * lateral;
      this.posArr[i * 3 + 1] = p.y + PATH.height + this.yJit[i]; // per-point height (curve y)
      this.posArr[i * 3 + 2] = p.z + perp.z * lateral;
    }

    let c = 0;
    const last = this.routePoints.length - 1;
    for (const st of this.stations) {
      const bp = this.routePoints[Math.min(Math.max(st.point, 0), last)]; // anchor point
      for (let k = 0; k < PATH.clearingPerStation; k++) {
        const idx = this.lineCount + c;
        const r = st.radius * this.discR[c];
        const a = this.discA[c];
        this.posArr[idx * 3 + 0] = bp.x + Math.cos(a) * r;
        this.posArr[idx * 3 + 1] = bp.y + PATH.height + this.yJit[idx];
        this.posArr[idx * 3 + 2] = bp.z + Math.sin(a) * r;
        c++;
      }
    }
  }

  /** Re-author: call after mutating routePoints / stations. */
  rebuild(): void {
    this.computePositions();
    this.posAttr.needsUpdate = true;
  }

  /** Sample the route spline into n world XZ points (for the terrain valley). */
  sampleCurve(n: number): { x: number; z: number }[] {
    return this.curve.getPoints(n - 1).map((p) => ({ x: p.x, z: p.z }));
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  setReveal(v: number): void {
    this.material.uniforms.uReveal.value = v;
  }

  setPixelRatio(r: number): void {
    this.material.uniforms.uPixelRatio.value = r;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
