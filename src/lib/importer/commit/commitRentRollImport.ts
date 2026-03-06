import { prisma } from "@/lib/prisma";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";
import { findMatchingBuilding, fetchBuildingsForMatching, generateYardiId, normalizeAddress, extractAddressFromEntity } from "@/lib/building-matching";
import type { CommitResult, CommitContext } from "./types";

interface ParsedTenantRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  parsed: {
    property: string;
    unit: string;
    unitType?: string;
    residentId?: string;
    name: string;
    marketRent: number;
    chargeCode?: string;
    chargeAmount: number;
    deposit: number;
    balance: number;
    moveIn?: string;
    leaseExpiration?: string;
    moveOut?: string;
    isVacant: boolean;
  };
  action: string;
  matchedTenantId?: string;
  matchedBuildingId?: string;
  error?: string;
}

/**
 * Commit rent roll / tenant list rows to DB.
 * Single source of truth — called by confirm/route.ts (direct mode) and staging/route.ts (approval).
 *
 * Tenant matching priority:
 *   1. yardiResidentId (exact)
 *   2. buildingId + unitNumber + name (case-insensitive)
 *   3. Log warning in ImportRow — do NOT silently overwrite by unitId
 */
export async function commitRentRollImport(
  rows: ParsedTenantRow[],
  ctx: CommitContext,
): Promise<CommitResult> {
  const existingBuildings = await fetchBuildingsForMatching();
  const buildingCache = new Map<string, string>();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (row.action === "skip") {
      errors.push(`Row ${row.rowIndex + 1}: ${row.error}`);
      skipped++;
      continue;
    }

    const t = row.parsed;
    try {
      // Resolve building
      const propKey = t.property || "Unknown";
      const yardiMatch = propKey.match(/\(([^)]+)\)\s*$/);
      const yardiCode = yardiMatch ? yardiMatch[1] : null;
      const extractedAddr = extractAddressFromEntity(propKey);
      const cacheKey = normalizeAddress(extractedAddr || propKey);
      let buildingId = buildingCache.get(cacheKey);

      if (!buildingId) {
        const match = findMatchingBuilding(
          { address: extractedAddr || propKey, block: null, lot: null, entity: propKey, yardiId: yardiCode },
          existingBuildings,
        );
        if (match) {
          buildingId = match.id;
        } else {
          const yardiId = generateYardiId(propKey);
          const building = await prisma.building.create({ data: { yardiId, address: propKey } });
          buildingId = building.id;
          existingBuildings.push({ id: buildingId, address: propKey, block: null, lot: null, entity: null, yardiId });
        }
        buildingCache.set(cacheKey, buildingId);
      }

      const unitRecord = await prisma.unit.upsert({
        where: { buildingId_unitNumber: { buildingId, unitNumber: t.unit } },
        create: { buildingId, unitNumber: t.unit, unitType: t.unitType, isVacant: t.isVacant },
        update: { unitType: t.unitType, isVacant: t.isVacant },
      });

      if (t.isVacant) {
        await prisma.vacancyInfo.upsert({
          where: { unitId: unitRecord.id },
          create: { unitId: unitRecord.id, proposedRent: t.marketRent },
          update: { proposedRent: t.marketRent },
        });
        await prisma.importRow.create({
          data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "UPDATED", entityType: "vacancy", entityId: unitRecord.id },
        });
        imported++;
        continue;
      }

      // Compute derived fields
      const leaseExp = t.leaseExpiration ? new Date(t.leaseExpiration) : null;
      const arrearsCategory = getArrearsCategory(t.balance, t.marketRent);
      const arrearsDays = getArrearsDays(t.balance, t.marketRent);
      const leaseStatus = getLeaseStatus(leaseExp);
      const monthsOwed = t.marketRent > 0 ? t.balance / t.marketRent : 0;
      const collectionScore = calcCollectionScore({
        balance: t.balance, marketRent: t.marketRent, arrearsDays, leaseStatus,
        legalFlag: false, legalRecommended: false, isVacant: false,
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
        arrearsCategory, arrearsDays, monthsOwed, leaseStatus, collectionScore,
      };

      let tenant;
      let rowAction: "CREATED" | "UPDATED" | "SKIPPED";

      // Tier 1: Match by yardiResidentId
      if (t.residentId) {
        const existing = await prisma.tenant.findUnique({ where: { yardiResidentId: t.residentId } });
        rowAction = existing ? "UPDATED" : "CREATED";
        tenant = await prisma.tenant.upsert({
          where: { yardiResidentId: t.residentId },
          create: { unitId: unitRecord.id, yardiResidentId: t.residentId, ...tenantData },
          update: tenantData,
        });
      } else {
        // Tier 2: Match by buildingId + unitNumber + name (case-insensitive)
        const existing = await prisma.tenant.findFirst({
          where: {
            unit: { buildingId, unitNumber: t.unit },
            name: { equals: t.name, mode: "insensitive" },
          },
        });

        if (existing) {
          rowAction = "UPDATED";
          tenant = await prisma.tenant.update({
            where: { id: existing.id },
            data: tenantData,
          });
        } else {
          // NO unitId-only fallback — log a warning instead
          // Check if a different tenant already occupies this unit
          const occupant = await prisma.tenant.findUnique({ where: { unitId: unitRecord.id } });
          if (occupant) {
            // Different person in same unit — log warning, skip overwrite
            const msg = `Row ${row.rowIndex + 1}: "${t.name}" does not match existing tenant "${occupant.name}" in unit ${t.unit}. Skipped to prevent overwrite.`;
            errors.push(msg);
            await prisma.importRow.create({
              data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "SKIPPED", entityType: "tenant", errors: [msg] },
            });
            skipped++;
            continue;
          }

          // Unit is empty — create new tenant
          rowAction = "CREATED";
          tenant = await prisma.tenant.create({
            data: { unitId: unitRecord.id, ...tenantData },
          });
        }
      }

      // Dual-write: Lease + BalanceSnapshot
      const normalizedLeaseStatus = leaseExp
        ? (leaseExp < new Date() ? "EXPIRED" : "ACTIVE")
        : "MONTH_TO_MONTH";
      const leaseId = `${tenant.id}-lease`;

      await prisma.lease.upsert({
        where: { id: leaseId },
        create: {
          id: leaseId, unitId: unitRecord.id, tenantId: tenant.id,
          leaseStart: t.moveIn ? new Date(t.moveIn) : null, leaseEnd: leaseExp,
          monthlyRent: t.marketRent, legalRent: 0, preferentialRent: 0,
          securityDeposit: t.deposit, status: normalizedLeaseStatus as any, isStabilized: false,
        },
        update: {
          leaseStart: t.moveIn ? new Date(t.moveIn) : null, leaseEnd: leaseExp,
          monthlyRent: t.marketRent, securityDeposit: t.deposit, status: normalizedLeaseStatus as any,
        },
      });

      await prisma.balanceSnapshot.create({
        data: {
          tenantId: tenant.id, leaseId, importBatchId: ctx.importBatchId,
          snapshotDate: new Date(),
          currentCharges: t.chargeAmount || t.marketRent,
          currentBalance: t.balance,
          pastDueBalance: t.balance > 0 ? t.balance : 0,
          arrearsStatus: arrearsCategory,
        },
      });

      await prisma.importRow.create({
        data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: rowAction, entityType: "tenant", entityId: tenant.id },
      });

      imported++;
    } catch (e: any) {
      errors.push(`${t.unit} ${t.name}: ${e.message}`);
      await prisma.importRow.create({
        data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "ERROR", entityType: "tenant", errors: [e.message] },
      }).catch(() => {});
      skipped++;
    }
  }

  return { imported, skipped, errors };
}
