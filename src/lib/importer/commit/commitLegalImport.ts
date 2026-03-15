import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/building-matching";
import { matchLegalCase, type LegalCaseRow, type TenantRecord } from "@/lib/legal-matching";
import { LegalStage } from "@prisma/client";
import type { CommitResult, CommitContext } from "./types";

const STAGE_MAP: Record<string, LegalStage> = {
  "notice sent": "NOTICE_SENT", "notice": "NOTICE_SENT",
  "holdover": "HOLDOVER",
  "nonpayment": "NONPAYMENT", "non-payment": "NONPAYMENT", "non payment": "NONPAYMENT",
  "court date": "COURT_DATE", "court": "COURT_DATE",
  "stipulation": "STIPULATION", "stip": "STIPULATION",
  "judgment": "JUDGMENT", "judgement": "JUDGMENT",
  "warrant": "WARRANT", "eviction": "EVICTION", "settled": "SETTLED",
};

function parseStage(value: string | undefined | null): LegalStage {
  if (!value) return "NONPAYMENT";
  return STAGE_MAP[value.toLowerCase().replace(/[_-]/g, " ").trim()] || "NONPAYMENT";
}

/**
 * Commit legal case import rows.
 * Uses confidence-based matching from legal-matching.ts.
 * Exact/likely matches are auto-imported; needs_review/no_match are queued.
 */
export async function commitLegalImport(
  rows: LegalCaseRow[],
  ctx: CommitContext,
): Promise<CommitResult & { queued: number }> {
  // Build lookup maps (scoped to org)
  const buildings = await prisma.building.findMany({
    where: ctx.organizationId ? { organizationId: ctx.organizationId } : {},
    select: { id: true, address: true, altAddress: true },
  });
  const addressToBuildingId = new Map<string, string>();
  for (const b of buildings) {
    addressToBuildingId.set(normalizeAddress(b.address), b.id);
    if (b.altAddress) addressToBuildingId.set(normalizeAddress(b.altAddress), b.id);
  }

  const buildingIds = buildings.map((b) => b.id);
  const dbTenants = await prisma.tenant.findMany({
    where: { unit: { buildingId: { in: buildingIds } } },
    select: {
      id: true, name: true, balance: true,
      unit: { select: { unitNumber: true, buildingId: true, building: { select: { address: true } } } },
    },
  });

  const tenantRecords: TenantRecord[] = dbTenants.map((t) => ({
    id: t.id, name: t.name, unitNumber: t.unit.unitNumber,
    buildingId: t.unit.buildingId, buildingAddress: t.unit.building.address,
    balance: Number(t.balance),
  }));

  const matchResults = rows
    .filter((r) => r.tenantName || r.address || r.unit)
    .map((r) => matchLegalCase(r, tenantRecords, addressToBuildingId));

  let imported = 0;
  let skipped = 0;
  let queued = 0;
  const errors: string[] = [];

  // Wrap all writes in a transaction
  await prisma.$transaction(async (tx) => {
    for (const match of matchResults) {
      const { row } = match;

      if ((match.matchType === "exact" || match.matchType === "likely") && match.tenant) {
        const stage = parseStage(row.legalStage);
        try {
          const existingActive = await tx.legalCase.findFirst({
            where: { tenantId: match.tenant.id, isActive: true },
          });

          let caseId: string;
          if (existingActive) {
            await tx.legalCase.update({
              where: { id: existingActive.id },
              data: {
                inLegal: true, stage,
                ...(row.caseNumber ? { caseNumber: row.caseNumber } : {}),
                ...(row.attorney ? { attorney: row.attorney } : {}),
                ...(row.filingDate ? { filedDate: row.filingDate } : {}),
                ...(row.courtDate ? { courtDate: row.courtDate } : {}),
                ...(row.arrearsBalance ? { arrearsBalance: row.arrearsBalance } : {}),
                ...(row.status ? { status: row.status } : {}),
                importBatchId: ctx.importBatchId,
              },
            });
            caseId = existingActive.id;
          } else {
            const created = await tx.legalCase.create({
              data: {
                tenantId: match.tenant.id, inLegal: true, stage,
                caseNumber: row.caseNumber || null, attorney: row.attorney || null,
                filedDate: row.filingDate, courtDate: row.courtDate,
                arrearsBalance: row.arrearsBalance || null,
                status: row.status || "active", importBatchId: ctx.importBatchId,
                isActive: true,
              },
            });
            caseId = created.id;
          }

          if (row.notes) {
            await tx.legalNote.create({
              data: { legalCaseId: caseId, authorId: ctx.userId, text: `[Import] ${row.notes}`, stage, isSystem: true },
            });
          }

          await tx.importRow.create({
            data: {
              importBatchId: ctx.importBatchId, rowIndex: row.rowIndex,
              rawData: row as any, status: match.matchType === "exact" ? "CREATED" : "UPDATED",
              entityType: "legal_case", entityId: match.tenant.id,
            },
          });
          imported++;
        } catch (e: any) {
          errors.push(`Row ${row.rowIndex + 2}: ${row.tenantName} — ${e.message}`);
          skipped++;
        }
      } else {
        try {
          await tx.legalImportQueue.create({
            data: {
              importBatchId: ctx.importBatchId, rowIndex: row.rowIndex,
              rawData: row as any, matchType: match.matchType,
              matchConfidence: match.confidence,
              candidateTenantId: match.tenant?.id || null,
              candidateTenantName: match.tenant?.name || null,
              candidateBuildingAddress: match.tenant?.buildingAddress || null,
              candidateUnitNumber: match.tenant?.unitNumber || null,
              sourceAddress: row.address || null, sourceUnit: row.unit || null,
              sourceTenantName: row.tenantName || null, sourceCaseNumber: row.caseNumber || null,
              status: "pending",
            },
          });
          queued++;
        } catch (e: any) {
          errors.push(`Row ${row.rowIndex + 2}: Failed to queue — ${e.message}`);
          skipped++;
        }
      }
    }
  }, { timeout: 120_000 });

  return { imported, skipped, queued, errors };
}
