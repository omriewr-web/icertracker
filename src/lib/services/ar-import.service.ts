import { prisma } from "@/lib/prisma";
import type { ParsedARRow } from "@/lib/parsers/ar-aging.parser";
import type { CollectionStatus } from "@prisma/client";
import { recalculateTenantBalance } from "./collections.service";

interface UnmatchedRow {
  propertyCode: string;
  unit: string;
  residentId: string;
  reason: string;
}

interface ImportResult {
  total: number;
  matched: number;
  unmatched: number;
  created: number;
  updated: number;
  unmatchedRows: UnmatchedRow[];
}

function deriveStatus(row: ParsedARRow): CollectionStatus {
  if (row.totalBalance <= 0) return "CURRENT";
  if (row.balance61_90 > 0 || row.balance90plus > 0) return "CHRONIC";
  if (row.balance31_60 > 0) return "DELINQUENT";
  if (row.balance0_30 > 0) return "LATE";
  return "CURRENT";
}

export async function importARAgingData(
  rows: ParsedARRow[],
  organizationId: string | null,
): Promise<ImportResult> {
  const result: ImportResult = {
    total: rows.length,
    matched: 0,
    unmatched: 0,
    created: 0,
    updated: 0,
    unmatchedRows: [],
  };

  // ── Pre-fetch buildings by yardiId (scoped to org) ──
  const propertyCodes = [...new Set(rows.map((r) => r.propertyCode))];
  const buildings = await prisma.building.findMany({
    where: { ...(organizationId ? { organizationId } : {}), yardiId: { in: propertyCodes } },
    select: { id: true, yardiId: true },
  });
  const buildingMap = new Map(buildings.map((b) => [b.yardiId, b.id]));

  // ── Pre-fetch tenants by yardiResidentId (scoped via org buildings) ──
  const buildingIds = [...buildingMap.values()];
  const residentIds = rows.map((r) => r.residentId);
  const tenantsByResId = await prisma.tenant.findMany({
    where: { yardiResidentId: { in: residentIds }, unit: { buildingId: { in: buildingIds } } },
    select: { id: true, yardiResidentId: true, unit: { select: { buildingId: true } } },
  });
  const tenantResMap = new Map(tenantsByResId.map((t) => [t.yardiResidentId!, t]));

  // ── Pre-fetch tenants by unit number + building for fallback matching ──
  const unitTenants = await prisma.tenant.findMany({
    where: { unit: { buildingId: { in: buildingIds } } },
    select: { id: true, unit: { select: { buildingId: true, unitNumber: true } } },
  });
  const unitTenantMap = new Map(
    unitTenants.map((t) => [`${t.unit.buildingId}:${t.unit.unitNumber}`, t.id])
  );

  // ── Process each row inside a transaction ──
  const matchedTenantIds = new Set<string>();
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const buildingId = buildingMap.get(row.propertyCode);
      if (!buildingId) {
        result.unmatched++;
        result.unmatchedRows.push({
          propertyCode: row.propertyCode,
          unit: row.unit,
          residentId: row.residentId,
          reason: `Building not found for property code "${row.propertyCode}"`,
        });
        continue;
      }

      // Try matching tenant by yardiResidentId first
      let tenantId: string | null = null;
      const byResId = tenantResMap.get(row.residentId);
      if (byResId) {
        tenantId = byResId.id;
      } else {
        // Fallback: match by buildingId + unit number
        tenantId = unitTenantMap.get(`${buildingId}:${row.unit}`) ?? null;
      }

      if (!tenantId) {
        result.unmatched++;
        result.unmatchedRows.push({
          propertyCode: row.propertyCode,
          unit: row.unit,
          residentId: row.residentId,
          reason: `Tenant not found (residentId="${row.residentId}", unit="${row.unit}")`,
        });
        continue;
      }

      result.matched++;
      matchedTenantIds.add(tenantId);

      const collectionStatus = deriveStatus(row);

      // Upsert directly — no need for separate findUnique check
      const snapshot = await tx.aRSnapshot.upsert({
        where: {
          tenantId_month: {
            tenantId,
            month: row.month,
          },
        },
        create: {
          tenantId,
          buildingId,
          month: row.month,
          balance0_30: row.balance0_30,
          balance31_60: row.balance31_60,
          balance61_90: row.balance61_90,
          balance90plus: row.balance90plus,
          totalBalance: row.totalBalance,
          collectionStatus,
          snapshotDate: new Date(),
        },
        update: {
          balance0_30: row.balance0_30,
          balance31_60: row.balance31_60,
          balance61_90: row.balance61_90,
          balance90plus: row.balance90plus,
          totalBalance: row.totalBalance,
          collectionStatus,
          snapshotDate: new Date(),
        },
      });

      // Track create vs update by checking if createdAt matches snapshotDate (just created)
      // Since upsert doesn't tell us which path it took, count all as updated for simplicity
      result.updated++;
    }
  }, { timeout: 120_000 });

  // Recalculate balances for all matched tenants after import
  for (const tenantId of matchedTenantIds) {
    try {
      await recalculateTenantBalance(tenantId);
    } catch {
      // Non-fatal: snapshot was saved, balance recalc can be retried
    }
  }

  return result;
}
