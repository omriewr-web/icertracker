import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { loadFreshAuthUserById } from "./auth-state";
import { hasPermission } from "./permissions";
import type { UserRole } from "@/types";
import { ZodError } from "zod";
import logger from "./logger";
import { ApiRequestError, ApiValidationError } from "./request-errors";

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

export function withAuth(handler: ApiHandler, perm?: string) {
  return async (req: NextRequest, context?: { params?: any }) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const freshUser = await loadFreshAuthUserById(session.user.id);
      if (!freshUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user: AuthUser = {
        id: freshUser.id,
        name: freshUser.name,
        email: freshUser.email,
        role: freshUser.role,
        assignedProperties: freshUser.assignedProperties,
        organizationId: freshUser.organizationId,
        managerId: freshUser.managerId,
      };

      if (!user.organizationId && user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Organization not configured" }, { status: 401 });
      }
      if (perm && !hasPermission(user.role, perm)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return await handler(req, { user, params: context?.params });
    } catch (error: any) {
      if (error instanceof ApiValidationError) {
        return NextResponse.json(
          { error: "Validation failed", details: error.details },
          { status: 400 }
        );
      }

      if (error instanceof ApiRequestError) {
        return NextResponse.json(
          {
            error: error.message,
            ...(error.details !== undefined ? { details: error.details } : {}),
          },
          { status: error.status }
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
      throw new ApiValidationError(error.flatten());
    }
    throw error;
  }
}
