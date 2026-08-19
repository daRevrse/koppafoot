import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ============================================
// Edge gating — deliberately almost nothing.
//
// This used to bounce every signed-out visitor on a protected route to
// /login?redirect=..., before React ran. Signing in now happens in a dialog
// on the page itself (see AuthModal / AuthRequired), so that bounce threw
// away the address the visitor had asked for and lost whatever they were
// doing. The layouts ask for the account in place, and firestore.rules
// remains the thing that actually enforces access — this file never was a
// security boundary, only a UX one.
//
// Two redirects are left, and both are about pages that cannot show anything
// useful to the visitor in question.
// ============================================

/** An account exists but has no profile yet: /get-started is a form. */
const ONBOARDING_ROUTES = ["/get-started"];

/** Signed in already — the login and signup screens have nothing to offer. */
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/verify-email"];

/**
 * Addresses that moved. /devenir-organisateur was handed out in messages and
 * printed on posters before the organizer site existed — it has to keep
 * landing somewhere sensible.
 */
const MOVED: Record<string, string> = {
  "/devenir-organisateur": "/organisateurs",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const moved = MOVED[pathname];
  if (moved) return NextResponse.redirect(new URL(moved, request.url));

  // Session cookie, set by the client after login.
  const session = request.cookies.get("__session")?.value;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isOnboardingRoute = ONBOARDING_ROUTES.some((r) => pathname.startsWith(r));

  // No session on the onboarding form → there is no account to onboard.
  if (!session && isOnboardingRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in → away from the auth pages (but never from onboarding).
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Everything else keeps its address, signed in or not. A guest on a
  // protected page gets "Connexion requise" and the sign-in dialog over it;
  // once the account lands, the page below renders itself. Role checks
  // (organizer, live-ops, admin) stay client-side in the layouts, which can
  // read the Firestore profile — the edge cannot.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except API, static files, and images
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
