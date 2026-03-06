import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parseRentRollExcel, type ParsedTenant } from "@/lib/excel-import";
import { parsedTenantRowSchema } from "@/lib/validations";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";
import { findMatchingBuilding, fetchBuildingsForMatching, generateYardiId, normalizeAddress, extractAddressFromEntity } from "@/lib/building-matching";
import * as XLSX from "xlsx";

// ── Mapped import: convert AI column mapping → ParsedTenant[] ──

interface ColumnMappingEntry {
  columnIndex: number;
  sourceHeader: string;
  mappedField: string | null;
  confidence: number;
}

function numVal(v: any): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "string" ? parseFloat(v.replace(/[$,]/g, "")) : Number(v);
  return isNaN(n) ? 0 : n;
}

function dateVal(v: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().split("T")[0];
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const parsed = new Date(v);
  return isNaN(parsed.getTime()) ? undefined : parsed.toISOString().split("T")[0];
}

function parseMappedRows(
  buffer: Buffer,
  mapping: ColumnMappingEntry[],
  dataStartRow: number,
): { tenants: ParsedTenant[]; propertyName: string; errors: string[]; format: string } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  // Build field → column index map
  const fieldMap: Record<string, number> = {};
  for (const m of mapping) {
    if (m.mappedField) fieldMap[m.mappedField] = m.columnIndex;
  }

  const get = (row: any[], field: string): any =>
    fieldMap[field] !== undefined ? row[fieldMap[field]] : undefined;

  const tenants: ParsedTenant[] = [];
  const errors: string[] = [];

  for (let i = dataStartRow - 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.every((v: any) => v === "" || v === null || v === undefined)) continue;

    const unit = String(get(r, "unit") ?? "").trim();
    const name = String(get(r, "full_name") ?? get(r, "last_name") ?? "").trim();
    if (!unit && !name) continue;
    if (!unit) {
      errors.push(`Row ${i + 1}: missing unit number`);
      continue;
    }

    const fullName = String(get(r, "full_name") ?? "").trim()
      || [String(get(r, "first_name") ?? "").trim(), String(get(r, "last_name") ?? "").trim()].filter(Boolean).join(" ");

    const isVacant = !fullName || fullName.toLowerCase().includes("vacant");

    tenants.push({
      property: String(get(r, "building_id") ?? "").trim(),
      unit,
      unitType: undefined,
      residentId: String(get(r, "tenant_code") ?? "").trim() || undefined,
      name: isVacant ? "VACANT" : fullName,
      marketRent: numVal(get(r, "market_rent") || get(r, "monthly_rent")),
      chargeCode: undefined,
      chargeAmount: numVal(get(r, "monthly_rent") || get(r, "market_rent")),
      charges: [],
      deposit: numVal(get(r, "security_deposit")),
      balance: numVal(get(r, "current_balance")),
      moveIn: dateVal(get(r, "move_in_date") || get(r, "lease_start_date")),
      leaseExpiration: dateVal(get(r, "lease_end_date")),
      moveOut: dateVal(get(r, "move_out_date")),
      isVacant,
    });
  }

  return { tenants, propertyName: "", errors, format: "ai-mapped" };
}

export const POST = withAuth(async (req, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  // Check for AI column mapping
  const columnMappingRaw = formData.get("columnMapping") as string | null;
  const dataStartRowRaw = formData.get("dataStartRow") as string | null;

  let result: { tenants: ParsedTenant[]; propertyName: string; errors: string[]; format: string };

  if (columnMappingRaw && dataStartRowRaw) {
    // ── AI-mapped import path ──
    const mapping: ColumnMappingEntry[] = JSON.parse(columnMappingRaw);
    const dataStartRow = parseInt(dataStartRowRaw, 10);
    result = parseMappedRows(buffer, mapping, dataStartRow);
  } else {
    // ── Legacy auto-detect parser path ──
    result = parseRentRollExcel(buffer);
  }

  const { tenants, propertyName, errors } = result;

  if (tenants.length === 0) {
    return NextResponse.json({ error: "No tenant records found", errors }, { status: 400 });
  }

  // Create import batch upfront so we can link ImportRows
  const importBatch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      format: result.format,
      recordCount: 0,
      status: "processing",
    },
  });

  let imported = 0;
  let skipped = 0;
  const buildingCache = new Map<string, string>();
  const existing = await fetchBuildingsForMatching();

  for (let rowIdx = 0; rowIdx < tenants.length; rowIdx++) {
    const raw = tenants[rowIdx];
    const parsed = parsedTenantRowSchema.safeParse(raw);
    if (!parsed.success) {
      const rowErrors = parsed.error.issues.map((i) => i.message);
      errors.push(`${raw.unit} ${raw.name}: validation failed – ${rowErrors.join(", ")}`);
      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: rowIdx,
          rawData: raw as any,
          status: "ERROR",
          entityType: "tenant",
          errors: rowErrors,
        },
      });
      skipped++;
      continue;
    }
    const t = parsed.data;
    try {
      const propKey = t.property || propertyName || "Unknown";
      // Extract Yardi code from parenthesized suffix: "Entity Name(code)" → "code"
      const yardiMatch = propKey.match(/\(([^)]+)\)\s*$/);
      const yardiCode = yardiMatch ? yardiMatch[1] : null;
      const extractedAddr = extractAddressFromEntity(propKey);
      const cacheKey = normalizeAddress(extractedAddr || propKey);
      let buildingId = buildingCache.get(cacheKey);

      if (!buildingId) {
        const match = findMatchingBuilding(
          { address: extractedAddr || propKey, block: null, lot: null, entity: propKey, yardiId: yardiCode },
          existing
        );
        if (match) {
          buildingId = match.id;
        } else {
          const yardiId = generateYardiId(propKey);
          const building = await prisma.building.create({
            data: { yardiId, address: propKey },
          });
          buildingId = building.id;
          existing.push({ id: buildingId, address: propKey, block: null, lot: null, entity: null, yardiId });
        }
        buildingCache.set(cacheKey, buildingId);
      }

      const unit = await prisma.unit.upsert({
        where: { buildingId_unitNumber: { buildingId, unitNumber: t.unit } },
        create: {
          buildingId,
          unitNumber: t.unit,
          unitType: t.unitType,
          isVacant: t.isVacant,
        },
        update: { unitType: t.unitType, isVacant: t.isVacant },
      });

      if (t.isVacant) {
        await prisma.vacancyInfo.upsert({
          where: { unitId: unit.id },
          create: { unitId: unit.id, proposedRent: t.marketRent },
          update: { proposedRent: t.marketRent },
        });
        await prisma.importRow.create({
          data: {
            importBatchId: importBatch.id,
            rowIndex: rowIdx,
            rawData: raw as any,
            status: "UPDATED",
            entityType: "vacancy",
            entityId: unit.id,
          },
        });
        imported++;
        continue;
      }

      const leaseExp = t.leaseExpiration ? new Date(t.leaseExpiration) : null;
      const arrearsCategory = getArrearsCategory(t.balance, t.marketRent);
      const arrearsDays = getArrearsDays(t.balance, t.marketRent);
      const leaseStatus = getLeaseStatus(leaseExp);
      const monthsOwed = t.marketRent > 0 ? t.balance / t.marketRent : 0;

      const collectionScore = calcCollectionScore({
        balance: t.balance,
        marketRent: t.marketRent,
        arrearsDays,
        leaseStatus,
        legalFlag: false,
        legalRecommended: false,
        isVacant: false,
      });

      const tenantData = {
        name: t.name,
        marketRent: t.marketRent,
        chargeCode: t.chargeCode,
        actualRent: t.chargeAmount || t.marketRent,
        deposit: t.deposit,
        balance: t.balance,
        moveInDate: t.moveIn ? new Date(t.moveIn) : null,
        leaseExpiration: leaseExp,
        moveOutDate: t.moveOut ? new Date(t.moveOut) : null,
        arrearsCategory,
        arrearsDays,
        monthsOwed,
        leaseStatus,
        collectionScore,
      };

      let tenant;
      let rowAction: "CREATED" | "UPDATED";
      if (t.residentId) {
        const existing = await prisma.tenant.findUnique({ where: { yardiResidentId: t.residentId } });
        rowAction = existing ? "UPDATED" : "CREATED";
        tenant = await prisma.tenant.upsert({
          where: { yardiResidentId: t.residentId },
          create: { unitId: unit.id, yardiResidentId: t.residentId, ...tenantData },
          update: tenantData,
        });
      } else {
        const existing = await prisma.tenant.findUnique({ where: { unitId: unit.id } });
        rowAction = existing ? "UPDATED" : "CREATED";
        tenant = await prisma.tenant.upsert({
          where: { unitId: unit.id },
          create: { unitId: unit.id, ...tenantData },
          update: tenantData,
        });
      }

      // ── Dual-write: Lease + BalanceSnapshot + RecurringCharges ──
      const normalizedLeaseStatus = leaseExp
        ? (leaseExp < new Date() ? "EXPIRED" : "ACTIVE")
        : "MONTH_TO_MONTH";

      const leaseId = `${tenant.id}-lease`;

      await prisma.lease.upsert({
        where: { id: leaseId },
        create: {
          id: leaseId,
          unitId: unit.id,
          tenantId: tenant.id,
          leaseStart: t.moveIn ? new Date(t.moveIn) : null,
          leaseEnd: leaseExp,
          monthlyRent: t.marketRent,
          legalRent: 0,
          preferentialRent: 0,
          securityDeposit: t.deposit,
          status: normalizedLeaseStatus as any,
          isStabilized: false,
        },
        update: {
          leaseStart: t.moveIn ? new Date(t.moveIn) : null,
          leaseEnd: leaseExp,
          monthlyRent: t.marketRent,
          securityDeposit: t.deposit,
          status: normalizedLeaseStatus as any,
        },
      });

      // Write individual charge rows as RecurringCharges
      const charges = (raw as any).charges ?? [];
      if (charges.length > 0) {
        // Deactivate old charges, replace with current import
        await prisma.recurringCharge.updateMany({
          where: { leaseId },
          data: { active: false },
        });
        for (const charge of charges) {
          if (charge.chargeCode && charge.amount !== 0) {
            await prisma.recurringCharge.create({
              data: {
                leaseId,
                chargeCode: charge.chargeCode,
                amount: charge.amount,
                active: true,
              },
            });
          }
        }
      }

      await prisma.balanceSnapshot.create({
        data: {
          tenantId: tenant.id,
          leaseId,
          importBatchId: importBatch.id,
          snapshotDate: new Date(),
          currentCharges: t.chargeAmount || t.marketRent,
          currentBalance: t.balance,
          pastDueBalance: t.balance > 0 ? t.balance : 0,
          arrearsStatus: arrearsCategory,
        },
      });

      // Track this row
      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: rowIdx,
          rawData: raw as any,
          status: rowAction,
          entityType: "tenant",
          entityId: tenant.id,
        },
      });

      imported++;
    } catch (e: any) {
      errors.push(`${t.unit} ${t.name}: ${e.message}`);
      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: rowIdx,
          rawData: raw as any,
          status: "ERROR",
          entityType: "tenant",
          errors: [e.message],
        },
      }).catch(() => {}); // don't fail the whole import if row tracking fails
      skipped++;
    }
  }

  // Update batch with final counts
  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      recordCount: imported,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  return NextResponse.json({
    imported, skipped, errors,
    total: tenants.length,
    format: result.format,
    batchId: importBatch.id,
  });
}, "upload");
