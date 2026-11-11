/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: Supabase project URL for global Daily stats, e.g. https://abc.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Optional: Supabase publishable (or legacy anon) key. Safe to expose in the browser. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
