import { createBrowserClient } from "@supabase/ssr";

/**
 * Placeholder URL used during prerender when NEXT_PUBLIC_SUPABASE_URL is
 * missing or empty. Supabase's createBrowserClient calls `new URL()` on the
 * URL eagerly, which throws on `""` — that crashed the Vercel prerender.
 *
 * The placeholder must parse as a valid URL but never resolves to a real
 * Supabase instance. Any actual request against this client will fail at
 * request time (handled gracefully by the UI's error states / mock
 * fallbacks), not at build time.
 */
const PLACEHOLDER_SUPABASE_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_ANON_KEY = "placeholder-anon-key";

function validUrl(s: string | undefined): string {
  if (!s || s.trim() === "") return PLACEHOLDER_SUPABASE_URL;
  try {
    // eslint-disable-next-line no-new
    new URL(s);
    return s;
  } catch {
    return PLACEHOLDER_SUPABASE_URL;
  }
}

export const createClient = () =>
  createBrowserClient(
    validUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_ANON_KEY,
  );
