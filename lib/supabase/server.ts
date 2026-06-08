import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Placeholder URL — see lib/supabase/client.ts for the full rationale.
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

export const createClient = () => {
  return createServerClient(
    validUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_ANON_KEY,
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies();
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet) {
          try {
            const cookieStore = await cookies();
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component. Middleware refreshes
            // sessions, so this is safe to ignore.
          }
        },
      },
    },
  );
};
