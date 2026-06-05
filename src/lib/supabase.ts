import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set them in your build " +
      "environment (locally in .env.local, or in your host's build variables)."
  );
}

// Use placeholder values when unconfigured so createClient never throws at import
// time (which would blank the whole app). Calls fail gracefully and the UI shows
// a configuration banner instead.
export const supabase = createClient(
  url || "https://unconfigured.supabase.co",
  anonKey || "unconfigured-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

