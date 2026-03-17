import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { hasPermission, UserRole } from "@/types";
import { ZodError } from "zod";
import logger from "./logger";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedProperties: string[];
  organizationId: string | null;
  managerId: string | null;
}

type ApiHandler = (req: NextRequest, ctx: { user: AuthUser; params?: any }) => Promise<NextResponse | Response>;

/** Custom error class for validation failures — caught by withAuth to return 400 */
class ValidationError extends Error {
  status = 400;
  details: unknown;
  constructor(details: unknown) {
    super("Validation failed");
    this.details = details;
  }
}

export function withAuth(handler: ApiHandler, perm?: string) {
  return async (req: NextRequest, context?: { params?: any }) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user: AuthUser = {
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: session.user.role as UserRole,
        assignedProperties: session.user.assignedProperties ?? [],
        organizationId: session.user.organizationId || null,
        managerId: session.user.managerId ?? null,
      };
      if (!user.organizationId && user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Organization not configured" }, { status: 401 });
      }
      if (perm && !hasPermission(user.role, perm)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return await handler(req, { user, params: context?.params });
    } catch (error: any) {
      // Return 400 with field details for validation errors
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { error: "Validation failed", details: error.details },
          { status: 400 }
        );
      }
      const route = new URL(req.url).pathname;
      logger.error({ err: error, route }, "API error");
      // Only expose message for known API errors; hide internal details
      const isApiError = typeof error.status === "number" && error.status < 500;
      return NextResponse.json(
        { error: isApiError ? error.message : "Internal server error" },
        { status: error.status || 500 }
      );
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: { parse: (v: unknown) => T }): Promise<T> {
  const body = await req.json();
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(error.flatten());
    }
    throw error;
  }
}
