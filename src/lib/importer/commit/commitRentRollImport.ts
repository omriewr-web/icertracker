import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";
import { findMatchingBuilding, fetchBuildingsForMatching, normalizeAddress, extractAddressFromEntity } from "@/lib/building-matching";
import type { LeaseStatus } from "@prisma/client";
import type { CommitResult, CommitContext } from "./types";

const YARDI_CODE_RE = /^t\d{4,}$/i;

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
 * Building matching priority:
 *   1. yardiId (extracted from entity name parentheses, e.g. "993sum")
 *   2. Normalized address
 *   3. Entity name contains-match
 *   4. If no match → skip rows with warning (do NOT create Unknown building)
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
  const existingBuildings = await fetchBuildingsForMatching(ctx.organizationId);
  const buildingCache = new Map<string, string | null>();
  let imported = 0;
  let skipped = 0;
  let tenantsCreated = 0;
  const matchedBuildingIds = new Set<string>();
  const unmatchedCodes: string[] = [];
  const errors: string[] = [];

  // Wrap all writes in a transaction
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (row.action === "skip") {
        errors.push(`Row ${row.rowIndex + 1}: ${row.error}`);
        skipped++;
        continue;
      }

      const t = row.parsed;
      try {
        // ── Resolve building ──
        const propKey = t.property || "Unknown";
        const yardiMatch = propKey.match(/\(([^)]+)\)\s*$/);
        const yardiCode = yardiMatch ? yardiMatch[1] : null;
        const extractedAddr = extractAddressFromEntity(propKey);
        const cacheKey = yardiCode || normalizeAddress(extractedAddr || propKey);
        let buildingId = buildingCache.get(cacheKey);

        if (buildingId === undefined) {
          const match = findMatchingBuilding(
            { address: extractedAddr || propKey, block: null, lot: null, entity: propKey, yardiId: yardiCode },
            existingBuildings,
          );
          if (match) {
            buildingId = match.id;
            matchedBuildingIds.add(match.id);
            const matchedBuilding = existingBuildings.find((b) => b.id === match.id);
            logger.info(`Matched building [${matchedBuilding?.address}] via ${match.matchedBy} [${yardiCode || extractedAddr || propKey}]`);
          } else {
            buildingId = null;
            const code = yardiCode || extractedAddr || propKey;
            unmatchedCodes.push(code);
            logger.warn(`No building match for yardiId [${yardiCode}] extractedAddr [${extractedAddr}] entity [${propKey}]`);
          }
          buildingCache.set(cacheKey, buildingId);
        }

        // If no building match, skip these rows — don't create Unknown buildings
        if (!buildingId) {
          const msg = `Row ${row.rowIndex + 1}: No matching building for "${propKey}" — skipping.`;
          errors.push(msg);
          await tx.importRow.create({
            data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "SKIPPED", entityType: "tenant", errors: [msg] },
          }).catch(() => {});
          skipped++;
          continue;
        }

        // ── Upsert unit ──
        const unitRecord = await tx.unit.upsert({
          where: { buildingId_unitNumber: { buildingId, unitNumber: t.unit } },
          create: { buildingId, unitNumber: t.unit, unitType: t.unitType, isVacant: t.isVacant },
          update: { unitType: t.unitType, isVacant: t.isVacant },
        });

        if (t.isVacant) {
          await tx.vacancyInfo.upsert({
            where: { unitId: unitRecord.id },
            create: { unitId: unitRecord.id, proposedRent: t.marketRent },
            update: { proposedRent: t.marketRent },
          });
          await tx.importRow.create({
            data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "UPDATED", entityType: "vacancy", entityId: unitRecord.id },
          });
          imported++;
          continue;
        }

        // ── Guard: if name looks like a Yardi t-code, it's an ID not a name ──
        let tenantName = t.name;
        let residentId = t.residentId;
        if (YARDI_CODE_RE.test(tenantName)) {
          // Promote the t-code to residentId if we don't already have one
          if (!residentId) residentId = tenantName;
          tenantName = `[Needs Review] ${tenantName}`;
          logger.warn(`Row ${row.rowIndex + 1}: Name "${t.name}" looks like a Yardi code — marked for review`);
        }

        // ── Compute derived fields ──
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
          name: tenantName,
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
        if (residentId) {
          const existing = await tx.tenant.findUnique({ where: { yardiResidentId: residentId } });
          rowAction = existing ? "UPDATED" : "CREATED";
          tenant = await tx.tenant.upsert({
            where: { yardiResidentId: residentId },
            create: { unitId: unitRecord.id, yardiResidentId: residentId, ...tenantData },
            update: tenantData,
          });
        } else {
          // Tier 2: Match by buildingId + unitNumber + name (case-insensitive)
          const existing = await tx.tenant.findFirst({
            where: {
              unit: { buildingId, unitNumber: t.unit },
              name: { equals: tenantName, mode: "insensitive" },
            },
          });

          if (existing) {
            rowAction = "UPDATED";
            tenant = await tx.tenant.update({
              where: { id: existing.id },
              data: tenantData,
            });
          } else {
            // NO unitId-only fallback — log a warning instead
            const occupant = await tx.tenant.findUnique({ where: { unitId: unitRecord.id } });
            if (occupant) {
              const msg = `Row ${row.rowIndex + 1}: "${tenantName}" does not match existing tenant "${occupant.name}" in unit ${t.unit}. Skipped to prevent overwrite.`;
              errors.push(msg);
              await tx.importRow.create({
                data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "SKIPPED", entityType: "tenant", errors: [msg] },
              });
              skipped++;
              continue;
            }

            rowAction = "CREATED";
            tenant = await tx.tenant.create({
              data: { unitId: unitRecord.id, ...tenantData },
            });
          }
        }

        // ── Dual-write: Lease + BalanceSnapshot ──
        const normalizedLeaseStatus: LeaseStatus = leaseExp
          ? (leaseExp < new Date() ? "EXPIRED" : "ACTIVE")
          : "MONTH_TO_MONTH";
        const leaseId = `${tenant.id}-lease`;

        await tx.lease.upsert({
          where: { id: leaseId },
          create: {
            id: leaseId,
            organizationId: ctx.organizationId ?? null,
            buildingId,
            unitId: unitRecord.id,
            tenantId: tenant.id,
            isCurrent: true,
            leaseStart: t.moveIn ? new Date(t.moveIn) : null,
            leaseEnd: leaseExp,
            moveInDate: t.moveIn ? new Date(t.moveIn) : null,
            moveOutDate: t.moveOut ? new Date(t.moveOut) : null,
            monthlyRent: t.marketRent,
            legalRent: 0,
            preferentialRent: 0,
            securityDeposit: t.deposit,
            currentBalance: t.balance,
            chargeCode: t.chargeCode ?? null,
            status: normalizedLeaseStatus,
            isStabilized: false,
          },
          update: {
            organizationId: ctx.organizationId ?? null,
            buildingId,
            isCurrent: true,
            leaseStart: t.moveIn ? new Date(t.moveIn) : null,
            leaseEnd: leaseExp,
            moveInDate: t.moveIn ? new Date(t.moveIn) : null,
            moveOutDate: t.moveOut ? new Date(t.moveOut) : null,
            monthlyRent: t.marketRent,
            securityDeposit: t.deposit,
            currentBalance: t.balance,
            chargeCode: t.chargeCode ?? null,
            status: normalizedLeaseStatus,
          },
        });

        await tx.balanceSnapshot.create({
          data: {
            tenantId: tenant.id, leaseId, importBatchId: ctx.importBatchId,
            snapshotDate: new Date(),
            currentCharges: t.chargeAmount || t.marketRent,
            currentBalance: t.balance,
            pastDueBalance: t.balance > 0 ? t.balance : 0,
            arrearsStatus: arrearsCategory,
          },
        });

        await tx.importRow.create({
          data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: rowAction, entityType: "tenant", entityId: tenant.id },
        });

        if (rowAction === "CREATED") tenantsCreated++;
        imported++;
      } catch (e: any) {
        errors.push(`${t.unit} ${t.name}: ${e.message}`);
        await tx.importRow.create({
          data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "ERROR", entityType: "tenant", errors: [e.message] },
        }).catch(() => {});
        skipped++;
      }
    }
  }, { timeout: 120_000 });

  logger.info(`Import complete: ${imported} imported (${tenantsCreated} created), ${skipped} skipped, ${matchedBuildingIds.size} buildings matched, ${unmatchedCodes.length} unmatched codes: [${unmatchedCodes.join(", ")}]`);
  return { imported, skipped, errors, tenantsCreated, buildingsMatched: matchedBuildingIds.size, unmatchedCodes };
}
