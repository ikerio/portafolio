import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

// vite-plugin-glsl lets us author shaders as separate .glsl/.vert/.frag files and
// compose them with `#include` directives (see src/shaders/lib/*). Imported as strings.
export default defineConfig({
  base: './',
  plugins: [
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      warnDuplicatedImports: true,
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
