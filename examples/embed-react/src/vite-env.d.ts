/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOGRAH_API_URL: string;
  readonly VITE_DOGRAH_EMBED_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
