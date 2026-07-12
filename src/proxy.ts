import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication ("/" is public — the shell shows
// auth privileges based on session state)
const PROTECTED_ROUTES = ["/profile", "/feed", "/devenir-organisateur"];
const ORGANIZER_ROUTES = ["/organizer"];
const LIVE_OPS_ROUTES = ["/live-ops"];
const ADMIN_ROUTES = ["/admin"];

// Routes that require authentication BUT don't redirect logged-in users away
const ONBOARDING_ROUTES = ["/get-started"];

// Public auth routes (redirect logged-in users to dashboard)
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/verify-email"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Firebase session cookie (set by client after login)
  const session = request.cookies.get("__session")?.value;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isOnboardingRoute = ONBOARDING_ROUTES.some((r) => pathname.startsWith(r));
  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isOrganizerRoute = ORGANIZER_ROUTES.some((r) => pathname.startsWith(r));
  const isLiveOpsRoute = LIVE_OPS_ROUTES.some((r) => pathname.startsWith(r));
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isProtected = isProtectedRoute || isOrganizerRoute || isLiveOpsRoute || isAdminRoute || isOnboardingRoute;

  // Not logged in → redirect to login for protected routes (including onboarding)
  if (!session && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in → redirect away from auth pages (but NOT onboarding)
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Note: Role-based route protection (e.g., only venue_owner can access /venue-owner)
  // is handled client-side in layouts because the proxy cannot read Firestore user profiles.
  // The proxy only does coarse "authenticated vs not" gating.

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except API, static files, and images
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
