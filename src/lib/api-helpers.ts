import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as Sentry from "@sentry/nextjs";
import { authOptions } from "./auth";
import { loadFreshAuthUserById } from "./auth-state";
import { hasPermission } from "./permissions";
import type { UserRole } from "@/types";
import { ZodError } from "zod";
import logger from "./logger";
import { ApiRequestError, ApiValidationError } from "./request-errors";
import {
  captureSentryException,
  captureSlowRoute,
  startObservedServerSpan,
} from "./sentry-observability";

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
    const route = new URL(req.url).pathname;
    const method = req.method;
    const requestId = req.headers.get("x-request-id") ?? `req_${Date.now()}`;
    const startedAt = Date.now();

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

      Sentry.setUser({
        id: user.id,
        email: user.email || undefined,
      });
      Sentry.setTag("organizationId", user.organizationId ?? "unscoped");
      Sentry.setTag("requestId", requestId);
      Sentry.setTag("route", route);
      Sentry.setTag("method", method);
      if (perm) {
        Sentry.setTag("permission", perm);
      }

      const response = await startObservedServerSpan(`${method} ${route}`, "http.server", () =>
        Promise.resolve(handler(req, { user, params: context?.params })),
      );

      captureSlowRoute({
        route,
        method,
        durationMs: Date.now() - startedAt,
        userId: user.id,
        organizationId: user.organizationId,
        requestId,
      });

      return response;
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

      captureSentryException(error, {
        tags: {
          route,
          method,
          requestId,
          permission: perm,
        },
        extra: {
          query: Object.fromEntries(new URL(req.url).searchParams.entries()),
        },
        fingerprint: ["api-error", method, route],
      });

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
