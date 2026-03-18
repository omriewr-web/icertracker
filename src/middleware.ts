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

    // OWNER role: block internal management pages — owners only see owner/* and read-only dashboards
    if (token?.role === "OWNER") {
      const OWNER_BLOCKED = ["/data", "/users", "/collections", "/alerts", "/settings"];
      const isBlocked = OWNER_BLOCKED.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (isBlocked) {
        return NextResponse.redirect(new URL("/owner-dashboard", req.url));
      }
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
