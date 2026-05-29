/* =====================================================================
   Tomah — the Tomah landmark (station 6): AI video generation. An animated
   ASCII sculpture — a tumbling torus with a cube that shuttles in and out of
   its centre. Hovering it makes the points repel from the cursor and the form
   morph (pseudo-turbulence shimmer); a generative flicker makes points
   "resolve" like a frame being synthesized.

   Two glyph-point clouds (torus + cube) sharing one tomah.vert material; the
   torus/cube motion is on their Object3D transforms (the cube is a child of the
   tumbling torus group, so it passes through the hole at any orientation).
   Reveals with its chapter (driven from the active landmark).
   ===================================================================== */

import {
  Group,
  Points,
  ShaderMaterial,
  BufferGeometry,
  BufferAttribute,
  NormalBlending,
  Color,
  Vector2,
  Vector3,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  BoxGeometry,
  type PerspectiveCamera,
} from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import vertexShader from '../shaders/tomah.vert';
import fragmentShader from '../shaders/points.frag';
import { getGlyphAtlas } from './glyphAtlas';
import { TOMAH, PALETTE, TERRAIN_DEFAULTS } from '../core/config';

function sampleToCloud(geom: BufferGeometry, count: number): BufferGeometry {
  const sampler = new MeshSurfaceSampler(new Mesh(geom, new MeshBasicMaterial())).build();
  const position = new Float32Array(count * 3);
  const aNormal = new Float32Array(count * 3);
  const aSeed = new Float32Array(count);
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < count; i++) {
    sampler.sample(p, n);
    position[i * 3 + 0] = p.x;
    position[i * 3 + 1] = p.y;
    position[i * 3 + 2] = p.z;
    aNormal[i * 3 + 0] = n.x;
    aNormal[i * 3 + 1] = n.y;
    aNormal[i * 3 + 2] = n.z;
    aSeed[i] = Math.random();
  }
  geom.dispose();
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(position, 3));
  g.setAttribute('aNormal', new BufferAttribute(aNormal, 3));
  g.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
  return g;
}

export interface TomahOpts {
  center: Vector3; // station route point
  pixelRatio: number;
}

export class Tomah {
  readonly group: Group;
  readonly material: ShaderMaterial;
  private readonly torusGroup = new Group();
  private readonly cubeGroup = new Group();
  private readonly torusGeo: BufferGeometry;
  private readonly cubeGeo: BufferGeometry;
  private reduced = false;
  private hover = 0;
  private cursorX = 0;
  private cursorY = 0;
  private readonly ndc = new Vector3();

  constructor(opts: TomahOpts) {
    const atlas = getGlyphAtlas();
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uSize: { value: TOMAH.pointSize },
        uScale: { value: 30 },
        uPixelRatio: { value: opts.pixelRatio },
        uGlyphCount: { value: atlas.count },
        uGlyphAtlas: { value: atlas.texture },
        uColorCore: { value: new Color(PALETTE.glowCore) },
        uColorWarm: { value: new Color(PALETTE.amber) },
        uLightDir: { value: new Vector3(...TERRAIN_DEFAULTS.lightDir) },
        uCursor: { value: new Vector2() },
        uHover: { value: 0 },
        uAspect: { value: 1 },
        uRepelRadius: { value: TOMAH.repelRadius },
        uRepelStrength: { value: TOMAH.repelStrength },
        uMorphAmt: { value: TOMAH.morphAmt },
      },
    });

    this.torusGeo = sampleToCloud(new TorusGeometry(TOMAH.torusRadius, TOMAH.torusTube, 18, 64), TOMAH.torusPoints);
    this.cubeGeo = sampleToCloud(new BoxGeometry(TOMAH.cubeSize, TOMAH.cubeSize, TOMAH.cubeSize, 4, 4, 4), TOMAH.cubePoints);

    const torusPoints = new Points(this.torusGeo, this.material);
    torusPoints.frustumCulled = false;
    const cubePoints = new Points(this.cubeGeo, this.material);
    cubePoints.frustumCulled = false;

    // Cube is a child of the torus group → it tumbles with the torus and
    // shuttles along the torus's local axis (through the hole) at any angle.
    this.cubeGroup.add(cubePoints);
    this.torusGroup.add(torusPoints, this.cubeGroup);

    this.group = new Group();
    this.group.scale.setScalar(TOMAH.scale);
    this.group.position.copy(opts.center);
    this.group.position.y += TOMAH.lift;
    this.group.add(this.torusGroup);

    window.addEventListener('pointermove', this.onMove, { passive: true });
  }

  private onMove = (e: PointerEvent): void => {
    this.cursorX = (e.clientX / window.innerWidth) * 2 - 1;
    this.cursorY = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  /** reveal = station-6 reveal (0..1). */
  update(time: number, dt: number, camera: PerspectiveCamera, reveal: number): void {
    const u = this.material.uniforms;
    u.uReveal.value = reveal;
    this.group.visible = reveal > 0.002;
    if (!this.group.visible) return;

    u.uTime.value = time;
    const t = this.reduced ? time * 0.12 : time; // gentle when reduced-motion

    // Torus tumbles; cube shuttles through the hole + self-spins.
    this.torusGroup.rotation.y = t * TOMAH.spin;
    this.torusGroup.rotation.x = Math.sin(t * 0.25) * TOMAH.tilt;
    this.cubeGroup.position.z = Math.sin(t * TOMAH.oscSpeed) * TOMAH.oscAmp;
    this.cubeGroup.rotation.x = t * TOMAH.cubeSpin;
    this.cubeGroup.rotation.y = t * TOMAH.cubeSpin * 0.7;

    // Cursor + hover (cursor near the object's projected centre, while revealed).
    (u.uCursor.value as Vector2).set(this.cursorX, this.cursorY);
    u.uAspect.value = camera.aspect;
    this.ndc.copy(this.group.position).project(camera);
    const behind = this.ndc.z > 1;
    const dist = Math.hypot(this.ndc.x - this.cursorX, this.ndc.y - this.cursorY);
    const target = !this.reduced && !behind && reveal > 0.4 && dist < TOMAH.hoverRadius ? 1 : 0;
    this.hover += (target - this.hover) * Math.min(1, dt * 8);
    u.uHover.value = this.hover;
  }

  setReducedMotion(on: boolean): void {
    this.reduced = on;
  }

  setPixelRatio(r: number): void {
    this.material.uniforms.uPixelRatio.value = r;
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onMove);
    this.group.removeFromParent();
    this.torusGeo.dispose();
    this.cubeGeo.dispose();
    this.material.dispose();
  }
}
