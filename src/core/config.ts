/* =====================================================================
   config.ts — single source of truth for tunable values.
   Colors mirror DesignSystem/styles/tokens.css (kept in sync by hand;
   tokens.css remains canonical for the DOM). Geometry, camera path,
   shader defaults, scroll ranges and quality tiers all live here so no
   magic numbers are scattered through the engine.
   ===================================================================== */

export type Vec3 = readonly [number, number, number];

/** Warm-dark matte palette — hex strings (THREE.Color + CSS both accept these). */
export const PALETTE = {
  void: '#0a0908',
  bg0: '#100e0c',
  bg1: '#16130f',
  bg2: '#1d1915',
  glowCore: '#f4e8c9',
  glowWarm: '#e9d8b3',
  amber: '#d9bd84',
  amberDim: '#9c8a63',
  ink0: '#ece3d4',
  ink1: '#b6ab98',
  ink2: '#7d7565',
  ink3: '#564f45',
} as const;

/** The world plane the camera travels over. */
export const WORLD = {
  /** Square terrain side length in world units (large, so the winding path fits). */
  size: 260,
  /** Plane subdivisions per quality tier (segments per side). */
  segments: { high: 380, medium: 280, low: 170, reduced: 110 },
  /** Peak vertical displacement of the relief. */
  elevationScale: 9.2,
  /** How deep the path carves a valley into the relief. */
  pathValleyDepth: 3.2,
  /** Half-width (world units) of the path valley influence. */
  pathValleyWidth: 7.0,
  /** Points sampled along the route spline to make the valley follow the curve. */
  valleySamples: 48,
} as const;

/**
 * The single authored route, in WORLD coordinates (ground, y≈0). Everything
 * shares it: the camera parallels it, the terrain carves a valley along it,
 * the ASCII bead-road renders on it, and landmarks sit beside it. It winds
 * from the hero (origin) left-and-forward past Who I Am and the bust, then
 * sweeps back to the right into the distance (the diorama's path shape).
 */
// Route points carry y, so the path can rise/fall (ramps, crests) along its run.
// Sculpted in-app via the route tool. Point 0 is the hero — the path starts at
// it so the hero sits on the road (gets the bead-path + valley + haze).
export const ROUTE: Vec3[] = [
  [   0,   0,   -2], // hero — path origin
  [   3,   0,   32],
  [-72.5,  0,   12],
  [-81.5,  0,  -50],
  [ -38,   0,  -90],
  [27.5,   0,  -32],
  [  54,   0, -46.5],
  [  45,   0,  -79],
  [  54,   0,-104.5],
  [97.5,   0, -97.5],
  [97.5,   0,  -50],
  [  89,   0,  22.5],
  [ 112,   0,   70],
];

/** Landmark stations — a glowing clearing/platform anchored to a ROUTE point
    (by index), so a station always sits on the path and follows the point when
    the route is sculpted. radius = platform size. */
// point indices account for the prepended hero point at index 0.
export const STATIONS = [
  { point: 4, radius: 5.0 }, // self bust
  { point: 6, radius: 5.0 }, // Greco bust
  { point: 7, radius: 5.5 },
  { point: 8, radius: 5.5 },
  { point: 9, radius: 6.0 },
  { point: 10, radius: 5.5 },
  { point: 11, radius: 5.5 },
  { point: 12, radius: 5.5 },
] as const;

/** ASCII bead-road rendered along the ROUTE (the diorama's luminous path).
    `count` / `clearingPerStation` are capacities; `density` shows a fraction
    of them (live-tunable, so density can be raised without a rebuild). */
export const PATH = {
  count: { high: 2600, medium: 1800, low: 1100, reduced: 700 },
  width: 1.7, // lateral half-width of the bead scatter
  height: 0.9, // y above the ground
  pointSize: 5.5,
  flowSpeed: 2.4, // speed of the brightness pulse travelling along the road
  clearingPerStation: 420, // bead capacity for each landmark's platform
  density: 0.55, // 0..1 fraction of bead capacity shown by default
} as const;

/** Camera lens. The path (position + look-at curves) is derived from the route
    in scroll/journey.ts (hero arrival → a composed shot at each station). */
export const CAMERA = {
  fov: 42,
  near: 0.1,
  far: 800,
  /** Aspect the composition was framed for (landscape). Viewports narrower
      than this (portrait phones) can pull the camera back so the full scene
      still fits — but only where it helps (see per-shot weights in journey.ts). */
  designAspect: 1.6,
  /** Master multiplier over the PER-SHOT framing weights (journey.ts `framing`).
      The dolly-back at a node = (designAspect/aspect - 1) * portraitPullback *
      that node's weight. 1.0 = use the per-shot weights as authored; lower it to
      scale ALL portrait pull-back down at once. Desktop (wide) is never affected. */
  portraitPullback: 1.0,
} as const;

/** Hero typography: "IT" → "IKER TOLEDO" morphing point cloud. */
export const HERO = {
  initials: 'IT',
  /** Two lines; the canvas sampler honours the newline. */
  fullName: 'IKER\nTOLEDO',
  /** Font used to draw glyphs onto the sampling canvas (must be loaded first). */
  fontFamily: 'Newsreader',
  fontWeight: 600,
  /** ASCII density ramp (faint → dense); index 0 is blank so dark areas read empty. */
  glyphRamp: [' ', '·', '.', ':', '-', '=', '+', '*', 'x', '#', '%', '@'],
  /** Sampling grid cell (px on the 1100px-wide sample canvas) per tier — the
      ASCII resolution. Smaller = denser glyph grid. */
  gridCell: { high: 11, medium: 13, low: 16, reduced: 20 },
  /** Z-extrusion layers per tier — gives the wordmark real volume (not a plane). */
  extrudeLayers: { high: 7, medium: 6, low: 4, reduced: 3 },
  /** Extrusion depth (world units) for each wordmark. */
  initialsDepth: 2.0,
  nameDepth: 1.4,
  /** World transform of the wordmark (floats above the terrain). */
  position: [0, 8, -2] as Vec3,
  /** Target world height (units) of each rendered wordmark. */
  initialsHeight: 7.0,
  nameHeight: 5.2,
  /** Intra-layer z jitter so extrusion layers don't band. */
  depthJitter: 0.12,
  /** Gentle turntable sway (radians) so the depth is perceptible. */
  swayAmplitude: 0.22,
  /** Glyph sprite size (uSize) and size-attenuation scale (uScale) per tier. */
  pointSize: { high: 9.5, medium: 9.5, low: 9.0, reduced: 8.5 },
  sizeScale: 30,
} as const;

/** Landmark ASCII sculptures — one per station, anchored to the station's route
    point. Distinct procedural proxies for now; same shader will render
    Blender-authored sculptures in Phase 2. */
export const LANDMARK = {
  /** Surface-sample count per tier (per landmark). */
  count: { high: 7000, medium: 4500, low: 3000, reduced: 1800 },
  glyphSize: 5.5,
  sizeScale: 30,
  scatter: 2.5,
  scale: 2.2, // default model scale (tune per landmark in the GUI)
  /** View-driven assemble: a landmark resolves once it's in view + near, after a
      small delay, and dissolves back to a cloud after it passes out of view. */
  assembleDelay: 0.08, // seconds in view before it starts resolving
  assembleDistance: 50, // only resolve within this distance
  assembleSpeed: 5.5, // smoothing rate of the assemble/dissolve (higher = snappier)
} as const;

/** Tonal — the ECHO flagship creature (ported from EchoIsleV1.1). It replaces
    the glyph proxy at the Echo station: a floating, cursor-tracking soul made
    of a noise-deformed body, expressive eyes, 16500 sparkles + phosphor trails. */
export const TONAL = {
  station: 3, // Echo station index (the flagship slot)
  displayScale: 6, // magnify the ~1m creature to landmark size (was 8; −25%)
  hover: 4, // units above the route point the creature floats
  expression: 'neutral', // initial eye expression (one of the 12 presets)
  // Rendered in its own pass (Tonal.ts) with in-shader AgX matching the site.
  warmth: 0.85, // 0..1 palette warmth — pushes toward the site's amber/olive/cream
  translucency: 0.88, // body opacity (1 = solid, lower = slight see-through)
  exposure: 1.0, // brightness into the AgX grade
} as const;

/** Witzil (station 4) — blockchain donation transparency. A rising helix
    "chain of linked blocks": cube-clusters of glyphs spiralling up, strung by
    link-beads, with a brightness pulse climbing the chain (funds traced to
    their destination). Built as one glyph-point cloud (world/ChainNetwork.ts),
    reusing road.vert (flow along aT = height) + points.frag. */
export const CHAIN = {
  station: 4,
  blocks: 8, // number of ledger blocks up the helix
  edgePoints: 11, // glyph points per cube edge (12 edges → a dotted-wireframe block)
  blockSize: 1.9, // cube full-extent (world units)
  edgeJitter: 0.05, // tiny scatter so edges read as glyphs, not a hard line
  linkBeads: 18, // dense bead strand between consecutive blocks (the chain)
  linkJitter: 0.12,
  radius: 2.6, // helix radius
  height: 9.5, // total rise (world units)
  baseLift: 0.5, // lift the helix base off the ground
  turns: 1.75, // revolutions over the height
  pointSize: 8.0,
  flowSpeed: 0.4, // climbs/sec — one "transaction" travels up ~every 2.5s
  scale: 0.82, // overall size (down a bit)
  forward: 4, // world units moved toward the camera (closer)
} as const;

/** WHO I AM self-portrait (station 0). Iker's bust GLB (~35k verts) replaces
    the procedural proxy: loaded + normalized (world/modelGeometry.ts) then
    surface-sampled into the glyph cloud by LandmarkObject — no shader change.
    Higher sample count than other landmarks (it's the hero portrait; points
    are a single cheap draw call) for the best quality/perf ratio. */
export const BUST = {
  url: '/models/iker.glb',
  station: 0,
  targetSize: 3.2, // local normalization (geometry size before object scale)
  restOnGround: true, // base sits at the object origin (not sunk into the ground)
  // Object-level transform (live-tunable in the debug GUI → Landmarks → station 0).
  offset: [-4.5, 2.5, 1] as [number, number, number], // world offset from route point ROUTE[4]
  rotation: [0.02, -1.71, 0.02] as [number, number, number], // radians [x,y,z]
  scale: 2.5, // object scale (× targetSize = world size)
  glyphSize: 3.0, // small glyphs — finer, denser surface
  // Solid mode: backface-culled + depth-written + opaque cutout so the back/
  // interior never shows through the gaps. Low cut keeps glyphs dense.
  alphaCut: 0.2,
  // Subtle front-only full wireframe behind the glyphs to firm up the form.
  wireframe: true,
  wireOpacity: 0.1,
  // Surface-sample counts per tier — dense for a finely-detailed portrait.
  count: { high: 36000, medium: 24000, low: 15000, reduced: 8000 },
} as const;

/** Gradiente MX (station 5) — a confidential venture (under NDA). Alluded to as
    a "classified terminal": a brushed-glass MOSAIC of redacted ASCII tiles +
    an open/close reader OVERLAY, replicating the product's own UI (ui/
    GradienteMosaic.ts + gradiente.css). DOM, anchored to the station. */
export const GRADIENTE = {
  station: 5,
  anchorLift: 3, // world units above the route point (~the camera look-at → centred)
} as const;

/** Tomah (station 6) — AI video generation. An animated ASCII sculpture: a
    tumbling torus with a cube shuttling through its centre, hover repel + morph,
    and a generative frame-resolve flicker. Built in world/Tomah.ts
    (shaders/tomah.vert + points.frag). */
export const TOMAH = {
  station: 6,
  lift: 5, // world units above the route point (floats)
  scale: 1.0, // root scale
  torusRadius: 3.2,
  torusTube: 1.0,
  torusPoints: 4200,
  cubeSize: 2.0,
  cubePoints: 1900,
  pointSize: 5.5,
  spin: 0.4, // torus yaw speed
  tilt: 0.35, // torus tilt amplitude
  oscAmp: 4.6, // cube travel through the hole (± world units)
  oscSpeed: 0.9, // cube shuttle speed
  cubeSpin: 0.6, // cube self-rotation speed
  hoverRadius: 0.4, // NDC radius around the object that counts as "hover"
  repelRadius: 0.16, // per-point cursor repel radius (aspect-corrected, circular)
  repelStrength: 0.18, // repel push (NDC) — raise for a punchier shove
  morphAmt: 0.5, // hover morph turbulence (world units)
} as const;

/** Ambient ASCII scatter — a sparse field of slowly drifting glyphs that fades
    in around the cards (atmosphere during a composed beat). Reusable per beat;
    Phase-1 instance sits in the WHO I AM checkpoint. */
export const AMBIENT = {
  count: { high: 1400, medium: 900, low: 500, reduced: 280 },
  center: [-12, 8, -16] as Vec3,
  extent: [16, 9, 18] as Vec3, // half-extents of the drift volume
  pointSize: 5.0,
  drift: 1.3,
  maxOpacity: 0.45, // kept subtle
  revealStart: 0.56,
  revealEnd: 0.66,
  hideStart: 0.74,
  hideEnd: 0.82,
} as const;

/** Chapter contexts — how the world transforms at each station (by station index).
    `wave` blends the terrain into the wave-field (Systems). More fields (strata,
    ripples, flow, island, tint…) will join as we theme each chapter. */
export interface ChapterContext {
  wave: number; // terrain → flowing wave-field
  strata: number; // terrain → terraced sediment layers (Foundations)
  garden: number; // ASCII vegetation garden grows around the station (Systems)
  ripple: number; // audio-reactive sound ripples (Discos Movimiento)
}
export const CONTEXTS: ChapterContext[] = [
  { wave: 0, strata: 0, garden: 0, ripple: 0 }, // 0 Who I Am
  { wave: 0, strata: 1, garden: 0, ripple: 0 }, // 1 Foundations — strata layers
  { wave: 0, strata: 0, garden: 1, ripple: 0 }, // 2 Systems in Motion — ASCII garden
  { wave: 0, strata: 0, garden: 0, ripple: 0 }, // 3 Echo AI / Echo Island — flagship (WIP, build next)
  { wave: 0, strata: 0, garden: 0, ripple: 0 }, // 4 Witzil  (→ chain network later)
  { wave: 0, strata: 0, garden: 0, ripple: 0 }, // 5 Gradiente MX  (→ flow-field later)
  { wave: 0, strata: 0, garden: 0, ripple: 0 }, // 6 Tomah  (→ scanlines later)
  { wave: 0, strata: 0, garden: 0, ripple: 1 }, // 7 Discos Movimiento — audio-reactive ripples
];

/** Audio — tracks reproduced at the Discos Movimiento landmark; the analyser
    drives the environment (ground ripples to the bass, dots pulse to the beat).
    Drop files in public/audio/ and list them here. */
export const AUDIO = {
  // tracks shown in the Discos player card (MP3, transcoded from the WAV originals)
  tracks: [
    { name: 'Backlog', url: '/audio/backlog.mp3' },
    { name: 'Bed Thoughts', url: '/audio/bed-thoughts.mp3' },
    { name: 'Elle en Fiche', url: '/audio/elle-en-fiche.mp3' },
    { name: 'Henjin', url: '/audio/henjin.mp3' },
    { name: 'Rhodes & Butta', url: '/audio/rhodes-and-butta.mp3' },
    { name: 'What You Do to Me', url: '/audio/what-you-do-to-me.mp3' },
  ],
  fftSize: 512,
  smoothing: 0.8,
} as const;

/** ASCII grass garden around the Systems arch — instanced curved blades
    (jittered grid, per-blade height/bend/rotation/wind, t² tip-bend) rendered
    as columns of glyph particles (brighter toward the tip). */
export const GARDEN = {
  // pre-clumping plant target (clumping removes ~half → fewer, bigger plants)
  plantCount: { high: 1100, medium: 750, low: 450, reduced: 250 },
  regionRadius: 18, // garden ring around the station (encircles the arch)
  clearRadius: 3, // keep just the arch footprint clear
  heightScale: 1.0, // global height multiplier (tune in GUI)
  laneHalfWidth: 2.8, // clear a corridor for the path of steps
  pointSize: 3.8,
  windStrength: 1.0,
  windSpeed: 2.2,
} as const;

/** Glowing ASCII step-treads forming the path through the Systems arch. */
export const STEPS = {
  count: 28, // total treads
  back: 9, // treads behind the arch (foreground)
  depth: 1.3, // spacing along the path
  rise: 0.22, // height gained per step (path ascends through the arch)
  halfWidth: 1.7, // tread half-width (fits the arch gap)
  perTread: 22, // glyph points per tread
  pointSize: 4.5,
} as const;

/** Terrain shader default uniforms (live-tunable via lil-gui). */
export const TERRAIN_DEFAULTS = {
  uElevationScale: WORLD.elevationScale,
  uNoiseFrequency: 0.042,
  uNoiseOctaves: 4,
  uContourFrequency: 3.2, // fine, dense isolines (per world-height unit)
  uContourThickness: 0.005,
  uContourColor: PALETTE.glowWarm,
  uDotDensity: 8.95, // dots per world unit — dense beads strung along the lines
  uDotSize: 0.082,
  uDotIntensity: 2.5,
  uDotFlicker: 1.0,
  uDotBand: 2.0, // how tightly beads hug the isolines (× contour thickness)
  uDotColor: PALETTE.glowCore,
  uHazeColor: PALETTE.bg0,
  uHazeDensity: 0.0035,
  // wave-field morph (Systems chapter) — amount is context-driven at runtime
  uWaveAmp: 0.55,
  uWaveFreq: 0.13,
  uWaveSpeed: 0.6,
  // strata morph (Foundations chapter) — terrace height (world units)
  uStrataStep: 1.3,
  // audio-reactive ripples (Discos chapter) — rings emanate from the station
  uRippleFreq: 0.5,
  uRippleSpeed: 3.0,
  uRippleAmp: 1.6,
  /** Warm key light direction (top-right), matches ascii.js lightAt(). */
  lightDir: [0.6, 0.7, 0.35] as Vec3,
} as const;

/** Post-processing defaults (pmndrs/postprocessing). */
export const POST = {
  bloom: {
    intensity: 0.42,
    luminanceThreshold: 0.72,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
    radius: 0.7,
  },
  vignette: { offset: 0.28, darkness: 0.86 },
  noise: { opacity: 0.05 }, // film grain
  toneMappingExposure: 1.0,
} as const;

/** Scroll / ScrollSmoother behaviour. */
export const SCROLL = {
  /** Number of full-viewport spacer sections == scroll length. Longer = more
      scroll distance between checkpoints, so a hard flick is less likely to skip. */
  sections: 12,
  smooth: 1.4, // ScrollSmoother seconds of catch-up
  smoothTouch: 0.1,
  /** Snap feel: gentler/slower = less aggressive. */
  snapDuration: { min: 0.5, max: 1.3 },
  snapDelay: 0.12,
  /** Progress values the scroll snaps to (the composed/loved states):
      arrival · hero (IKER TOLEDO) · WHO I AM (cards expanded) ·
      bust forming (floating particles) · bust assembled. */
  snapPoints: [0, 0.34, 0.68, 0.86, 1.0],
} as const;

/**
 * Chapter scroll ranges over global progress (0..1). Phase-1 vertical slice:
 * Arrival → hero morph → terrain reveal → composed "who" card shot. Overlap
 * is intentional — segments cross-fade.
 */
export const CHAPTERS = {
  arrival: { start: 0.0, end: 0.28 },
  heroMorph: { start: 0.2, end: 0.46 },
  terrainReveal: { start: 0.08, end: 0.5 },
  who: { start: 0.66, end: 1.0 },
} as const;

export const SCENE = {
  /** Exponential fog — dense at arrival/contact, thin mid-journey. */
  fogColor: PALETTE.bg0,
  fogDensityNear: 0.055, // arrival
  fogDensityFar: 0.012, // open world
} as const;
