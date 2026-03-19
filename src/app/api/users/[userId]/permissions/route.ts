import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { z } from "zod";
import type { PermissionPreset, ModulePermissions } from "@/lib/permissions/types";
import { MODULES, LEVEL_RANK } from "@/lib/permissions/types";
import { createGrantsFromPreset, getUserWithGrants } from "@/lib/permissions/engine";

export const dynamic = "force-dynamic";

const permissionUpdateSchema = z.object({
  permissionPreset: z.enum([
    "property_manager", "ar_clerk", "leasing_agent", "building_super",
    "reporting_only", "owner_investor", "account_admin",
  ]).optional(),
  moduleOverrides: z.record(z.enum(["none", "view", "edit", "full"])).optional(),
  dangerousPrivileges: z.object({
    canExportSensitive: z.boolean().optional(),
    canDeleteRecords: z.boolean().optional(),
    canBulkUpdate: z.boolean().optional(),
    canManageUsers: z.boolean().optional(),
    canManageOrgSettings: z.boolean().optional(),
  }).optional(),
});

export const PATCH = withAuth(async (req, { user, params }) => {
  const { userId } = await params;

  // Load invoking user's permissions
  const invokingUser = await getUserWithGrants(user.id);
  if (!invokingUser?.canManageUsers) {
    return NextResponse.json({ error: "You do not have permission to manage users" }, { status: 403 });
  }

  // Load target user
  const targetUser = await getUserWithGrants(userId);
  if (!targetUser || targetUser.organizationId !== user.organizationId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Cannot edit yourself via this route
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot change your own permissions via this route" }, { status: 403 });
  }

  const body = await parseBody(req, permissionUpdateSchema);
  const orgId = user.organizationId!;

  // Capture old state for audit log
  const oldState = {
    preset: targetUser.permissionPreset,
    grants: Object.fromEntries(targetUser.accessGrants.map((g) => [g.module, g.level])),
    dangerous: {
      canExportSensitive: targetUser.canExportSensitive,
      canDeleteRecords: targetUser.canDeleteRecords,
      canBulkUpdate: targetUser.canBulkUpdate,
      canManageUsers: targetUser.canManageUsers,
      canManageOrgSettings: targetUser.canManageOrgSettings,
    },
  };

  // Apply preset change if provided
  if (body.permissionPreset) {
    await createGrantsFromPreset(
      userId,
      orgId,
      body.permissionPreset as PermissionPreset,
      body.moduleOverrides as Partial<ModulePermissions> | undefined,
    );

    await prisma.user.update({
      where: { id: userId },
      data: { permissionPreset: body.permissionPreset },
    });
  } else if (body.moduleOverrides) {
    // Apply module overrides without changing preset
    await createGrantsFromPreset(
      userId,
      orgId,
      targetUser.permissionPreset as PermissionPreset,
      body.moduleOverrides as Partial<ModulePermissions> | undefined,
    );
  }

  // Apply dangerous privilege changes
  if (body.dangerousPrivileges) {
    const dangers: Record<string, boolean> = {};
    if (body.dangerousPrivileges.canExportSensitive !== undefined) {
      dangers.canExportSensitive = body.dangerousPrivileges.canExportSensitive;
    }
    if (body.dangerousPrivileges.canDeleteRecords !== undefined) {
      dangers.canDeleteRecords = body.dangerousPrivileges.canDeleteRecords;
    }
    if (body.dangerousPrivileges.canBulkUpdate !== undefined) {
      dangers.canBulkUpdate = body.dangerousPrivileges.canBulkUpdate;
    }
    if (body.dangerousPrivileges.canManageUsers !== undefined) {
      dangers.canManageUsers = body.dangerousPrivileges.canManageUsers;
    }
    if (body.dangerousPrivileges.canManageOrgSettings !== undefined) {
      dangers.canManageOrgSettings = body.dangerousPrivileges.canManageOrgSettings;
    }
    if (Object.keys(dangers).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: dangers });
    }
  }

  // Capture new state
  const newUser = await getUserWithGrants(userId);
  const newState = {
    preset: newUser?.permissionPreset,
    grants: Object.fromEntries((newUser?.accessGrants ?? []).map((g) => [g.module, g.level])),
    dangerous: {
      canExportSensitive: newUser?.canExportSensitive,
      canDeleteRecords: newUser?.canDeleteRecords,
      canBulkUpdate: newUser?.canBulkUpdate,
      canManageUsers: newUser?.canManageUsers,
      canManageOrgSettings: newUser?.canManageOrgSettings,
    },
  };

  // Audit log
  await prisma.permissionAuditLog.create({
    data: {
      orgId,
      changedBy: user.id,
      affectedUser: userId,
      changeType: "PERMISSIONS_UPDATED",
      oldValue: oldState,
      newValue: newState,
    },
  });

  return NextResponse.json({ success: true, user: newUser });
});

// GET audit history for a user
export const GET = withAuth(async (req, { user, params }) => {
  const { userId } = await params;

  const invokingUser = await getUserWithGrants(user.id);
  if (!invokingUser?.canManageUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.permissionAuditLog.findMany({
    where: { affectedUser: userId, orgId: user.organizationId! },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Enrich with user names
  const changerIds = [...new Set(logs.map((l) => l.changedBy))];
  const changers = await prisma.user.findMany({
    where: { id: { in: changerIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(changers.map((u) => [u.id, u.name]));

  const enriched = logs.map((l) => ({
    ...l,
    changedByName: nameMap[l.changedBy] ?? "Unknown",
  }));

  return NextResponse.json(enriched);
});
