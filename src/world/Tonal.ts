/* =====================================================================
   Tonal — the SOUL creature of ECHO, ported from EchoIsleV1.1 (R3F) into
   the portfolio's single vanilla three.js renderer. It is the Echo-station
   landmark: a floating creature with a Fresnel-rim noise-deformed body,
   expressive eyes (12 presets + auto-blink), 16500 surface sparkles, and
   two phosphor trail systems (body light-trails + orbit-trails). It tracks
   the cursor — eyes dart first, ears follow, the body lags — and breathes.

   What was stripped (per the port spec): audio reactivity (all audio
   uniforms forced 0 → the shaders reduce to their silent baseline), all UI
   panels, and the sandbox environment (grid/floor/fog/mist/dust/OrbitControls).
   What was kept: body, eyes/expressions, sparkles, both trail systems, the
   full cursor/hover interaction, and computePalette.

   Coordinate model: the GLB is authored in centimetres; a `bodyGroup` scaled
   by TONAL_SCALE (0.01) turns it into a ~1 m creature in its own local frame,
   exactly as the source did — so every motion constant (lag ×100, float, squish)
   stays verbatim. An outer `group` then scales by `displayScale` to magnify the
   whole thing uniformly to landmark size, and positions/orients it in the world.
   ===================================================================== */

import {
  Group,
  Points,
  LineSegments,
  ShaderMaterial,
  BufferGeometry,
  BufferAttribute,
  DataTexture,
  RGBAFormat,
  FloatType,
  LinearFilter,
  ClampToEdgeWrapping,
  AdditiveBlending,
  Color,
  Vector2,
  Vector3,
  MathUtils,
  Mesh,
  type PerspectiveCamera,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import {
  bodyVertexShader,
  bodyFragmentShader,
  eyeVertexShader,
  eyeFragmentShader,
  sparkleVertexShader,
  sparkleFragmentShader,
  trailVertexShader,
  trailFragmentShader,
  orbitTrailVertexShader,
  orbitTrailFragmentShader,
} from './tonal/tonalShaders';
import {
  computePalette,
  EXPRESSION_BY_KEY,
  NEUTRAL,
  DEFAULT_TRAITS,
  DEFAULT_COSMETIC,
  type TonalTraits,
  type TonalCosmetic,
} from './tonal/tonalPalette';
import { withBase } from '../core/paths';

const { lerp, clamp, smoothstep } = MathUtils;

const TONAL_SCALE = 0.01;
const SPARKLE_PARTICLES = 16500;
const HISTORY_SIZE = 96; // ring buffer length & trail history-texture width
const TRAIL_COUNT = 60; // light-trail anchors
const TRAIL_SEGMENTS = 16;
const ORBIT_TRAIL_SEGMENTS = 24;
const ORBIT_TRAIL_LIFETIME_MIN = 4.0;
const ORBIT_TRAIL_LIFETIME_RANGE = 6.0;

export interface CreateTonalOpts {
  url?: string;
  traits?: Partial<TonalTraits>;
  cosmetic?: Partial<TonalCosmetic>;
  expression?: string;
  /** Uniform magnification of the ~1 m creature to landmark size. */
  displayScale?: number;
  /** Multiplies generated sparkle sizes (CPU side, shader stays verbatim).
      Defaults to the device pixel ratio so apparent size matches the source. */
  sparkleSizeMul?: number;
  /** Saturation lift on the body + eyes (1.0 = none). */
  saturation?: number;
  /** Palette warmth override 0..1 (pushes the creature toward its warm
      amber/olive/cream endpoints to blend with the site). Default uses the
      trait-derived warmth. */
  warmth?: number;
  /** Body opacity multiplier (1.0 = solid, lower = slight see-through). */
  translucency?: number;
  /** Exposure into the in-shader AgX grade (brightness; 1.0 = neutral). */
  exposure?: number;
  reducedMotion?: boolean;
}

export interface TonalHandle {
  readonly group: Group;
  update(elapsed: number, dt: number, camera: PerspectiveCamera): void;
  setExpression(key: string): void;
  /** Chapter reveal 0..1 — fades the body + sparkles + trails in/out. */
  setReveal(r: number): void;
  setReducedMotion(on: boolean): void;
  dispose(): void;
}

type Uniforms = Record<string, { value: unknown }>;

interface OrbitSlot {
  hostIdx: number;
  birthTime: number;
  lifetime: number;
}

function loadGLB(url: string): Promise<Group> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => resolve(gltf.scene as unknown as Group),
      undefined,
      (err) => reject(err),
    );
  });
}

export async function createTonal(opts: CreateTonalOpts = {}): Promise<TonalHandle | null> {
  const url = withBase(opts.url ?? '/models/tonal.glb');
  const traits: TonalTraits = { ...DEFAULT_TRAITS, ...opts.traits };
  const cosmetic: TonalCosmetic = { ...DEFAULT_COSMETIC, ...opts.cosmetic };
  const displayScale = opts.displayScale ?? 8;
  // gl_PointSize ignores object scale, so to keep the sparkle shell dense
  // relative to the magnified body, point sizes must scale with displayScale
  // (otherwise they shrink to faint dust at the camera's landmark distance).
  const sizeMul = opts.sparkleSizeMul ?? displayScale;

  let scene: Group;
  try {
    scene = await loadGLB(url);
  } catch (e) {
    console.error('[Tonal] failed to load GLB', e);
    return null;
  }

  // ── Split body (>1000 verts) vs eyes ──────────────────────────────────
  let bodyMesh: Mesh | null = null;
  let eyesMesh: Mesh | null = null;
  scene.traverse((obj) => {
    const m = obj as Mesh;
    if (!m.isMesh) return;
    const count = m.geometry?.attributes?.position?.count ?? 0;
    if (count > 1000) bodyMesh = m;
    else eyesMesh = m;
  });
  if (!bodyMesh) {
    console.error('[Tonal] no body mesh found in GLB');
    return null;
  }
  const body = bodyMesh as Mesh;
  const eyes = eyesMesh as Mesh | null;

  // ── Palette ───────────────────────────────────────────────────────────
  const palette = computePalette(traits, cosmetic, opts.warmth);

  // ── Shared uniforms (one object, referenced by every material) ────────
  const historyData = new Float32Array(HISTORY_SIZE * 4);
  const historyTex = new DataTexture(historyData, HISTORY_SIZE, 1, RGBAFormat, FloatType);
  historyTex.minFilter = LinearFilter;
  historyTex.magFilter = LinearFilter;
  historyTex.wrapS = ClampToEdgeWrapping;
  historyTex.wrapT = ClampToEdgeWrapping;
  historyTex.needsUpdate = true;

  const uniforms: Uniforms = {
    uTime: { value: 0 },
    uOpenness: { value: traits.openness },
    uTempo: { value: traits.tempo },
    uRiskThreshold: { value: traits.riskThreshold },
    uEnergyOrientation: { value: traits.energyOrientation },
    uSensitivity: { value: traits.sensitivity },
    uAttachmentStyle: { value: traits.attachmentStyle },
    uActivityLevel: { value: 1 },
    uEarYaw: { value: 0 },
    uEarPitch: { value: 0 },
    uLagAmountX: { value: 0 },
    uLagAmountY: { value: 0 },
    // Audio stripped — held at 0 so the shaders run their silent baseline.
    uAudioBass: { value: 0 },
    uAudioMid: { value: 0 },
    uAudioHigh: { value: 0 },
    uBodyShade: { value: cosmetic.bodyShade },
    uReveal: { value: 1 },
    uSaturation: { value: opts.saturation ?? 1.0 },
    uTranslucency: { value: opts.translucency ?? 0.88 },
    uExposure: { value: opts.exposure ?? 1.0 },
    uBodyColor: { value: palette.body.clone() },
    uRimColor: { value: palette.rim.clone() },
    // Eyes
    uLeftCenter: { value: new Vector3() },
    uRightCenter: { value: new Vector3() },
    uEyeHalfX: { value: 6.5 },
    uEyeHalfY: { value: 8.3 },
    uEyeCore: { value: palette.eyeCore.clone() },
    uEyeMid: { value: palette.eyeMid.clone() },
    uEyeRing: { value: palette.eyeRing.clone() },
    uExprOpenness: { value: 1 },
    uExprWidth: { value: 1 },
    uExprTilt: { value: 0 },
    uExprYShift: { value: 0 },
    uExprAsym: { value: 0 },
    uExprPinch: { value: 0 },
    uLidTopH: { value: 0 },
    uLidTopSlant: { value: 0 },
    uLidTopCurve: { value: 0 },
    uLidBotH: { value: 0 },
    uLidBotSlant: { value: 0 },
    uLidBotCurve: { value: 0 },
    // Trails
    uTrailAlpha: { value: 0 },
    uHistoryTexture: { value: historyTex },
  };

  // ── Eye centroids / half-extents (split by sign(x)) ───────────────────
  if (eyes) {
    const pos = eyes.geometry.attributes.position;
    const inf = Infinity;
    const left = { xmin: inf, xmax: -inf, ymin: inf, ymax: -inf, zmin: inf, zmax: -inf };
    const right = { xmin: inf, xmax: -inf, ymin: inf, ymax: -inf, zmin: inf, zmax: -inf };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const t = x < 0 ? left : right;
      if (x < t.xmin) t.xmin = x;
      if (x > t.xmax) t.xmax = x;
      if (y < t.ymin) t.ymin = y;
      if (y > t.ymax) t.ymax = y;
      if (z < t.zmin) t.zmin = z;
      if (z > t.zmax) t.zmax = z;
    }
    (uniforms.uLeftCenter.value as Vector3).set(
      (left.xmin + left.xmax) / 2,
      (left.ymin + left.ymax) / 2,
      (left.zmin + left.zmax) / 2,
    );
    (uniforms.uRightCenter.value as Vector3).set(
      (right.xmin + right.xmax) / 2,
      (right.ymin + right.ymax) / 2,
      (right.zmin + right.zmax) / 2,
    );
    const lhx = (left.xmax - left.xmin) / 2;
    const rhx = (right.xmax - right.xmin) / 2;
    const lhy = (left.ymax - left.ymin) / 2;
    const rhy = (right.ymax - right.ymin) / 2;
    uniforms.uEyeHalfX.value = (lhx + rhx) / 2;
    uniforms.uEyeHalfY.value = (lhy + rhy) / 2;
  }

  // ── Materials ─────────────────────────────────────────────────────────
  body.geometry.computeVertexNormals();
  const bodyMat = new ShaderMaterial({
    vertexShader: bodyVertexShader,
    fragmentShader: bodyFragmentShader,
    uniforms: uniforms as never,
    transparent: true, // for the uReveal fade (writes depth so eyes/sparkles sort)
  });
  body.material = bodyMat;
  body.renderOrder = 0; // drawn first, so the additive layers below paint on top

  let eyeMat: ShaderMaterial | null = null;
  if (eyes) {
    eyeMat = new ShaderMaterial({
      vertexShader: eyeVertexShader,
      fragmentShader: eyeFragmentShader,
      uniforms: uniforms as never,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    eyes.material = eyeMat;
    eyes.renderOrder = 10;
    eyes.rotation.order = 'YXZ';
  }

  // ── Sparkle data (16500 surface points) ───────────────────────────────
  const sampler = new MeshSurfaceSampler(body).build();
  const positions = new Float32Array(SPARKLE_PARTICLES * 3);
  const colors = new Float32Array(SPARKLE_PARTICLES * 3);
  const sizes = new Float32Array(SPARKLE_PARTICLES);
  const randoms = new Float32Array(SPARKLE_PARTICLES);
  const origins = new Float32Array(SPARKLE_PARTICLES * 3);
  const normals = new Float32Array(SPARKLE_PARTICLES * 3);
  const offsetsArr = new Float32Array(SPARKLE_PARTICLES);
  const behaviors = new Float32Array(SPARKLE_PARTICLES);
  const orbitData = new Float32Array(SPARKLE_PARTICLES * 4);
  const tmpPos = new Vector3();
  const tmpNormal = new Vector3();

  const risk = traits.riskThreshold;
  const attach = traits.attachmentStyle;
  const tempo = traits.tempo;

  const offsetRangeScale = lerp(0.5, 1.6, 1 - attach);
  const offsetMin = -1.5 * offsetRangeScale;
  const offsetSpan = 5.5 * offsetRangeScale;
  const anchorPct = lerp(0.92, 0.72, risk);
  const orbitPct = lerp(0.04, 0.12, risk);
  const sparkleCool = palette.sparkleCool;
  const sparkleWarm = palette.sparkleWarm;
  const sparkleAccent = palette.sparkleAccent;
  const tealRatio = palette.tealRatio;
  const accentRate = palette.accentRate;
  const sizeExp = lerp(2.6, 1.4, risk);
  const sizeTail = lerp(2.5, 5.0, risk);
  const orbitTiltMax = lerp(0.25, 1.0, risk) * (Math.PI * 0.66);
  const orbitSpeedScale = lerp(0.4, 1.5, risk) * lerp(0.6, 1.5, tempo);

  for (let i = 0; i < SPARKLE_PARTICLES; i++) {
    sampler.sample(tmpPos, tmpNormal);
    const offset = offsetMin + Math.random() * offsetSpan;

    positions[i * 3 + 0] = tmpPos.x + tmpNormal.x * offset;
    positions[i * 3 + 1] = tmpPos.y + tmpNormal.y * offset;
    positions[i * 3 + 2] = tmpPos.z + tmpNormal.z * offset;

    origins[i * 3 + 0] = tmpPos.x;
    origins[i * 3 + 1] = tmpPos.y;
    origins[i * 3 + 2] = tmpPos.z;

    normals[i * 3 + 0] = tmpNormal.x;
    normals[i * 3 + 1] = tmpNormal.y;
    normals[i * 3 + 2] = tmpNormal.z;

    offsetsArr[i] = offset;

    const tint = 0.6 + Math.random() * 0.4;
    const p = Math.random();
    let pick: Color;
    if (p < accentRate) pick = sparkleAccent;
    else if (p < accentRate + tealRatio * (1 - accentRate)) pick = sparkleCool;
    else pick = sparkleWarm;
    colors[i * 3 + 0] = pick.r * tint;
    colors[i * 3 + 1] = pick.g * tint;
    colors[i * 3 + 2] = pick.b * tint;

    sizes[i] = (0.3 + Math.pow(Math.random(), sizeExp) * sizeTail) * sizeMul;
    randoms[i] = Math.random();

    const br = Math.random();
    behaviors[i] = br < anchorPct ? 0 : br < anchorPct + orbitPct ? 1 : 2;

    if (behaviors[i] === 1) {
      const tiltX = (Math.random() - 0.5) * orbitTiltMax;
      const tiltZ = (Math.random() - 0.5) * orbitTiltMax;
      const speed = (0.075 + Math.random() * 0.525) * orbitSpeedScale * (Math.random() < 0.5 ? -1 : 1);
      const initAngle = Math.random() * Math.PI * 2;
      orbitData[i * 4 + 0] = tiltX;
      orbitData[i * 4 + 1] = tiltZ;
      orbitData[i * 4 + 2] = speed;
      orbitData[i * 4 + 3] = initAngle;
    }
  }

  // Orbit pool (must mirror the orbit-branch shader formula exactly).
  const orbitIndices: number[] = [];
  for (let i = 0; i < SPARKLE_PARTICLES; i++) if (behaviors[i] === 1) orbitIndices.push(i);
  const orbitPoolCount = orbitIndices.length;
  const orbitPoolParams = new Float32Array(orbitPoolCount * 6);
  {
    const shellInner = lerp(2.0, 6.0, 1 - attach);
    const shellRange = lerp(8.0, 22.0, 1 - attach);
    const lagPoolScale = lerp(0.7, 1.6, 1 - attach);
    for (let t = 0; t < orbitPoolCount; t++) {
      const i = orbitIndices[t];
      const ox = origins[i * 3 + 0];
      const oy = origins[i * 3 + 1];
      const oz = origins[i * 3 + 2];
      const radius = Math.sqrt(ox * ox + oy * oy + oz * oz) + shellInner + randoms[i] * shellRange;
      const lagFactor = (0.5 + randoms[i] * 1.5) * lagPoolScale;
      orbitPoolParams[t * 6 + 0] = orbitData[i * 4 + 0];
      orbitPoolParams[t * 6 + 1] = orbitData[i * 4 + 1];
      orbitPoolParams[t * 6 + 2] = orbitData[i * 4 + 2];
      orbitPoolParams[t * 6 + 3] = orbitData[i * 4 + 3];
      orbitPoolParams[t * 6 + 4] = radius;
      orbitPoolParams[t * 6 + 5] = lagFactor;
    }
  }

  // Light-trail origins (60, biased to the back side z<0).
  const trailOrigins = new Float32Array(TRAIL_COUNT * 3);
  {
    const backSide: number[] = [];
    for (let i = 0; i < SPARKLE_PARTICLES; i++) if (origins[i * 3 + 2] < 0) backSide.push(i);
    const pool = backSide.length > 0 ? backSide : null;
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const idx = pool
        ? pool[Math.floor(Math.random() * pool.length)]
        : Math.floor(Math.random() * SPARKLE_PARTICLES);
      trailOrigins[i * 3 + 0] = origins[idx * 3 + 0];
      trailOrigins[i * 3 + 1] = origins[idx * 3 + 1];
      trailOrigins[i * 3 + 2] = origins[idx * 3 + 2];
    }
  }

  // ── Sparkle Points ────────────────────────────────────────────────────
  const sparkleGeo = new BufferGeometry();
  sparkleGeo.setAttribute('position', new BufferAttribute(positions, 3));
  sparkleGeo.setAttribute('aColor', new BufferAttribute(colors, 3));
  sparkleGeo.setAttribute('aSize', new BufferAttribute(sizes, 1));
  sparkleGeo.setAttribute('aRandom', new BufferAttribute(randoms, 1));
  sparkleGeo.setAttribute('aOrigin', new BufferAttribute(origins, 3));
  sparkleGeo.setAttribute('aNormalAttr', new BufferAttribute(normals, 3));
  sparkleGeo.setAttribute('aOffset', new BufferAttribute(offsetsArr, 1));
  sparkleGeo.setAttribute('aBehavior', new BufferAttribute(behaviors, 1));
  sparkleGeo.setAttribute('aOrbitData', new BufferAttribute(orbitData, 4));
  const sparkleMat = new ShaderMaterial({
    vertexShader: sparkleVertexShader,
    fragmentShader: sparkleFragmentShader,
    uniforms: uniforms as never,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const sparklePoints = new Points(sparkleGeo, sparkleMat);
  sparklePoints.frustumCulled = false;
  sparklePoints.renderOrder = 2; // on top of the body (depth-tested, so back ones still cull)

  // ── Light trails (body-motion streaks) ────────────────────────────────
  const ltVerts = TRAIL_COUNT * TRAIL_SEGMENTS * 2;
  const ltPos = new Float32Array(ltVerts * 3);
  const ltOrigin = new Float32Array(ltVerts * 3);
  const ltSegT = new Float32Array(ltVerts);
  const ltRandom = new Float32Array(ltVerts);
  for (let t = 0; t < TRAIL_COUNT; t++) {
    const ox = trailOrigins[t * 3 + 0];
    const oy = trailOrigins[t * 3 + 1];
    const oz = trailOrigins[t * 3 + 2];
    const random = Math.random();
    for (let s = 0; s < TRAIL_SEGMENTS; s++) {
      for (let v = 0; v < 2; v++) {
        const idx = (t * TRAIL_SEGMENTS + s) * 2 + v;
        ltOrigin[idx * 3 + 0] = ox;
        ltOrigin[idx * 3 + 1] = oy;
        ltOrigin[idx * 3 + 2] = oz;
        ltSegT[idx] = (s + v) / TRAIL_SEGMENTS;
        ltRandom[idx] = random;
      }
    }
  }
  const ltGeo = new BufferGeometry();
  ltGeo.setAttribute('position', new BufferAttribute(ltPos, 3));
  ltGeo.setAttribute('aOrigin', new BufferAttribute(ltOrigin, 3));
  ltGeo.setAttribute('aSegT', new BufferAttribute(ltSegT, 1));
  ltGeo.setAttribute('aTrailRandom', new BufferAttribute(ltRandom, 1));
  const ltMat = new ShaderMaterial({
    vertexShader: trailVertexShader,
    fragmentShader: trailFragmentShader,
    uniforms: uniforms as never,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const lightTrails = new LineSegments(ltGeo, ltMat);
  lightTrails.frustumCulled = false;
  lightTrails.renderOrder = 2;

  // ── Orbit trails (analytic orbit streaks) ─────────────────────────────
  const slotCount = Math.max(1, Math.round(lerp(35, 12, attach)));
  const otVerts = slotCount * ORBIT_TRAIL_SEGMENTS * 2;
  const otPos = new Float32Array(otVerts * 3);
  const otSegT = new Float32Array(otVerts);
  const otA = new Float32Array(otVerts * 4);
  const otB = new Float32Array(otVerts * 4);
  const slots: OrbitSlot[] = new Array(slotCount);

  const writeSlot = (s: number, slot: OrbitSlot): void => {
    const h = slot.hostIdx;
    const tiltX = orbitPoolParams[h * 6 + 0];
    const tiltZ = orbitPoolParams[h * 6 + 1];
    const speed = orbitPoolParams[h * 6 + 2];
    const initAngle = orbitPoolParams[h * 6 + 3];
    const radius = orbitPoolParams[h * 6 + 4];
    const lagFactor = orbitPoolParams[h * 6 + 5];
    for (let seg = 0; seg < ORBIT_TRAIL_SEGMENTS; seg++) {
      for (let v = 0; v < 2; v++) {
        const idx = (s * ORBIT_TRAIL_SEGMENTS + seg) * 2 + v;
        otSegT[idx] = (seg + v) / ORBIT_TRAIL_SEGMENTS;
        otA[idx * 4 + 0] = tiltX;
        otA[idx * 4 + 1] = tiltZ;
        otA[idx * 4 + 2] = speed;
        otA[idx * 4 + 3] = initAngle;
        otB[idx * 4 + 0] = radius;
        otB[idx * 4 + 1] = lagFactor;
        otB[idx * 4 + 2] = slot.birthTime;
        otB[idx * 4 + 3] = slot.lifetime;
      }
    }
  };
  // Slots are populated lazily on the first update (birthTimes are relative to
  // the shared clock, which isn't 0 when the creature is built mid-journey).
  for (let s = 0; s < slotCount; s++) {
    slots[s] = {
      hostIdx: orbitPoolCount > 0 ? Math.floor(Math.random() * orbitPoolCount) : 0,
      birthTime: 0,
      lifetime: ORBIT_TRAIL_LIFETIME_MIN + Math.random() * ORBIT_TRAIL_LIFETIME_RANGE,
    };
  }
  const otGeo = new BufferGeometry();
  otGeo.setAttribute('position', new BufferAttribute(otPos, 3));
  otGeo.setAttribute('aSegT', new BufferAttribute(otSegT, 1));
  const otAAttr = new BufferAttribute(otA, 4);
  const otBAttr = new BufferAttribute(otB, 4);
  otGeo.setAttribute('aOrbitTrailA', otAAttr);
  otGeo.setAttribute('aOrbitTrailB', otBAttr);
  const otMat = new ShaderMaterial({
    vertexShader: orbitTrailVertexShader,
    fragmentShader: orbitTrailFragmentShader,
    uniforms: uniforms as never,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const orbitTrails = new LineSegments(otGeo, otMat);
  orbitTrails.frustumCulled = false;
  orbitTrails.renderOrder = 2;
  const hasOrbits = orbitPoolCount > 0;
  orbitTrails.visible = hasOrbits;

  // ── Assemble groups ───────────────────────────────────────────────────
  const bodyGroup = new Group();
  bodyGroup.rotation.order = 'YXZ';
  bodyGroup.scale.setScalar(TONAL_SCALE);
  bodyGroup.add(scene, sparklePoints, lightTrails, orbitTrails);

  const group = new Group();
  group.scale.setScalar(displayScale);
  group.add(bodyGroup);

  // ── Per-soul constants (derived once) ─────────────────────────────────
  const tOpenness = traits.openness;
  const tEnergy = traits.energyOrientation;
  const tTempo = traits.tempo;
  const tSens = traits.sensitivity;
  const eyeLerpScale = lerp(0.5, 1.6, tSens);
  const opennessSlow = lerp(1.4, 0.7, tOpenness);
  const earLerpScale = lerp(0.6, 1.5, tSens) * opennessSlow;
  const bodyLerpScale = lerp(0.7, 1.4, tSens) * opennessSlow;
  const energyReact = lerp(0.5, 1.4, tEnergy);
  const energySquish = lerp(0.4, 1.6, tEnergy);
  const exprK = 0.08 * lerp(0.7, 1.5, tSens);

  // ── Mutable per-frame state ───────────────────────────────────────────
  const st = {
    eyeYaw: 0, eyePitch: 0,
    earYaw: 0, earPitch: 0,
    bodyYaw: 0, bodyPitch: 0,
    smoothX: 0, smoothY: 0,
    scaleX: TONAL_SCALE, scaleY: TONAL_SCALE, scaleZ: TONAL_SCALE,
    laggedX: 0, laggedY: 0,
    trailAlpha: 0,
    billboardYaw: 0,
    billboardInit: false,
    orbitInit: false,
  };
  const history: Vector2[] = [];
  for (let i = 0; i < HISTORY_SIZE; i++) history.push(new Vector2());
  const blink = { nextBlinkAt: 2 + Math.random() * 4, blinkStartedAt: -1 };
  const pointerLag = { driftPx: 0, driftPy: 0, enteredAt: -1, exitedAt: -1 };

  // ── Pointer (NDC, [-1,1] y-up) + enter/leave ──────────────────────────
  let ptrX = 0, ptrY = 0, inside = true;
  let reduced = opts.reducedMotion ?? false;
  let expressionKey = opts.expression ?? 'neutral';
  let revealTarget = 0; // hidden until the Echo station becomes active
  let revealCur = 0;

  const onMove = (e: PointerEvent): void => {
    ptrX = (e.clientX / window.innerWidth) * 2 - 1;
    ptrY = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  const onEnter = (): void => { inside = true; };
  const onLeave = (): void => { inside = false; };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('mouseenter', onEnter);
  document.addEventListener('mouseleave', onLeave);

  const camPos = new Vector3();

  function update(elapsed: number, dt: number, camera: PerspectiveCamera): void {
    // Reveal smoothing (drives activity + body alpha; hides when fully gone).
    revealCur += (revealTarget - revealCur) * Math.min(1, dt * 4);
    const visible = revealCur > 0.002;
    group.visible = visible;
    uniforms.uActivityLevel.value = revealCur;
    uniforms.uReveal.value = revealCur;
    if (!visible) return;

    // 1. time
    uniforms.uTime.value = elapsed;

    // Effective pointer with cursor-leave drift to centre.
    const livePx = reduced ? 0 : ptrX;
    const livePy = reduced ? 0 : ptrY;
    const POINTER_EXIT_DELAY = 0.45;
    const POINTER_ENTRY_DELAY = 0.25;
    const POINTER_EXIT_K = 0.012;
    const POINTER_ENTRY_K = 0.015 * lerp(0.6, 1.6, tSens);
    if (inside && !reduced) {
      pointerLag.exitedAt = -1;
      if (pointerLag.enteredAt < 0) pointerLag.enteredAt = elapsed;
      if (elapsed - pointerLag.enteredAt > POINTER_ENTRY_DELAY) {
        pointerLag.driftPx += (livePx - pointerLag.driftPx) * POINTER_ENTRY_K;
        pointerLag.driftPy += (livePy - pointerLag.driftPy) * POINTER_ENTRY_K;
      }
    } else {
      pointerLag.enteredAt = -1;
      if (pointerLag.exitedAt < 0) pointerLag.exitedAt = elapsed;
      if (elapsed - pointerLag.exitedAt > POINTER_EXIT_DELAY) {
        pointerLag.driftPx += (0 - pointerLag.driftPx) * POINTER_EXIT_K;
        pointerLag.driftPy += (0 - pointerLag.driftPy) * POINTER_EXIT_K;
      }
    }
    const effPx = pointerLag.driftPx;
    const effPy = pointerLag.driftPy;
    const eyePx = inside && !reduced ? livePx : effPx;
    const eyePy = inside && !reduced ? livePy : effPy;

    // 4. eye expression lerp toward target
    const target = EXPRESSION_BY_KEY[expressionKey] ?? NEUTRAL;
    const k = exprK;
    uniforms.uExprOpenness.value = num(uniforms.uExprOpenness) + (target.openness - num(uniforms.uExprOpenness)) * k;
    uniforms.uExprWidth.value = num(uniforms.uExprWidth) + (target.width - num(uniforms.uExprWidth)) * k;
    uniforms.uExprTilt.value = num(uniforms.uExprTilt) + (target.tilt - num(uniforms.uExprTilt)) * k;
    uniforms.uExprYShift.value = num(uniforms.uExprYShift) + (target.yShift - num(uniforms.uExprYShift)) * k;
    uniforms.uExprAsym.value = num(uniforms.uExprAsym) + (target.asym - num(uniforms.uExprAsym)) * k;
    uniforms.uExprPinch.value = num(uniforms.uExprPinch) + (target.pinch - num(uniforms.uExprPinch)) * k;
    uniforms.uLidTopSlant.value = num(uniforms.uLidTopSlant) + (target.lidTopSlant - num(uniforms.uLidTopSlant)) * k;
    uniforms.uLidTopCurve.value = num(uniforms.uLidTopCurve) + (target.lidTopCurve - num(uniforms.uLidTopCurve)) * k;
    uniforms.uLidBotSlant.value = num(uniforms.uLidBotSlant) + (target.lidBotSlant - num(uniforms.uLidBotSlant)) * k;
    uniforms.uLidBotCurve.value = num(uniforms.uLidBotCurve) + (target.lidBotCurve - num(uniforms.uLidBotCurve)) * k;

    // 5. blink scheduler
    let blinkAmount = 0;
    if (blink.blinkStartedAt < 0) {
      if (elapsed >= blink.nextBlinkAt) blink.blinkStartedAt = elapsed;
    }
    if (blink.blinkStartedAt >= 0) {
      const bdt = elapsed - blink.blinkStartedAt;
      const closing = smoothstep(bdt, 0.0, 0.07);
      const opening = 1 - smoothstep(bdt, 0.11, 0.24);
      blinkAmount = Math.min(closing, opening);
      if (bdt > 0.24) {
        blink.blinkStartedAt = -1;
        const blinkBase = lerp(7, 3, tEnergy);
        const blinkSpan = lerp(8, 6, tEnergy);
        const tempoSpeed = lerp(0.7, 1.4, tTempo);
        blink.nextBlinkAt = elapsed + (blinkBase + Math.random() * blinkSpan) / tempoSpeed;
      }
    }

    // 6. compose blink into lid heights
    const blinkTopH = lerp(target.lidTopH, 0.5, blinkAmount);
    const blinkBotH = lerp(target.lidBotH, 0.5, blinkAmount);
    const lidK = blinkAmount > 0.01 ? 0.35 : k;
    uniforms.uLidTopH.value = num(uniforms.uLidTopH) + (blinkTopH - num(uniforms.uLidTopH)) * lidK;
    uniforms.uLidBotH.value = num(uniforms.uLidBotH) + (blinkBotH - num(uniforms.uLidBotH)) * lidK;

    // 8. eye cursor tracking
    if (eyes) {
      const maxYaw = 0.3;
      const maxPitch = 0.27;
      const targetYaw = eyePx * maxYaw;
      const targetPitch = -eyePy * maxPitch;
      const smooth = 0.1 * eyeLerpScale;
      st.eyeYaw += (targetYaw - st.eyeYaw) * smooth;
      st.eyePitch += (targetPitch - st.eyePitch) * smooth;
      eyes.rotation.y = st.eyeYaw;
      eyes.rotation.x = st.eyePitch;
    }

    // 9. ear cursor tracking (uniforms read by body + sparkle shaders)
    {
      const maxYaw = 0.35 * energyReact;
      const maxPitch = 0.38 * energyReact;
      const targetYaw = effPx * maxYaw;
      const targetPitch = -effPy * maxPitch;
      const smooth = 0.07 * earLerpScale;
      st.earYaw += (targetYaw - st.earYaw) * smooth;
      st.earPitch += (targetPitch - st.earPitch) * smooth;
      uniforms.uEarYaw.value = st.earYaw;
      uniforms.uEarPitch.value = st.earPitch;
    }

    // 10. body cursor tracking
    {
      const maxYaw = 0.45 * energyReact;
      const maxPitch = 0.65 * energyReact;
      const targetYaw = effPx * maxYaw;
      const targetPitch = -effPy * maxPitch;
      const smooth = 0.04 * bodyLerpScale;
      st.bodyYaw += (targetYaw - st.bodyYaw) * smooth;
      st.bodyPitch += (targetPitch - st.bodyPitch) * smooth;
      bodyGroup.rotation.y = st.bodyYaw;
      bodyGroup.rotation.x = st.bodyPitch;
    }

    // 11. positional float
    {
      const maxX = 0.28;
      const maxY = 0.2;
      const targetX = effPx * maxX;
      const targetY = effPy * maxY;
      const driftSmooth = 0.01 * bodyLerpScale;
      st.smoothX += (targetX - st.smoothX) * driftSmooth;
      st.smoothY += (targetY - st.smoothY) * driftSmooth;
    }

    // 13. apply body position (bounceY = 0 — audio bounce stripped)
    bodyGroup.position.x = st.smoothX;
    bodyGroup.position.y = st.smoothY;

    // 14. cursor squish (non-uniform scale from TONAL_SCALE)
    {
      const px = Math.abs(effPx);
      const py = Math.abs(effPy);
      const stretchAmt = 0.12 * energySquish;
      const compressAmt = 0.04 * energySquish;
      const targetSX = TONAL_SCALE * (1.0 + (px - py * 0.5) * stretchAmt);
      const targetSY = TONAL_SCALE * (1.0 + (py - px * 0.5) * stretchAmt);
      const targetSZ = TONAL_SCALE * (1.0 - (px + py) * compressAmt);
      const squishLerp = 0.05 * bodyLerpScale;
      st.scaleX += (targetSX - st.scaleX) * squishLerp;
      st.scaleY += (targetSY - st.scaleY) * squishLerp;
      st.scaleZ += (targetSZ - st.scaleZ) * squishLerp;
      bodyGroup.scale.set(st.scaleX, st.scaleY, st.scaleZ);
    }

    // 15. lagged position → uLagAmount (metres → cm via ×100)
    {
      const lagSmooth = 0.015;
      st.laggedX += (st.smoothX - st.laggedX) * lagSmooth;
      st.laggedY += (st.smoothY - st.laggedY) * lagSmooth;
      uniforms.uLagAmountX.value = (st.laggedX - st.smoothX) * 100;
      uniforms.uLagAmountY.value = (st.laggedY - st.smoothY) * 100;
    }

    // 16. trail trajectory recording + history texture
    {
      const lagX = uniforms.uLagAmountX.value as number;
      const lagY = uniforms.uLagAmountY.value as number;
      const motionMag = Math.sqrt(lagX * lagX + lagY * lagY);
      const motionActive = motionMag > 1.0;
      if (motionActive) {
        if (st.trailAlpha < 0.05) {
          for (let i = 0; i < HISTORY_SIZE; i++) history[i].set(st.smoothX, st.smoothY);
        } else {
          for (let i = HISTORY_SIZE - 1; i > 0; i--) history[i].copy(history[i - 1]);
        }
        history[0].set(st.smoothX, st.smoothY);
        st.trailAlpha += (1.0 - st.trailAlpha) * 0.015;
      } else {
        st.trailAlpha *= 0.99;
      }
      const cx = st.smoothX;
      const cy = st.smoothY;
      for (let i = 0; i < HISTORY_SIZE; i++) {
        const base = i * 4;
        historyData[base + 0] = (history[i].x - cx) * 100;
        historyData[base + 1] = (history[i].y - cy) * 100;
      }
      historyTex.needsUpdate = true;
      uniforms.uTrailAlpha.value = st.trailAlpha;
    }

    // Orbit-trail slot recycling (analytic; birthTimes relative to `elapsed`).
    if (hasOrbits) {
      if (!st.orbitInit) {
        for (let s = 0; s < slotCount; s++) {
          slots[s].birthTime = elapsed - Math.random() * slots[s].lifetime;
          writeSlot(s, slots[s]);
        }
        otAAttr.needsUpdate = true;
        otBAttr.needsUpdate = true;
        st.orbitInit = true;
      } else {
        let dirty = false;
        for (let s = 0; s < slotCount; s++) {
          const slot = slots[s];
          if (elapsed - slot.birthTime > slot.lifetime) {
            slot.hostIdx = Math.floor(Math.random() * orbitPoolCount);
            slot.birthTime = elapsed;
            slot.lifetime = ORBIT_TRAIL_LIFETIME_MIN + Math.random() * ORBIT_TRAIL_LIFETIME_RANGE;
            writeSlot(s, slot);
            dirty = true;
          }
        }
        if (dirty) {
          otAAttr.needsUpdate = true;
          otBAttr.needsUpdate = true;
        }
      }
    }

    // Billboard: face the camera (yaw only) so the soul looks at the viewer.
    if (!reduced || !st.billboardInit) {
      camPos.copy(camera.position);
      const dx = camPos.x - group.position.x;
      const dz = camPos.z - group.position.z;
      const targetBillboard = Math.atan2(dx, dz);
      if (!st.billboardInit) {
        st.billboardYaw = targetBillboard;
        st.billboardInit = true;
      } else {
        // shortest-arc smoothing
        let d = targetBillboard - st.billboardYaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        st.billboardYaw += d * Math.min(1, dt * 2);
      }
      group.rotation.y = st.billboardYaw;
    }
  }

  function dispose(): void {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('mouseenter', onEnter);
    document.removeEventListener('mouseleave', onLeave);
    group.removeFromParent();
    sparkleGeo.dispose();
    ltGeo.dispose();
    otGeo.dispose();
    body.geometry.dispose();
    if (eyes) eyes.geometry.dispose();
    bodyMat.dispose();
    eyeMat?.dispose();
    sparkleMat.dispose();
    ltMat.dispose();
    otMat.dispose();
    historyTex.dispose();
  }

  return {
    group,
    update,
    setExpression(key: string) { expressionKey = key; },
    setReveal(r: number) { revealTarget = clamp(r, 0, 1); },
    setReducedMotion(on: boolean) { reduced = on; },
    dispose,
  };
}

/** Small helper: read a numeric uniform value with correct typing. */
function num(u: { value: unknown }): number {
  return u.value as number;
}
