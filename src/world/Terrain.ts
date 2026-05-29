/* =====================================================================
   Terrain — the topographic foundation. A high-subdivision plane (rotated
   into the XZ plane so the shader displaces +Y) rendered with the terrain
   ShaderMaterial: displacement + contour isolines + luminous dot field +
   path valley + warm grazing light. The path route is packed into a small
   uniform array; Phase 2 can swap procedural masks for baked PNGs without
   touching the shader.
   ===================================================================== */

import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Color,
  Vector2,
  Vector3,
  CatmullRomCurve3,
  type IUniform,
} from 'three';
import vertexShader from '../shaders/terrain.vert';
import fragmentShader from '../shaders/terrain.frag';
import { WORLD, ROUTE, TERRAIN_DEFAULTS, PALETTE } from '../core/config';

const MAX_PATH_POINTS = 64;

export class Terrain {
  readonly mesh: Mesh;
  readonly uniforms: Record<string, IUniform>;

  constructor(segments: number) {
    const geometry = new PlaneGeometry(WORLD.size, WORLD.size, segments, segments);
    geometry.rotateX(-Math.PI / 2); // lie flat: local xz == world xz, displace +Y

    // Sample the route SPLINE densely so the valley follows the curve (not a
    // straight polyline between raw control points).
    const curve = new CatmullRomCurve3(
      ROUTE.map((n) => new Vector3(n[0], n[1], n[2])),
      false,
      'catmullrom',
      0.5,
    );
    const samples = curve.getPoints(WORLD.valleySamples - 1); // → valleySamples points
    const pathPoints: Vector2[] = [];
    for (let i = 0; i < MAX_PATH_POINTS; i++) {
      const s = samples[Math.min(i, samples.length - 1)];
      pathPoints.push(new Vector2(s.x, s.z));
    }

    this.uniforms = {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uElevationScale: { value: TERRAIN_DEFAULTS.uElevationScale },
      uNoiseFrequency: { value: TERRAIN_DEFAULTS.uNoiseFrequency },
      uNoiseOctaves: { value: TERRAIN_DEFAULTS.uNoiseOctaves },
      uPathValleyDepth: { value: WORLD.pathValleyDepth },
      uPathValleyWidth: { value: WORLD.pathValleyWidth },
      uWaveAmount: { value: 0 },
      uWaveAmp: { value: TERRAIN_DEFAULTS.uWaveAmp },
      uWaveFreq: { value: TERRAIN_DEFAULTS.uWaveFreq },
      uWaveSpeed: { value: TERRAIN_DEFAULTS.uWaveSpeed },
      uStrataAmount: { value: 0 },
      uStrataStep: { value: TERRAIN_DEFAULTS.uStrataStep },
      uFlatten: { value: 0 },
      uFlattenCenter: { value: new Vector2(0, 0) },
      uFlattenRadius: { value: 30 },
      uFlattenLevel: { value: 0 },
      uRipple: { value: 0 },
      uRippleCenter: { value: new Vector2(0, 0) },
      uRippleFreq: { value: TERRAIN_DEFAULTS.uRippleFreq },
      uRippleSpeed: { value: TERRAIN_DEFAULTS.uRippleSpeed },
      uRippleAmp: { value: TERRAIN_DEFAULTS.uRippleAmp },
      uAudioBass: { value: 0 },
      uAudioLevel: { value: 0 },
      uPathPoints: { value: pathPoints },
      uPathCount: { value: WORLD.valleySamples },
      uContourFrequency: { value: TERRAIN_DEFAULTS.uContourFrequency },
      uContourThickness: { value: TERRAIN_DEFAULTS.uContourThickness },
      uContourColor: { value: new Color(TERRAIN_DEFAULTS.uContourColor) },
      uDotDensity: { value: TERRAIN_DEFAULTS.uDotDensity },
      uDotSize: { value: TERRAIN_DEFAULTS.uDotSize },
      uDotIntensity: { value: TERRAIN_DEFAULTS.uDotIntensity },
      uDotFlicker: { value: TERRAIN_DEFAULTS.uDotFlicker },
      uDotBand: { value: TERRAIN_DEFAULTS.uDotBand },
      uDotColor: { value: new Color(TERRAIN_DEFAULTS.uDotColor) },
      uBaseColor: { value: new Color(PALETTE.bg2) },
      uAmber: { value: new Color(PALETTE.amber) },
      uHazeColor: { value: new Color(TERRAIN_DEFAULTS.uHazeColor) },
      uHazeDensity: { value: TERRAIN_DEFAULTS.uHazeDensity },
      uLightDir: { value: new Vector3(...TERRAIN_DEFAULTS.lightDir) },
      uCameraPos: { value: new Vector3() },
      uWorldSize: { value: WORLD.size },
    };

    // Derivatives (fwidth/dFdx in the fragment shader) are available without an
    // extension on WebGL2, which three uses by default.
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
    });

    this.mesh = new Mesh(geometry, material);
    this.mesh.frustumCulled = false; // large plane, always in view
  }

  update(time: number, cameraPos: Vector3): void {
    this.uniforms.uTime.value = time;
    (this.uniforms.uCameraPos.value as Vector3).copy(cameraPos);
  }

  setReveal(v: number): void {
    this.uniforms.uReveal.value = v;
  }

  /** Blend the terrain into the wave-field (0 = topo, 1 = waves). */
  setWave(v: number): void {
    this.uniforms.uWaveAmount.value = v;
  }

  /** Blend the terrain into terraced strata (0 = topo, 1 = layers). */
  setStrata(v: number): void {
    this.uniforms.uStrataAmount.value = v;
  }

  /** Define the flatten clearing zone (world xz, radius, ground level). */
  setFlattenZone(cx: number, cz: number, radius: number, level: number): void {
    (this.uniforms.uFlattenCenter.value as Vector2).set(cx, cz);
    this.uniforms.uFlattenRadius.value = radius;
    this.uniforms.uFlattenLevel.value = level;
  }

  /** Flatten amount (0 = relief, 1 = flat clearing). */
  setFlatten(v: number): void {
    this.uniforms.uFlatten.value = v;
  }

  /** Audio-reactive ripple amount + its center (Discos). */
  setRipple(v: number): void {
    this.uniforms.uRipple.value = v;
  }

  setRippleZone(cx: number, cz: number): void {
    (this.uniforms.uRippleCenter.value as Vector2).set(cx, cz);
  }

  /** Feed analysed audio (0..1) each frame. */
  setAudio(bass: number, level: number): void {
    this.uniforms.uAudioBass.value = bass;
    this.uniforms.uAudioLevel.value = level;
  }

  /** Update the valley to follow an edited route (world XZ points). */
  setRoute(points: { x: number; z: number }[]): void {
    const arr = this.uniforms.uPathPoints.value as Vector2[];
    for (let i = 0; i < arr.length; i++) {
      const n = points[Math.min(i, points.length - 1)];
      arr[i].set(n.x, n.z);
    }
    this.uniforms.uPathCount.value = points.length;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as ShaderMaterial).dispose();
  }
}
