import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";
import { loadFreshAuthUserById } from "./auth-state";
import { hasPermission } from "./permissions";
import type { UserRole } from "@/types";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AuthError("Unauthorized", 401);
  }

  const freshUser = await loadFreshAuthUserById(session.user.id);
  if (!freshUser) {
    throw new AuthError("Unauthorized", 401);
  }

  return freshUser;
}

export async function requirePermission(perm: string) {
  const user = await requireAuth();
  if (!hasPermission(user.role as UserRole, perm)) {
    throw new AuthError("Forbidden", 403);
  }
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
