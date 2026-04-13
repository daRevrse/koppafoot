import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/profile", "/teams", "/matches", "/feed", "/calendar", "/venues", "/invitations", "/referees", "/referee", "/participations", "/my-participations", "/pending-validations", "/player-invitations", "/recruitment"];
const VENUE_OWNER_ROUTES = ["/venue-owner"];
const ADMIN_ROUTES = ["/admin"];
const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/verify-email", "/get-started"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Firebase session cookie (set by client after login)
  const session = request.cookies.get("__session")?.value;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));
  const isProtectedRoute = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));
  const isVenueOwnerRoute = VENUE_OWNER_ROUTES.some((r) => pathname.startsWith(r));
  const isAdminRoute = ADMIN_ROUTES.some((r) => pathname.startsWith(r));
  const isProtected = isProtectedRoute || isVenueOwnerRoute || isAdminRoute;

  // Not logged in → redirect to login for protected routes
  if (!session && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in → redirect away from auth pages
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except API, static files, and images
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
  ],
};
