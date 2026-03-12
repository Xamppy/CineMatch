import { createBrowserClient } from "@supabase/ssr";

// Placeholder values used only during build-time static prerendering when
// NEXT_PUBLIC_* env vars are not yet available. The resulting client is
// never used for real network requests in that context.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
