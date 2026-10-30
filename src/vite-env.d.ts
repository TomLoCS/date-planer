/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Geoapify-API-Key – landet im Browser-Code, darum im Geoapify-Dashboard auf die eigenen Domains beschränken */
  readonly VITE_GEOAPIFY_KEY?: string;
}
