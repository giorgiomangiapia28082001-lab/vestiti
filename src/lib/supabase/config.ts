// Le chiavi pubbliche di Supabase sono pensate per il browser: la
// sicurezza dei dati è garantita dalla Row Level Security nel database.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const STORAGE_BUCKET = "wardrobe";
