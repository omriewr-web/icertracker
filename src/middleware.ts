import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const response = NextResponse.next();
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
    response.headers.set("x-request-id", requestId);

    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Redirect users who haven't completed onboarding
    if (
      token &&
      !token.onboardingComplete &&
      !pathname.startsWith("/onboarding") &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/login")
    ) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    // Skip route-level role checks for API routes (handled by withAuth in route handlers)
    if (pathname.startsWith("/api/")) {
      return response;
    }

    const role = token?.role as string | undefined;

    // ── Role-based route protection ──
    // Uses existing role as proxy until grant-based middleware is wired.
    // OWNER: only owner dashboards + limited read-only operational pages
    if (role === "OWNER") {
      const OWNER_BLOCKED = ["/data", "/users", "/collections", "/alerts", "/settings"];
      const isBlocked = OWNER_BLOCKED.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (isBlocked) {
        return NextResponse.redirect(new URL("/owner-dashboard", req.url));
      }
    }

    // /settings/users requires admin-level role
    if (pathname.startsWith("/settings/users") || pathname === "/users") {
      const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"];
      if (role && !ADMIN_ROLES.includes(role)) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    // /owner-dashboard requires OWNER or admin role
    if (pathname.startsWith("/owner-dashboard") || pathname.startsWith("/owner/")) {
      const OWNER_ALLOWED = ["OWNER", "SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN", "PM"];
      if (role && !OWNER_ALLOWED.includes(role)) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    // Users with no recognized role and not admin → redirect to dashboard
    if (token && !role) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return response;
  },
  { pages: { signIn: "/login" } },
);

export const config = {
  matcher: [
    /*
     * Auth-excluded paths (all others require authentication):
     *
     * - login          → Login page (obviously public)
     * - request        → Tenant-facing work order request portal (public form
     *                    so tenants can submit maintenance requests without
     *                    an AtlasPM account; rate-limited in the API route)
     * - api/auth        → NextAuth endpoints (login/callback/session)
     * - api/work-orders/request → API backing the public tenant request portal
     *                    (rate-limited + honeypot-protected in the route handler)
     * - _next/static    → Next.js static assets
     * - _next/image     → Next.js image optimization
     * - favicon.ico     → Browser favicon
     */
    "/((?!login|request|api/auth|api/health|api/work-orders/request|_next/static|_next/image|favicon.ico).*)",
  ],
};
