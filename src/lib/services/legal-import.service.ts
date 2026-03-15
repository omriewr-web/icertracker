import { prisma } from "@/lib/prisma";
import type { ParsedLegalCaseRow } from "@/lib/parsers/legal-cases.parser";
import type { LegalStage } from "@prisma/client";

interface UnmatchedRow {
  address: string;
  unit: string;
  tenantName: string;
  caseNumber: string;
  reason: string;
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
  unmatchedRows: UnmatchedRow[];
}

function normalizeAddr(addr: string): string {
  return addr
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function importLegalCases(
  rows: ParsedLegalCaseRow[],
  organizationId: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    total: rows.length,
    imported: 0,
    skipped: 0,
    errors: [],
    unmatchedRows: [],
  };

  // Pre-fetch all buildings for address matching (scoped to org)
  const buildings = await prisma.building.findMany({
    where: { organizationId },
    select: { id: true, address: true },
  });

  // Build normalized address map
  const buildingByNormAddr = new Map<string, string>();
  for (const b of buildings) {
    buildingByNormAddr.set(normalizeAddr(b.address), b.id);
  }

  // Pre-fetch all tenants with unit info for matching (scoped via buildings)
  const buildingIds = buildings.map((b) => b.id);
  const tenants = await prisma.tenant.findMany({
    where: { unit: { buildingId: { in: buildingIds } } },
    select: {
      id: true,
      name: true,
      unit: { select: { buildingId: true, unitNumber: true } },
    },
  });

  // Wrap all writes in a transaction to prevent partial imports
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      // Match building by normalized address — try exact then partial
      const normAddr = normalizeAddr(row.address);
      let buildingId = buildingByNormAddr.get(normAddr);

      if (!buildingId) {
        // Partial match: check if any building address contains or is contained by the row address
        for (const [bNorm, bId] of buildingByNormAddr) {
          if (bNorm.includes(normAddr) || normAddr.includes(bNorm)) {
            buildingId = bId;
            break;
          }
        }
      }

      if (!buildingId) {
        result.skipped++;
        const reason = `No building match for address "${row.address}"`;
        result.errors.push(reason);
        result.unmatchedRows.push({
          address: row.address,
          unit: row.unit,
          tenantName: row.tenantName,
          caseNumber: row.caseNumber,
          reason,
        });
        continue;
      }

      // Match tenant by unit number within building
      const normUnit = row.unit.toLowerCase().trim();
      const matchedTenant = tenants.find(
        (t) =>
          t.unit.buildingId === buildingId &&
          t.unit.unitNumber.toLowerCase().trim() === normUnit
      );

      if (!matchedTenant) {
        result.skipped++;
        const reason = `No tenant match for unit "${row.unit}" in "${row.address}"`;
        result.errors.push(reason);
        result.unmatchedRows.push({
          address: row.address,
          unit: row.unit,
          tenantName: row.tenantName,
          caseNumber: row.caseNumber,
          reason,
        });
        continue;
      }

      // Find or create active legal case for tenant
      const existingActive = await tx.legalCase.findFirst({
        where: { tenantId: matchedTenant.id, isActive: true },
      });

      if (existingActive) {
        await tx.legalCase.update({
          where: { id: existingActive.id },
          data: {
            caseNumber: row.caseNumber,
            stage: row.stage as LegalStage,
            arrearsBalance: row.amountOwed,
            notes_text: row.statusNotes || null,
            isActive: row.stage !== "SETTLED",
            status: row.stage === "SETTLED" ? "settled" : "active",
          },
        });
      } else {
        await tx.legalCase.create({
          data: {
            tenantId: matchedTenant.id,
            buildingId,
            caseNumber: row.caseNumber,
            stage: row.stage as LegalStage,
            arrearsBalance: row.amountOwed,
            notes_text: row.statusNotes || null,
            isActive: row.stage !== "SETTLED",
            inLegal: true,
            status: row.stage === "SETTLED" ? "settled" : "active",
          },
        });
      }

      result.imported++;
    }
  }, { timeout: 120_000 });

  return result;
}
