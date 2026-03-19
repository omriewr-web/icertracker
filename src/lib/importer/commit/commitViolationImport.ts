import { prisma } from "@/lib/prisma";
import { normalizeAddress, fetchBuildingsForMatching, findMatchingBuilding } from "@/lib/building-matching";
import { Prisma, ViolationSource } from "@prisma/client";
import type { CommitResult, CommitContext } from "./types";

interface ViolationRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  parsed: {
    buildingAddress: string;
    unitNumber?: string;
    source: string;
    externalId: string;
    description: string;
    violationClass?: string;
    severity?: string;
    issuedDate?: string;
    currentStatus?: string;
    penaltyAmount?: number;
    respondByDate?: string;
  };
}

const SOURCE_MAP: Record<string, ViolationSource> = {
  hpd: "HPD", dob: "DOB", ecb: "ECB", fdny: "FDNY", dsny: "DSNY",
  dohmh: "DOHMH", "dob complaints": "DOB_COMPLAINTS",
  "hpd complaints": "HPD_COMPLAINTS", "hpd litigation": "HPD_LITIGATION",
};

function parseSource(val: string): ViolationSource {
  return SOURCE_MAP[val.toLowerCase().trim()] ?? "HPD";
}

/**
 * Commit violation import rows.
 * Uses @@unique([source, externalId]) for dedup.
 */
export async function commitViolationImport(
  rows: ViolationRow[],
  ctx: CommitContext,
): Promise<CommitResult> {
  const existingBuildings = await fetchBuildingsForMatching(ctx.organizationId);
  const buildingCache = new Map<string, string>();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Wrap all writes in a transaction
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const v = row.parsed;
      try {
        if (!v.externalId || !v.source || !v.description) {
          errors.push(`Row ${row.rowIndex + 1}: Missing required fields (externalId, source, or description)`);
          skipped++;
          continue;
        }

        // Resolve building
        const cacheKey = normalizeAddress(v.buildingAddress);
        let buildingId = buildingCache.get(cacheKey);
        if (!buildingId) {
          const match = findMatchingBuilding(
            { address: v.buildingAddress, block: null, lot: null, entity: null, yardiId: null },
            existingBuildings,
          );
          if (match) {
            buildingId = match.id;
          } else {
            errors.push(`Row ${row.rowIndex + 1}: No matching building for "${v.buildingAddress}"`);
            await tx.importRow.create({
              data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as Prisma.InputJsonValue, status: "SKIPPED", entityType: "violation", errors: [`No matching building`] },
            });
            skipped++;
            continue;
          }
          buildingCache.set(cacheKey, buildingId);
        }

        // Resolve unit if provided
        let unitId: string | undefined;
        if (v.unitNumber) {
          const unit = await tx.unit.findUnique({
            where: { buildingId_unitNumber: { buildingId, unitNumber: v.unitNumber } },
          });
          unitId = unit?.id;
        }

        const source = parseSource(v.source);
        const violation = await tx.violation.upsert({
          where: { source_externalId: { source, externalId: v.externalId } },
          create: {
            buildingId, unitId, source, externalId: v.externalId,
            description: v.description,
            currentStatus: v.currentStatus,
            penaltyAmount: v.penaltyAmount ?? 0,
            issuedDate: v.issuedDate ? new Date(v.issuedDate) : null,
            respondByDate: v.respondByDate ? new Date(v.respondByDate) : null,
            isOpen: v.currentStatus ? !v.currentStatus.toLowerCase().includes("closed") : true,
            unitNumber: v.unitNumber,
          },
          update: {
            currentStatus: v.currentStatus,
            penaltyAmount: v.penaltyAmount ?? undefined,
            respondByDate: v.respondByDate ? new Date(v.respondByDate) : undefined,
            isOpen: v.currentStatus ? !v.currentStatus.toLowerCase().includes("closed") : undefined,
          },
        });

        await tx.importRow.create({
          data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as Prisma.InputJsonValue, status: "CREATED", entityType: "violation", entityId: violation.id },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${row.rowIndex + 1}: ${e.message}`);
        await tx.importRow.create({
          data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as Prisma.InputJsonValue, status: "ERROR", entityType: "violation", errors: [e.message] },
        }).catch(() => {});
        skipped++;
      }
    }
  }, { timeout: 120_000 });

  return { imported, skipped, errors };
}
