/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_REDIS_CACHE?: string;
  readonly VITE_REDIS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
