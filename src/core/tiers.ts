/* =====================================================================
   tiers.ts — device capability detection → a quality tier and a flat
   settings object the managers read. Keeps perf decisions in one place.
   ===================================================================== */

import { WORLD, HERO } from './config';

export type Tier = 'high' | 'medium' | 'low' | 'reduced';

export interface QualitySettings {
  tier: Tier;
  reducedMotion: boolean;
  pixelRatioCap: number;
  terrainSegments: number;
  heroCell: number;
  heroLayers: number;
  heroPointSize: number;
  enableBloom: boolean;
  enableSMAA: boolean;
  enableNoise: boolean;
  enableSmoothScroll: boolean;
}

export interface Capabilities {
  webgl: boolean;
  settings: QualitySettings;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

function isMobile(): boolean {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 820px)').matches;
  return coarse && narrow;
}

function pickTier(): Tier {
  if (prefersReducedMotion()) return 'reduced';
  if (isMobile()) return 'low';

  const cores = navigator.hardwareConcurrency ?? 4;
  // deviceMemory is non-standard but widely available on Chromium.
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;

  if (cores >= 8 && mem >= 8) return 'high';
  if (cores >= 4) return 'medium';
  return 'low';
}

export function detectCapabilities(): Capabilities {
  const webgl = hasWebGL();
  const tier = pickTier();
  const reducedMotion = prefersReducedMotion();

  const settings: QualitySettings = {
    tier,
    reducedMotion,
    pixelRatioCap: tier === 'high' ? 2 : tier === 'medium' ? 1.75 : 1.5,
    terrainSegments: WORLD.segments[tier],
    heroCell: HERO.gridCell[tier],
    heroLayers: HERO.extrudeLayers[tier],
    heroPointSize: HERO.pointSize[tier],
    enableBloom: tier !== 'reduced',
    enableSMAA: tier === 'high' || tier === 'medium',
    enableNoise: tier !== 'reduced',
    // Reduced-motion uses native scroll (no inertia) for vestibular safety.
    enableSmoothScroll: !reducedMotion,
  };

  return { webgl, settings };
}
