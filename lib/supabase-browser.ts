import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL is not defined. Check your .env.local file.");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined. Check your .env.local file.");
}

// Singleton browser client — import { supabase } from "@/lib/supabase-browser" everywhere.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Named factory kept for components that need a fresh client (e.g. auth state listeners).
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
