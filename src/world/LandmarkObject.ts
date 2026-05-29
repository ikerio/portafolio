/* =====================================================================
   LandmarkObject — the reusable ASCII-sculpture system. Surface-samples a
   mesh into a point cloud (carrying normals for shading), renders it with
   the shared glyph atlas, and ASSEMBLES it from a scattered cloud as the
   camera nears (reveal window over scroll progress). `focus` brightens and
   enlarges it when it's the protagonist (driven later by FocusController).
   Used by every landmark chapter; meshes are procedural proxies for now.
   ===================================================================== */

import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  NormalBlending,
  Color,
  Mesh,
  MeshBasicMaterial,
  FrontSide,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import vertexShader from '../shaders/landmark.vert';
import fragmentShader from '../shaders/points.frag';
import { getGlyphAtlas } from './glyphAtlas';
import { PALETTE, TERRAIN_DEFAULTS, LANDMARK } from '../core/config';
import type { Vec3 } from '../core/config';

export interface LandmarkOpts {
  geometry: BufferGeometry;
  position: Vec3;
  scale: number;
  count: number;
  pointSize: number;
  scatter?: number;
  pixelRatio: number;
  /** Solid mode — write depth + opaque alpha-cutout so front glyphs occlude the
      back/interior (no see-through). Used for the self-portrait bust. */
  solid?: boolean;
  /** Alpha cutoff for solid mode (fragments below are discarded). */
  alphaCut?: number;
  /** Overlay a subtle, backface-culled full wireframe of the source mesh behind
      the glyphs to firm up the form (for the detailed self-portrait). */
  wireframe?: boolean;
  wireColor?: string;
  wireOpacity?: number;
}

export class LandmarkObject {
  readonly points: Points;
  readonly material: ShaderMaterial;
  readonly wire?: Mesh;
  private wireBaseOpacity = 0;
  private focus = 1;
  private reveal = 0; // smoothed 0..1
  private readonly ndc = new Vector3();

  constructor(opts: LandmarkOpts) {
    const { geometry, count } = opts;

    // Sample the surface (positions + normals) using a throwaway mesh.
    const sampler = new MeshSurfaceSampler(new Mesh(geometry, new MeshBasicMaterial())).build();
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const scatter = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const p = new Vector3();
    const n = new Vector3();
    for (let i = 0; i < count; i++) {
      sampler.sample(p, n);
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      normals[i * 3 + 0] = n.x;
      normals[i * 3 + 1] = n.y;
      normals[i * 3 + 2] = n.z;
      const mag = 0.4 + Math.random() * 0.9;
      scatter[i * 3 + 0] = (Math.random() * 2 - 1) * mag;
      scatter[i * 3 + 1] = (Math.random() * 2 - 1) * mag;
      scatter[i * 3 + 2] = (Math.random() * 2 - 1) * mag;
      seeds[i] = Math.random();
    }
    // (the source geometry is disposed below — unless a wireframe overlay keeps it)

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('aNormal', new BufferAttribute(normals, 3));
    geo.setAttribute('aScatter', new BufferAttribute(scatter, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 1));

    const atlas = getGlyphAtlas();
    const solid = opts.solid ?? false;
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      // Solid: opaque, depth-writing → front glyphs occlude the back/interior.
      // Default: additive-ish translucent cloud (depthWrite off) as before.
      transparent: !solid,
      depthWrite: solid,
      blending: NormalBlending,
      uniforms: {
        uReveal: { value: 0 },
        uFocus: { value: 1 },
        uTime: { value: 0 },
        uSize: { value: opts.pointSize },
        uScale: { value: LANDMARK.sizeScale },
        uScatter: { value: opts.scatter ?? LANDMARK.scatter },
        uPixelRatio: { value: opts.pixelRatio },
        uAlphaCut: { value: solid ? (opts.alphaCut ?? 0.35) : 0 },
        uCullBack: { value: solid ? 1 : 0 },
        uGlyphCount: { value: atlas.count },
        uGlyphAtlas: { value: atlas.texture },
        uLightDir: { value: new Vector3(...TERRAIN_DEFAULTS.lightDir) },
        uColorCore: { value: new Color(PALETTE.glowCore) },
        uColorWarm: { value: new Color(PALETTE.ink0) },
      },
    });

    this.points = new Points(geo, this.material);
    this.points.position.set(opts.position[0], opts.position[1], opts.position[2]);
    this.points.scale.setScalar(opts.scale);
    this.points.frustumCulled = false;

    if (opts.wireframe) {
      // Subtle front-only full wireframe of the source mesh, behind the glyphs.
      // Child of points → inherits its position/rotation/scale (aligned). FrontSide
      // backface-culls it; depthWrite off + depthTest on → shows in the gaps
      // between the depth-writing glyphs (which occlude its far side).
      this.wireBaseOpacity = opts.wireOpacity ?? 0.1;
      const wireMat = new MeshBasicMaterial({
        color: new Color(opts.wireColor ?? PALETTE.ink2),
        wireframe: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: FrontSide,
      });
      this.wire = new Mesh(geometry, wireMat);
      this.wire.frustumCulled = false;
      this.points.add(this.wire);
    } else {
      geometry.dispose(); // source no longer needed once sampled
    }
  }

  /** Candidacy score for being the active landmark: -1 if not in view/near,
      else 0..1 (higher = nearer + more centred). The controller picks the best. */
  viewScore(camera: PerspectiveCamera): number {
    this.ndc.copy(this.points.position).project(camera);
    const dist = camera.position.distanceTo(this.points.position);
    const inView =
      this.ndc.z < 1 &&
      Math.abs(this.ndc.x) < 1.3 &&
      Math.abs(this.ndc.y) < 1.5 &&
      dist < LANDMARK.assembleDistance;
    if (!inView) return -1;
    const centred = 1 - Math.min(1, Math.hypot(this.ndc.x, this.ndc.y) / 1.4);
    const near = 1 - dist / LANDMARK.assembleDistance;
    return near * 0.6 + centred * 0.4;
  }

  get revealValue(): number {
    return this.reveal;
  }

  /** Smooth the reveal toward `target` (1 = assembled, 0 = scattered cloud). */
  applyReveal(time: number, target: number, dt: number): void {
    this.reveal += (target - this.reveal) * Math.min(1, dt * LANDMARK.assembleSpeed);
    this.material.uniforms.uReveal.value = this.reveal;
    this.material.uniforms.uFocus.value = this.focus;
    this.material.uniforms.uTime.value = time;
    if (this.wire) {
      (this.wire.material as MeshBasicMaterial).opacity = this.wireBaseOpacity * this.reveal;
    }
  }

  /** 0 = background, 1 = protagonist (set by the focus mechanic). */
  setFocus(f: number): void {
    this.focus = f;
  }

  /** Reposition (used to anchor the landmark to its station's route point). */
  setPosition(x: number, y: number, z: number): void {
    this.points.position.set(x, y, z);
  }

  setPixelRatio(r: number): void {
    this.material.uniforms.uPixelRatio.value = r;
  }

  dispose(): void {
    if (this.wire) {
      this.wire.geometry.dispose();
      (this.wire.material as MeshBasicMaterial).dispose();
    }
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
