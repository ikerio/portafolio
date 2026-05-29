# Iker Toledo — Immersive Portfolio / CV

A cinematic, scroll-driven Three.js experience: the visitor travels a camera along a
spline through a sculptural topographic world. **Phase 1** ships a polished vertical
slice — arrival fog → topographic terrain → an "IT → IKER TOLEDO" particle-morph hero
→ one anchored glass card — on a fully-wired scroll→camera rig, with a debug GUI, fps
monitor, and reduced-motion / no-WebGL fallbacks.

Built on the existing **Design Bible** (`DesignSystem/`): `tokens.css` is the canonical
visual system, and the 9-scene storyboard is the spec this engine realizes.

## Stack

Vite + TypeScript · Three.js (WebGLRenderer, raw GLSL) · GSAP + ScrollTrigger +
ScrollSmoother · pmndrs `postprocessing` (Bloom + Vignette + Noise + **AgX** tone
mapping) · `lil-gui` + `stats.js` (dev). Shaders authored as `.glsl/.vert/.frag` and
composed with `#include` via `vite-plugin-glsl`.

GSAP (incl. ScrollTrigger + ScrollSmoother) is free for any use since 2025 — no license
key required.

## Setup & run

```bash
npm install            # dependencies are already declared in package.json
npm run dev            # dev server at http://localhost:5173 (lil-gui + fps overlay)
npm run build          # type-check + production build → dist/
npm run preview        # serve the production build
npm run typecheck      # tsc --noEmit
```

Node 20.19+ / 22.12+ (developed on Node 24).

## How it works

- **One render loop.** `gsap.ticker` drives everything; no competing `requestAnimationFrame`.
- **Scroll → progress.** `ScrollController` (ScrollSmoother behind a fixed canvas) publishes
  a normalized `0..1` progress from a single scrubbed `ScrollTrigger`.
- **Director.** `SceneDirector` scrubs one paused master GSAP timeline (`scroll/chapters.ts`)
  that tweens a shared `DirectorState`, then pushes it to the camera rig + world each frame.
- **Camera.** `CameraRig` flies a `CatmullRomCurve3` (position) while looking along a second
  curve (target), sampled by arc length.
- **World.** `Terrain` (displacement + contour isolines + luminous dot field + path-valley,
  custom GLSL), `ParticleType` (canvas-sampled "IT"/"IKER TOLEDO" → morphing point cloud),
  `PathSpline` (glowing route).
- **UI.** `CardSystem` (DOM glass card projected from a 3D anchor, `--reveal`-scrubbed),
  `Chrome` (nav + section indicator + toggles), `CVFallback` (semantic CV, always in DOM).

All tunable values live in `src/core/config.ts`. Colors mirror `DesignSystem/styles/tokens.css`.

## Controls (dev)

- **lil-gui** (top-right): live-tune the terrain shader, bloom, camera idle, and a manual
  scroll-progress scrubber (`Journey → manual scrub` + `progress`) to inspect the journey
  without scrolling.
- **fps overlay** (bottom-left).
- **Reduce motion** toggle (chrome): calms the camera, lowers morph dispersion, opens the CV.

## Project structure

```
src/
  core/    config · math · events · tiers · assets
  render/  RendererManager · SceneManager · CameraRig · PostManager
  scroll/  ScrollController · SceneDirector · chapters
  world/   Terrain · ParticleType · PathSpline
  ui/      CardSystem · Chrome · CVFallback · cards.css
  shaders/ terrain.vert/frag · points.vert/frag · lib/{noise,light,contour}.glsl
  debug/   gui · stats
  App.ts · main.ts
```

## Storyboard

The chapter-by-chapter world spec (landmarks, topology transforms, shader
transitions, interactions, content slots) lives in [`docs/storyboard.md`](docs/storyboard.md).
It's the source of truth the engine implements.

## Roadmap (next phases)

- **Phase 2** — Blender authoring via `blender-mcp` (terrain mesh, spline, type, proxy
  models) → glTF (optimized with `gltf-transform`: meshopt for morph/anim, draco for
  static); real height/mask PNGs swapped into the terrain shader; `ModelPoints` for the
  ASCII bust and project models (`MeshSurfaceSampler`). `troika-three-text` is already
  installed for in-world 3D labels.
- **Phase 3** — the remaining storyboard chapters (Foundations, Systems, Made, Characters,
  Models, Trajectory, Contact) wired onto the spline with their cards.
- **Phase 4** — transition polish, sound, deeper mobile fallback, perf + accessibility pass,
  deploy.

## Accessibility

The full CV is always in the DOM (`#cv-fallback`), reachable by screen readers during the
experience and revealed as a readable document when WebGL is unavailable or the visitor
turns motion off. `prefers-reduced-motion` is respected at boot.
