import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { hasPermission, UserRole } from "@/types";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedProperties: string[];
  organizationId: string;
}

type ApiHandler = (req: NextRequest, ctx: { user: AuthUser; params?: any }) => Promise<NextResponse>;

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
        organizationId: session.user.organizationId ?? "default",
      };
      if (perm && !hasPermission(user.role, perm)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return await handler(req, { user, params: context?.params });
    } catch (error: any) {
      console.error("API Error:", error);
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: error.status || 500 }
      );
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: { parse: (v: unknown) => T }): Promise<T> {
  const body = await req.json();
  return schema.parse(body);
}
