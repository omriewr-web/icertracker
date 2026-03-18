/**
 * Seed permission grants for all existing users based on their role.
 *
 * Mapping:
 *   SUPER_ADMIN / ADMIN / ACCOUNT_ADMIN → account_admin preset
 *   PM / APM                            → property_manager preset
 *   OWNER                               → owner_investor preset
 *   COLLECTOR / ACCOUNTING              → ar_clerk preset
 *   LEASING_SPECIALIST / LEASING_AGENT / BROKER → leasing_agent preset
 *   SUPER                               → building_super preset
 *   All others                          → reporting_only preset
 *
 * Run: npx tsx scripts/seed-permissions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type PresetName =
  | "property_manager"
  | "ar_clerk"
  | "leasing_agent"
  | "building_super"
  | "reporting_only"
  | "owner_investor"
  | "account_admin";

const MODULES = [
  "collections", "operations", "leasing", "violations",
  "legal", "reporting", "owner_view", "admin",
] as const;

// Inline presets to avoid path alias issues in scripts
const PRESETS: Record<PresetName, Record<string, string>> = {
  property_manager: {
    collections: "edit", operations: "edit", leasing: "view",
    violations: "edit", legal: "view", reporting: "view",
    owner_view: "none", admin: "none",
  },
  ar_clerk: {
    collections: "full", operations: "none", leasing: "none",
    violations: "view", legal: "view", reporting: "edit",
    owner_view: "none", admin: "none",
  },
  leasing_agent: {
    collections: "none", operations: "view", leasing: "full",
    violations: "none", legal: "none", reporting: "view",
    owner_view: "none", admin: "none",
  },
  building_super: {
    collections: "none", operations: "edit", leasing: "none",
    violations: "view", legal: "none", reporting: "none",
    owner_view: "none", admin: "none",
  },
  reporting_only: {
    collections: "view", operations: "view", leasing: "view",
    violations: "view", legal: "view", reporting: "full",
    owner_view: "none", admin: "none",
  },
  owner_investor: {
    collections: "view", operations: "none", leasing: "view",
    violations: "view", legal: "view", reporting: "view",
    owner_view: "full", admin: "none",
  },
  account_admin: {
    collections: "full", operations: "full", leasing: "full",
    violations: "full", legal: "full", reporting: "full",
    owner_view: "full", admin: "full",
  },
};

const DANGEROUS_DEFAULTS: Record<PresetName, {
  canExportSensitive: boolean;
  canDeleteRecords: boolean;
  canBulkUpdate: boolean;
  canManageUsers: boolean;
  canManageOrgSettings: boolean;
}> = {
  property_manager: { canExportSensitive: false, canDeleteRecords: false, canBulkUpdate: false, canManageUsers: false, canManageOrgSettings: false },
  ar_clerk: { canExportSensitive: false, canDeleteRecords: false, canBulkUpdate: true, canManageUsers: false, canManageOrgSettings: false },
  leasing_agent: { canExportSensitive: false, canDeleteRecords: false, canBulkUpdate: false, canManageUsers: false, canManageOrgSettings: false },
  building_super: { canExportSensitive: false, canDeleteRecords: false, canBulkUpdate: false, canManageUsers: false, canManageOrgSettings: false },
  reporting_only: { canExportSensitive: false, canDeleteRecords: false, canBulkUpdate: false, canManageUsers: false, canManageOrgSettings: false },
  owner_investor: { canExportSensitive: false, canDeleteRecords: false, canBulkUpdate: false, canManageUsers: false, canManageOrgSettings: false },
  account_admin: { canExportSensitive: true, canDeleteRecords: true, canBulkUpdate: true, canManageUsers: true, canManageOrgSettings: true },
};

function roleToPreset(role: string): PresetName {
  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
    case "ACCOUNT_ADMIN":
      return "account_admin";
    case "PM":
    case "APM":
      return "property_manager";
    case "OWNER":
      return "owner_investor";
    case "COLLECTOR":
    case "ACCOUNTING":
      return "ar_clerk";
    case "LEASING_SPECIALIST":
    case "LEASING_AGENT":
    case "BROKER":
      return "leasing_agent";
    case "SUPER":
      return "building_super";
    default:
      return "reporting_only";
  }
}

async function main() {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, role: true, organizationId: true, name: true },
  });

  console.log(`Found ${users.length} active users.`);

  const counts: Record<string, number> = {};
  let skipped = 0;
  let seeded = 0;

  for (const user of users) {
    if (!user.organizationId) {
      console.log(`  SKIP ${user.name} (${user.role}) — no organizationId`);
      skipped++;
      continue;
    }

    const preset = roleToPreset(user.role);
    counts[preset] = (counts[preset] ?? 0) + 1;

    const perms = PRESETS[preset];
    const dangerous = DANGEROUS_DEFAULTS[preset];

    await prisma.$transaction([
      // Update user's preset and dangerous privilege flags
      prisma.user.update({
        where: { id: user.id },
        data: {
          permissionPreset: preset,
          ...dangerous,
        },
      }),
      // Upsert one grant per module
      ...MODULES.map((module) =>
        prisma.userAccessGrant.upsert({
          where: {
            userId_orgId_module_scopeType_scopeId: {
              userId: user.id,
              orgId: user.organizationId!,
              module,
              scopeType: "org",
              scopeId: user.organizationId!,
            },
          },
          create: {
            userId: user.id,
            orgId: user.organizationId!,
            module,
            level: perms[module],
            scopeType: "org",
            scopeId: user.organizationId!,
          },
          update: {
            level: perms[module],
          },
        })
      ),
    ]);

    seeded++;
  }

  console.log(`\nDone.`);
  console.log(`  Seeded: ${seeded}`);
  console.log(`  Skipped: ${skipped} (no org)`);
  console.log(`\nBy preset:`);
  for (const [preset, count] of Object.entries(counts).sort(([, a], [, b]) => b - a)) {
    console.log(`  ${preset}: ${count}`);
  }
}

main()
  .catch((e) => { console.error("Fatal:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
