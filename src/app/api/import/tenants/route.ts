import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { routeParser } from "@/lib/parsers/router";
import { normalizeAddress } from "@/lib/building-matching";
import { getOrgScope } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "true";
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file instanceof File ? file.name : "upload.xlsx";
  const parsed = routeParser(buffer, fileName);

  if (!parsed.success || parsed.data.length === 0) {
    return NextResponse.json({ error: "Could not parse file", errors: parsed.errors }, { status: 400 });
  }

  const orgScope = getOrgScope(user);
  const orgId = user.organizationId;

  // Pre-load buildings + units for matching
  const buildings = await prisma.building.findMany({
    where: { ...orgScope },
    select: { id: true, address: true, units: { select: { id: true, unitNumber: true, tenant: { select: { id: true, name: true } } } } },
  });

  const buildingMap = new Map<string, typeof buildings[0]>();
  for (const b of buildings) {
    buildingMap.set(normalizeAddress(b.address), b);
  }

  let imported = 0, updated = 0, skipped = 0;
  const errors: { row: number; field: string; reason: string }[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, any>;
    const addr = normalizeAddress(row.buildingAddress || "");
    const building = buildingMap.get(addr);

    if (!building) {
      errors.push({ row: i + 1, field: "buildingAddress", reason: `Building not found: ${row.buildingAddress}` });
      skipped++;
      continue;
    }

    const unitNumber = String(row.unitNumber || "").trim();
    const unit = building.units.find((u) => u.unitNumber.toLowerCase() === unitNumber.toLowerCase());

    if (!unit) {
      errors.push({ row: i + 1, field: "unitNumber", reason: `Unit ${unitNumber} not found in ${row.buildingAddress}` });
      skipped++;
      continue;
    }

    const firstName = String(row.firstName || "").trim();
    const lastName = String(row.lastName || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();

    if (!fullName) {
      errors.push({ row: i + 1, field: "name", reason: "Tenant name is required" });
      skipped++;
      continue;
    }

    // Check for existing tenant on this unit
    const existingTenant = unit.tenant;

    if (dryRun) {
      if (existingTenant) updated++;
      else imported++;
      continue;
    }

    try {
      const tenantData = {
        name: fullName,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: row.email || undefined,
        phone: row.phone || undefined,
        actualRent: row.monthlyRent != null ? row.monthlyRent : undefined,
        deposit: row.securityDeposit != null ? row.securityDeposit : undefined,
        balance: row.balance != null ? row.balance : undefined,
        leaseExpiration: row.leaseEnd ? new Date(row.leaseEnd) : undefined,
        moveInDate: row.moveInDate ? new Date(row.moveInDate) : undefined,
      };

      if (existingTenant) {
        await prisma.tenant.update({
          where: { id: existingTenant.id },
          data: tenantData,
        });
        updated++;
      } else {
        await prisma.tenant.create({
          data: {
            unitId: unit.id,
            ...tenantData,
            name: fullName,
          },
        });
        imported++;
      }
    } catch (err: any) {
      errors.push({ row: i + 1, field: "row", reason: err.message?.slice(0, 200) || "Unknown error" });
      skipped++;
    }
  }

  const importLog = await prisma.importLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      importType: "TENANTS",
      fileName,
      fileSize: file.size,
      parserUsed: parsed.parserUsed,
      totalRows: parsed.data.length,
      rowsInserted: imported,
      rowsUpdated: updated,
      rowsSkipped: skipped,
      rowsFailed: errors.length,
      rowErrors: errors.length > 0 ? errors : undefined,
      warningsJson: warnings.length > 0 ? warnings : undefined,
      status: dryRun ? "DRY_RUN" : "COMPLETE",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ imported, updated, skipped, errors, warnings, importLogId: importLog.id, dryRun });
}, "upload");
