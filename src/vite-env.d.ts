/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MASTER_SUPABASE_URL?: string;
  readonly VITE_THIN_CLIENT_APP_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
