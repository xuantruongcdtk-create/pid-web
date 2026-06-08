import { createBrowserClient } from "@supabase/ssr";

/**
 * Placeholder URL used during prerender when NEXT_PUBLIC_SUPABASE_URL is
 * missing, empty, or malformed. `createBrowserClient` calls `new URL()`
 * eagerly which throws on empty string — that crashed the Vercel prerender.
 *
 * The placeholder must parse as a valid URL but never resolve to a real
 * Supabase instance. Any actual request will fail at request time (handled
 * by friendlyAuthError + UI error states), not at build time.
 */
const PLACEHOLDER_SUPABASE_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_ANON_KEY = "placeholder-anon-key";

/**
 * Normalize a Supabase URL/key env var: trim whitespace (a common copy-paste
 * accident), accept both new (`sb_publishable_…`, `sb_secret_…`) and legacy
 * (`eyJ…` JWT) key formats — the library handles both as long as we pass
 * them through unchanged.
 */
function cleanEnv(s: string | undefined): string {
  return (s ?? "").trim();
}

function validUrl(s: string | undefined): string {
  const v = cleanEnv(s);
  if (!v) return PLACEHOLDER_SUPABASE_URL;
  try {
    new URL(v);
    return v;
  } catch {
    return PLACEHOLDER_SUPABASE_URL;
  }
}

export const createClient = () =>
  createBrowserClient(
    validUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || PLACEHOLDER_ANON_KEY,
  );

/** True when both env vars are present + URL parses. UI uses this to show
 *  a configuration banner instead of silently failing on every call. */
export function isSupabaseConfigured(): boolean {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key) return false;
  try {
    const u = new URL(url);
    if (u.hostname === "placeholder.supabase.co") return false;
    return true;
  } catch {
    return false;
  }
}
