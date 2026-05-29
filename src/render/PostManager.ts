/* =====================================================================
   PostManager — pmndrs/postprocessing pipeline. Renders the scene to a
   HalfFloat buffer (so bloom works in HDR), then a single EffectPass:
   SMAA → Bloom → Vignette → film-grain Noise → AgX tone mapping.
   Tone mapping lives here (renderer tone mapping is NoToneMapping) so it
   is applied exactly once, last.
   ===================================================================== */

import { HalfFloatType, type WebGLRenderer, type Scene, type Camera } from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  NoiseEffect,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  BlendFunction,
} from 'postprocessing';
import { POST } from '../core/config';
import type { QualitySettings } from '../core/tiers';

export class PostManager {
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;
  readonly vignette: VignetteEffect;
  readonly noise?: NoiseEffect;

  constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, settings: QualitySettings) {
    this.composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));

    const effects = [];

    if (settings.enableSMAA) effects.push(new SMAAEffect());

    this.bloom = new BloomEffect({
      intensity: POST.bloom.intensity,
      luminanceThreshold: POST.bloom.luminanceThreshold,
      luminanceSmoothing: POST.bloom.luminanceSmoothing,
      mipmapBlur: POST.bloom.mipmapBlur,
      radius: POST.bloom.radius,
    });
    if (settings.enableBloom) effects.push(this.bloom);

    this.vignette = new VignetteEffect({
      offset: POST.vignette.offset,
      darkness: POST.vignette.darkness,
    });
    effects.push(this.vignette);

    if (settings.enableNoise) {
      this.noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
      this.noise.blendMode.opacity.value = POST.noise.opacity;
      effects.push(this.noise);
    }

    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }));

    this.composer.addPass(new EffectPass(camera, ...effects));
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  render(deltaSeconds: number): void {
    this.composer.render(deltaSeconds);
  }

  resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
