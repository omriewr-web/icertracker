import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { PermissionPreset, ModulePermissions } from "@/lib/permissions/types";
import { MODULES, LEVEL_RANK } from "@/lib/permissions/types";
import { PERMISSION_PRESETS, PRESET_DANGEROUS_DEFAULTS } from "@/lib/permissions/presets";
import { createGrantsFromPreset, getUserWithGrants } from "@/lib/permissions/engine";

export const dynamic = "force-dynamic";

const inviteSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  permissionPreset: z.enum([
    "property_manager", "ar_clerk", "leasing_agent", "building_super",
    "reporting_only", "owner_investor", "account_admin",
  ]),
  moduleOverrides: z.record(z.enum(["none", "view", "edit", "full"])).optional(),
  dangerousPrivileges: z.object({
    canExportSensitive: z.boolean().optional(),
    canDeleteRecords: z.boolean().optional(),
    canBulkUpdate: z.boolean().optional(),
    canManageUsers: z.boolean().optional(),
    canManageOrgSettings: z.boolean().optional(),
  }).optional(),
  scopeType: z.enum(["org", "portfolio", "building", "assigned"]).optional(),
  scopeId: z.string().optional(),
});

export const POST = withAuth(async (req, { user }) => {
  // Load invoking user's full permissions
  const invokingUser = await getUserWithGrants(user.id);
  if (!invokingUser?.canManageUsers) {
    return NextResponse.json({ error: "You do not have permission to invite users" }, { status: 403 });
  }

  const body = await parseBody(req, inviteSchema);
  const preset = body.permissionPreset as PermissionPreset;

  // Prevent granting more access than invoking user has
  if (body.moduleOverrides) {
    const invokingGrants = Object.fromEntries(
      invokingUser.accessGrants.map((g) => [g.module, g.level])
    );
    for (const [mod, level] of Object.entries(body.moduleOverrides)) {
      const invokingLevel = invokingGrants[mod] || "none";
      if (LEVEL_RANK[level as keyof typeof LEVEL_RANK] > LEVEL_RANK[invokingLevel as keyof typeof LEVEL_RANK]) {
        return NextResponse.json(
          { error: `Cannot grant ${level} on ${mod} — exceeds your own access level (${invokingLevel})` },
          { status: 403 },
        );
      }
    }
  }

  // Prevent granting dangerous privileges the invoker doesn't have
  if (body.dangerousPrivileges) {
    if (body.dangerousPrivileges.canManageUsers && !invokingUser.canManageUsers) {
      return NextResponse.json({ error: "Cannot grant user management — you don't have it" }, { status: 403 });
    }
    if (body.dangerousPrivileges.canManageOrgSettings && !invokingUser.canManageOrgSettings) {
      return NextResponse.json({ error: "Cannot grant org settings — you don't have it" }, { status: 403 });
    }
  }

  // Check email uniqueness
  const existing = await prisma.user.findFirst({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Generate temp password
  const tempPassword = crypto.randomBytes(4).toString("hex"); // 8 char hex
  const hash = await bcrypt.hash(tempPassword, 12);

  // Generate username from email
  const username = body.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  // Ensure uniqueness
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  const finalUsername = existingUsername ? `${username}${Date.now().toString(36).slice(-4)}` : username;

  const orgId = user.organizationId!;

  // Determine dangerous privileges
  const presetDefaults = PRESET_DANGEROUS_DEFAULTS[preset];
  const dangers = {
    canExportSensitive: body.dangerousPrivileges?.canExportSensitive ?? presetDefaults.canExportSensitive,
    canDeleteRecords: body.dangerousPrivileges?.canDeleteRecords ?? presetDefaults.canDeleteRecords,
    canBulkUpdate: body.dangerousPrivileges?.canBulkUpdate ?? presetDefaults.canBulkUpdate,
    canManageUsers: body.dangerousPrivileges?.canManageUsers ?? presetDefaults.canManageUsers,
    canManageOrgSettings: body.dangerousPrivileges?.canManageOrgSettings ?? presetDefaults.canManageOrgSettings,
  };

  // Map preset to legacy role for backwards compatibility
  const roleMap: Record<PermissionPreset, string> = {
    property_manager: "PM",
    ar_clerk: "COLLECTOR",
    leasing_agent: "LEASING_AGENT",
    building_super: "SUPER",
    reporting_only: "ACCOUNTING",
    owner_investor: "OWNER",
    account_admin: "ACCOUNT_ADMIN",
  };

  const newUser = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      username: finalUsername,
      passwordHash: hash,
      role: roleMap[preset] as any,
      organizationId: orgId,
      permissionPreset: preset,
      onboardingComplete: true,
      ...dangers,
    },
    select: { id: true, name: true, email: true, username: true, role: true, permissionPreset: true },
  });

  // Create access grants
  await createGrantsFromPreset(
    newUser.id,
    orgId,
    preset,
    body.moduleOverrides as Partial<ModulePermissions> | undefined,
  );

  // Audit log
  await prisma.permissionAuditLog.create({
    data: {
      orgId,
      changedBy: user.id,
      affectedUser: newUser.id,
      changeType: "USER_INVITED",
      newValue: { preset, dangers, overrides: body.moduleOverrides ?? null },
    },
  });

  return NextResponse.json({
    user: newUser,
    tempPassword,
    message: "User created. Share the temporary password securely.",
  }, { status: 201 });
});
