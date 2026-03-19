import { withAuth } from "next-auth/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// ── ODK Command Center — PIN-based auth, separate from NextAuth ──

function getJoseSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET || "");
}

async function handleODK(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;

  // Only handle /ODK/* and /api/command/* paths
  if (!pathname.startsWith("/ODK") && !pathname.startsWith("/api/command")) return null;

  // Login page and verify endpoint are always accessible (no cookie needed)
  if (pathname === "/ODK/login" || pathname === "/api/command/verify") {
    return NextResponse.next();
  }

  // All other /ODK and /api/command paths require valid odk-session cookie
  const token = req.cookies.get("odk-session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/ODK/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, getJoseSecret());
    if (payload.scope !== "odk") throw new Error("invalid scope");
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/ODK/login", req.url));
  }
}

// ── NextAuth middleware (for all non-ODK routes) ──

const nextAuthMiddleware = withAuth(
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

    // Users with no recognized role → redirect to dashboard
    if (token && !role) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return response;
  },
  { pages: { signIn: "/login" } },
);

// ── Combined middleware — ODK first, then NextAuth ──

export default async function middleware(req: NextRequest) {
  // ODK routes use PIN-based auth, not NextAuth
  const odkResult = await handleODK(req);
  if (odkResult) return odkResult;

  // Everything else goes through NextAuth middleware
  return (nextAuthMiddleware as any)(req, {} as any);
}

export const config = {
  matcher: [
    /*
     * Auth-excluded paths (all others require authentication):
     * - login, request, api/auth, api/health, api/work-orders/request — public
     * - ODK/login, api/command/verify — ODK login (handled by handleODK above)
     * - _next/static, _next/image, favicon.ico — static assets
     */
    "/((?!login|request|api/auth|api/health|api/work-orders/request|_next/static|_next/image|favicon.ico).*)",
  ],
};
