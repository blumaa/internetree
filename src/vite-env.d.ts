/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — set it to use the shared remote tree; unset → local single-browser sim. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon (public) key — safe to ship in the client. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
