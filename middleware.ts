import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth middleware for PID.
 *
 * Route categories (URL paths — note dashboard lives at `/`, NOT `/dashboard`):
 *
 *   PROTECTED  — anything except the lists below. Require a Supabase user;
 *                otherwise → /login?next=<original>
 *
 *   AUTH-PAGES — /login, /register
 *                If user is already signed in → / (dashboard root)
 *
 *   PUBLIC     — /callback, /q/[shareCode], /payment/*, /api/*
 *                Pass through unchanged. (API routes enforce auth in their
 *                own handlers where needed.)
 *
 *   ONBOARDING — /onboarding requires a user but is its own segment; not
 *                redirected to /login (handled like any protected page).
 *
 *   STATIC     — _next/*, favicon, image extensions: excluded via the
 *                matcher config below so middleware never runs at all.
 */

const AUTH_PAGES = ["/login", "/register"];

const PUBLIC_PREFIXES = [
  "/callback", //  OAuth + magic-link return
  "/q/", //        public quiz share
  "/payment/", //  payment success/failed pages
  "/api/", //      API routes — enforce auth internally
];

function isPublicPath(pathname: string): boolean {
  if (AUTH_PAGES.includes(pathname)) return true; // auth pages are publicly viewable
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.includes(pathname);
}

/**
 * Clean an env var: trim whitespace, treat empty as undefined.
 * Mirrors the helper used in lib/supabase/{client,server}.ts.
 */
function envOrUndefined(value: string | undefined): string | undefined {
  const v = (value ?? "").trim();
  return v ? v : undefined;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ----- Dev escape hatch -------------------------------------------------
  // When Supabase isn't configured (local dev, preview without env vars),
  // skip auth entirely so pages remain inspectable.
  const supabaseUrl = envOrUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = envOrUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  // ----- Build Supabase server client w/ cookie passthrough ---------------
  // CRITICAL: the response we ultimately return must include any Set-Cookie
  // headers that Supabase wrote (session refresh). The pattern below is
  // straight from the @supabase/ssr docs for Next.js middleware.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: always call getUser() — it refreshes the JWT cookie. Don't
  // optimize by skipping this on public pages, or sessions go stale.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ----- Routing decisions -----------------------------------------------

  // 1. Already-signed-in user hits /login or /register → bounce to dashboard.
  if (user && isAuthPage(pathname)) {
    const next = request.nextUrl.searchParams.get("next");
    const target =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 2. Public path — no auth requirement; just refresh and pass through.
  if (isPublicPath(pathname)) {
    return response;
  }

  // 3. Protected path — require a user.
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Preserve where the user was trying to go so we can send them back
    // after sign-in (but never echo external URLs).
    const safeNext = `${pathname}${search}`;
    loginUrl.searchParams.set("next", safeNext);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

/**
 * Matcher — which requests run through the middleware.
 *
 * Excludes (so middleware never even loads for these):
 *   - _next/static, _next/image            → bundler assets
 *   - favicon.ico                          → root favicon
 *   - sitemap.xml / sitemap-*.xml          → next-sitemap output
 *   - robots.txt                           → next-sitemap output
 *   - *.png / *.jpg / *.jpeg / *.gif       → static image assets
 *   - *.webp / *.svg / *.ico               → static image assets
 *   - api/webhooks/*                       → provider webhook signatures
 *   - api/payment/webhook                  → MoMo / VNPAY IPN
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|sitemap-.*\\.xml|robots\\.txt|api/webhooks|api/payment/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
