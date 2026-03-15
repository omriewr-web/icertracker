import { prisma } from "@/lib/prisma";
import { normalizeAddress, fetchBuildingsForMatching, findMatchingBuilding } from "@/lib/building-matching";
import type { CommitResult, CommitContext } from "./types";

interface VacancyRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  parsed: {
    buildingAddress: string;
    unitNumber: string;
    stage?: string;
    askingRent?: number;
    listedDate?: string;
    notes?: string;
  };
}

/**
 * Commit vacancy pipeline import rows.
 * One active vacancy per buildingId+unitId — upserts by matching.
 */
export async function commitVacancyImport(
  rows: VacancyRow[],
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
        if (!v.buildingAddress || !v.unitNumber) {
          errors.push(`Row ${row.rowIndex + 1}: Missing building address or unit number`);
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
              data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "SKIPPED", entityType: "vacancy", errors: [`No matching building`] },
            });
            skipped++;
            continue;
          }
          buildingCache.set(cacheKey, buildingId);
        }

        // Resolve unit
        const unit = await tx.unit.upsert({
          where: { buildingId_unitNumber: { buildingId, unitNumber: v.unitNumber } },
          create: { buildingId, unitNumber: v.unitNumber, isVacant: true },
          update: { isVacant: true },
        });

        // Find or create active vacancy for this unit
        const existing = await tx.vacancy.findFirst({
          where: { buildingId, unitId: unit.id, isActive: true },
        });

        const stage = v.stage?.toLowerCase().replace(/[\s-]/g, "_") || "vacant";
        const vacancyData = {
          stage,
          askingRent: v.askingRent ?? null,
          listedDate: v.listedDate ? new Date(v.listedDate) : null,
          notes: v.notes ?? null,
        };

        let vacancy;
        if (existing) {
          vacancy = await tx.vacancy.update({
            where: { id: existing.id },
            data: vacancyData,
          });
        } else {
          vacancy = await tx.vacancy.create({
            data: { buildingId, unitId: unit.id, isActive: true, ...vacancyData },
          });
        }

        await tx.importRow.create({
          data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: existing ? "UPDATED" : "CREATED", entityType: "vacancy", entityId: vacancy.id },
        });
        imported++;
      } catch (e: any) {
        errors.push(`Row ${row.rowIndex + 1}: ${e.message}`);
        await tx.importRow.create({
          data: { importBatchId: ctx.importBatchId, rowIndex: row.rowIndex, rawData: row.raw as any, status: "ERROR", entityType: "vacancy", errors: [e.message] },
        }).catch(() => {});
        skipped++;
      }
    }
  }, { timeout: 120_000 });

  return { imported, skipped, errors };
}
