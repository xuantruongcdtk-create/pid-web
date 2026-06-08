import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth + email-confirmation callback.
 *
 * Routes (in priority order):
 *   1. ?code missing                 → /login?error=no-code
 *   2. exchangeCodeForSession fails  → /login?error=auth-failed
 *   3. onboarding_completed = false  → /onboarding
 *   4. ?next param present + safe    → next
 *   5. default                       → /
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no-code", request.url));
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.session?.user) {
    console.warn("/callback exchange failed:", error?.message);
    return NextResponse.redirect(new URL("/login?error=auth-failed", request.url));
  }

  const userId = data.session.user.id;

  // Look up onboarding status. RLS allows the user to read their own profile.
  // If the profile row doesn't exist yet (handle_new_user trigger may not
  // have fired in some setups), treat as not-onboarded.
  let onboardingCompleted = false;
  let referralTeacherId: string | null = null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, referral_teacher_id")
      .eq("id", userId)
      .maybeSingle();
    onboardingCompleted = !!profile?.onboarding_completed;
    referralTeacherId = profile?.referral_teacher_id ?? null;
  } catch {
    /* best-effort — fall through to onboarding */
  }

  // OAuth path: persist a `ref` query param into profiles.referral_teacher_id
  // if it's present and not already set (teacher affiliate tracking).
  const refFromQuery = requestUrl.searchParams.get("ref");
  if (refFromQuery && !referralTeacherId) {
    void supabase
      .from("profiles")
      .update({ referral_teacher_id: refFromQuery })
      .eq("id", userId);
  }

  // Route by onboarding state. `next` only takes effect if onboarding is done.
  if (!onboardingCompleted) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Only honor `next` when it's a relative path on this origin (block open redirects).
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, request.url));
}
