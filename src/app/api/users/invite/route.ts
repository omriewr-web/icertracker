import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api-helpers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { PermissionPreset, ModulePermissions } from "@/lib/permissions/types";
import { createGrantsFromPreset, getUserWithGrants } from "@/lib/permissions/engine";
import {
  PRESET_ROLE_MAP,
  assertCreatablePreset,
  assertGrantedDangerousPrivilegesWithinInvoker,
  assertGrantedModulesWithinInvoker,
  assertUserAdminAccess,
  buildDangerousPrivileges,
  buildPresetPermissions,
} from "@/lib/user-management";
import type { UserRole } from "@/types";

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
  assertUserAdminAccess((invokingUser?.role ?? user.role) as UserRole);
  if (!invokingUser?.canManageUsers) {
    return NextResponse.json({ error: "You do not have permission to invite users" }, { status: 403 });
  }

  const body = await parseBody(req, inviteSchema);
  const preset = body.permissionPreset as PermissionPreset;
  const invokingRole = invokingUser.role as UserRole;

  assertCreatablePreset(invokingRole, preset);

  const mergedPermissions = buildPresetPermissions(
    preset,
    body.moduleOverrides as Partial<ModulePermissions> | undefined
  );
  assertGrantedModulesWithinInvoker(invokingUser, mergedPermissions);

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Generate temp password
  const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 16); // 16 char, ~72 bits entropy
  const hash = await bcrypt.hash(tempPassword, 12);

  // Generate username from email
  const username = body.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
  // Ensure uniqueness
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  const finalUsername = existingUsername ? `${username}${Date.now().toString(36).slice(-4)}` : username;

  if (!user.organizationId) {
    return NextResponse.json({ error: "Organization context required" }, { status: 400 });
  }
  const orgId = user.organizationId;

  // Determine dangerous privileges
  const dangers = buildDangerousPrivileges(preset, body.dangerousPrivileges);
  assertGrantedDangerousPrivilegesWithinInvoker(invokingUser, dangers);

  const newUser = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      username: finalUsername,
      passwordHash: hash,
      role: PRESET_ROLE_MAP[preset] as any,
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
      newValue: { preset, dangers, overrides: body.moduleOverrides ?? null } as any,
    },
  });

  return NextResponse.json({
    user: newUser,
    tempPassword,
    message: "User created. Share the temporary password securely. User must change it on first login.",
  }, { status: 201 });
});
