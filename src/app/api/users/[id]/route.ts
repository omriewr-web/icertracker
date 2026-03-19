import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { userUpdateSchema } from "@/lib/validations";
import { canCreateRole } from "@/lib/permissions";
import { assertManageExistingUser, assertUserAdminAccess } from "@/lib/user-management";
import type { UserRole } from "@/types";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export const PATCH = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  assertUserAdminAccess(user.role as UserRole);

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, organizationId: true },
  });

  // Verify target user belongs to same org (unless SUPER_ADMIN)
  if (user.role !== "SUPER_ADMIN") {
    if (!targetUser || targetUser.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (!targetUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  assertManageExistingUser(user.role as UserRole, targetUser.role as UserRole);

  const data = await parseBody(req, userUpdateSchema);

  if (targetUser.id === user.id && data.active === false) {
    return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 403 });
  }

  // If changing role, enforce permissions
  if (data.role && !canCreateRole(user.role as UserRole, data.role as UserRole)) {
    return NextResponse.json(
      { error: `Your role cannot assign the ${data.role} role` },
      { status: 403 },
    );
  }

  if (data.buildingIds && data.buildingIds.length > 0 && user.role !== "SUPER_ADMIN") {
    const buildings = await prisma.building.findMany({
      where: { id: { in: data.buildingIds } },
      select: { organizationId: true },
    });

    if (
      buildings.length !== data.buildingIds.length ||
      buildings.some((building) => building.organizationId !== user.organizationId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateData: any = { ...data };
    delete updateData.buildingIds;

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
      delete updateData.password;
    }

    const updated = await tx.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, name: true, username: true, role: true, active: true },
    });

    // Update building assignments if provided
    if (data.buildingIds !== undefined) {
      await tx.userProperty.deleteMany({ where: { userId: id } });
      if (data.buildingIds && data.buildingIds.length > 0) {
        await tx.userProperty.createMany({
          data: data.buildingIds.map((buildingId) => ({
            userId: id,
            buildingId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return updated;
  });

  return NextResponse.json(result);
}, "users");

export const DELETE = withAuth(async (req, { user, params }) => {
  const { id } = await params;
  assertUserAdminAccess(user.role as UserRole);

  if (id === user.id) {
    return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 403 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { role: true, organizationId: true },
  });

  // Verify target user belongs to same org (unless SUPER_ADMIN)
  if (user.role !== "SUPER_ADMIN") {
    if (!targetUser || targetUser.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (!targetUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  assertManageExistingUser(user.role as UserRole, targetUser.role as UserRole);

  await prisma.user.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}, "users");
