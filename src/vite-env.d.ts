/// <reference types="vite/client" />

// Shader modules imported as strings (resolved by vite-plugin-glsl).
declare module '*.glsl' {
  const value: string;
  export default value;
}
declare module '*.vert' {
  const value: string;
  export default value;
}
declare module '*.frag' {
  const value: string;
  export default value;
}
