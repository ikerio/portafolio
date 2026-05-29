/* =====================================================================
   withBase — prefix a public-asset path with Vite's configured base URL so
   runtime fetches (GLB models, audio) resolve correctly when the site is
   served from a subpath (e.g. GitHub Pages at /portafolio/). Bundled JS/CSS
   are rewritten by Vite automatically; only assets we fetch by string URL at
   runtime need this. Accepts '/models/x.glb' or 'models/x.glb'.
   ===================================================================== */

export function withBase(path: string): string {
  // import.meta.env.BASE_URL mirrors vite.config `base` (always ends in '/').
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
