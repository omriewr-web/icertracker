import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { userCreateSchema } from "@/lib/validations";
import { getOrgScope } from "@/lib/data-scope";
import { canCreateRole } from "@/lib/permissions";
import type { UserRole } from "@/types";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req, { user }) => {
  const orgScope = getOrgScope(user);

  const users = await prisma.user.findMany({
    where: { ...orgScope },
    select: {
      id: true, email: true, name: true, username: true, role: true,
      active: true, createdAt: true, organizationId: true, managerId: true,
      permissionPreset: true,
      canExportSensitive: true, canDeleteRecords: true, canBulkUpdate: true,
      canManageUsers: true, canManageOrgSettings: true,
      manager: { select: { id: true, name: true } },
      assignedProperties: { select: { buildingId: true, building: { select: { address: true } } } },
      accessGrants: { select: { module: true, level: true, scopeType: true, scopeId: true } },
    },
    orderBy: { name: "asc" },
  });

  // Add module count summary
  const mapped = users.map((u) => ({
    ...u,
    moduleCount: u.accessGrants.filter((g) => g.level !== "none").length,
  }));

  return NextResponse.json(mapped);
}, "users");

export const POST = withAuth(async (req, { user }) => {
  const data = await parseBody(req, userCreateSchema);

  // Enforce role creation permissions
  if (!canCreateRole(user.role as UserRole, data.role as UserRole)) {
    return NextResponse.json(
      { error: `Your role cannot create ${data.role} users` },
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

  const hash = await bcrypt.hash(data.password, 12);

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: data.email,
        name: data.name,
        username: data.username,
        passwordHash: hash,
        role: data.role as any,
        organizationId: user.organizationId,
        managerId: data.managerId || null,
      },
      select: { id: true, email: true, name: true, username: true, role: true, active: true },
    });

    // Assign buildings if provided
    if (data.buildingIds && data.buildingIds.length > 0) {
      await tx.userProperty.createMany({
        data: data.buildingIds.map((buildingId) => ({
          userId: newUser.id,
          buildingId,
        })),
        skipDuplicates: true,
      });
    }

    return newUser;
  });

  return NextResponse.json(result, { status: 201 });
}, "users");
