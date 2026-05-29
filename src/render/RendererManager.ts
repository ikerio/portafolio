/* =====================================================================
   RendererManager — owns the WebGLRenderer. Color management on, tone
   mapping OFF (handled in PostManager to avoid double-application), and
   pixel ratio clamped per quality tier.
   ===================================================================== */

import {
  WebGLRenderer,
  SRGBColorSpace,
  NoToneMapping,
  Color,
} from 'three';
import { PALETTE } from '../core/config';
import type { QualitySettings } from '../core/tiers';

export class RendererManager {
  readonly renderer: WebGLRenderer;

  constructor(canvas: HTMLCanvasElement, settings: QualitySettings) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false, // AA is handled by SMAA in the post pipeline
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Color management (default-on since r152): author/output in sRGB.
    this.renderer.outputColorSpace = SRGBColorSpace;
    // Tone mapping is applied as the final post effect, not here.
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.setClearColor(new Color(PALETTE.bg0), 1);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
