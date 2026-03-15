import { prisma } from "@/lib/prisma";
import type { ParsedRentRollRow, ParsedVacantRow } from "@/lib/parsers/rent-roll.parser";
import { findMatchingBuilding, fetchBuildingsForMatching, extractAddressFromEntity, generatePropertyId } from "@/lib/building-matching";

interface UnmatchedRow {
  propertyCode: string;
  unit: string;
  residentId: string;
  tenantName: string;
  reason: string;
}

interface UnmatchedSection {
  code: string;
  entity: string;
  rowCount: number;
}

interface ImportResult {
  total: number;
  matched: number;
  unmatched: number;
  updated: number;
  unmatchedRows: UnmatchedRow[];
  buildingsMatched: number;
  unmatchedCodes: string[];
  unmatchedSections: UnmatchedSection[];
  tenantsCreated: number;
  vacanciesCreated: number;
}

export async function importRentRollData(
  rows: ParsedRentRollRow[],
  vacantRows: ParsedVacantRow[] = [],
  organizationId?: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    total: rows.length + vacantRows.length,
    matched: 0,
    unmatched: 0,
    updated: 0,
    unmatchedRows: [],
    buildingsMatched: 0,
    unmatchedCodes: [],
    unmatchedSections: [],
    tenantsCreated: 0,
    vacanciesCreated: 0,
  };

  // ── Build a building map using multi-strategy matching (scoped to org) ──
  const existingBuildings = await fetchBuildingsForMatching(organizationId);
  const buildingMap = new Map<string, string | null>();

  // Group rows by propertyCode to resolve each code once
  const codeEntityMap = new Map<string, string>();
  for (const r of [...rows, ...vacantRows]) {
    if (r.propertyCode && !codeEntityMap.has(r.propertyCode)) {
      codeEntityMap.set(r.propertyCode, r.propertyEntity || "");
    }
  }

  // Count rows per code for unmatchedSections reporting
  const codeRowCounts = new Map<string, number>();
  for (const r of [...rows, ...vacantRows]) {
    if (r.propertyCode) {
      codeRowCounts.set(r.propertyCode, (codeRowCounts.get(r.propertyCode) || 0) + 1);
    }
  }

  for (const [code, entity] of codeEntityMap) {
    const extractedAddr = extractAddressFromEntity(entity);
    const match = findMatchingBuilding(
      { address: extractedAddr || entity, block: null, lot: null, entity, yardiId: code },
      existingBuildings,
    );
    if (match) {
      buildingMap.set(code.toLowerCase().trim(), match.id);
      console.log(`[rent-roll] Matched building code "${code}" via ${match.matchedBy}`);

      // Always upsert entity name on building from rent roll section
      if (entity) {
        await prisma.building.update({
          where: { id: match.id },
          data: { entity },
        }).catch(() => {});
      }

      // Auto-generate propertyId for buildings that don't have one yet
      const building = existingBuildings.find(b => b.id === match.id);
      if (building && !building.propertyId) {
        const propId = generatePropertyId(building.address);
        // Check uniqueness
        const existing = await prisma.building.findUnique({ where: { propertyId: propId } });
        if (!existing) {
          await prisma.building.update({
            where: { id: match.id },
            data: { propertyId: propId },
          }).catch(() => {});
          console.log(`[rent-roll] Auto-generated propertyId "${propId}" for building ${building.address}`);
        } else {
          // Try with suffix
          for (let suffix = 2; suffix <= 10; suffix++) {
            const candidate = `${propId}-${suffix}`;
            const dup = await prisma.building.findUnique({ where: { propertyId: candidate } });
            if (!dup) {
              await prisma.building.update({
                where: { id: match.id },
                data: { propertyId: candidate },
              }).catch(() => {});
              console.log(`[rent-roll] Auto-generated propertyId "${candidate}" for building ${building.address}`);
              break;
            }
          }
        }
      }
    } else {
      buildingMap.set(code.toLowerCase().trim(), null);
      result.unmatchedCodes.push(code);
      result.unmatchedSections.push({
        code,
        entity,
        rowCount: codeRowCounts.get(code) || 0,
      });
      console.log(`[rent-roll] WARNING: No match for code "${code}" entity "${entity}" extractedAddr "${extractedAddr}"`);
    }
  }

  result.buildingsMatched = [...new Set([...buildingMap.values()].filter(Boolean))].length;

  // ── Pre-fetch all tenants by yardiResidentId for fast lookup ──
  const residentIds = rows.map((r) => r.residentId).filter(Boolean);
  const existingTenants = await prisma.tenant.findMany({
    where: { yardiResidentId: { in: residentIds } },
    select: {
      id: true,
      unitId: true,
      yardiResidentId: true,
      name: true,
      balance: true,
      marketRent: true,
      moveInDate: true,
      leaseExpiration: true,
      moveOutDate: true,
    },
  });
  const tenantByResId = new Map(
    existingTenants.map((t) => [t.yardiResidentId!, t])
  );

  // ── Process all rows inside a transaction ──
  await prisma.$transaction(async (tx) => {
    // ── Process each occupied row ──
    for (const row of rows) {
      const buildingId = buildingMap.get(row.propertyCode.toLowerCase().trim());
      if (!buildingId) {
        result.unmatched++;
        result.unmatchedRows.push({
          propertyCode: row.propertyCode,
          unit: row.unit,
          residentId: row.residentId,
          tenantName: row.tenantName,
          reason: `Building not found for code "${row.propertyCode}"`,
        });
        continue;
      }

      // Upsert unit
      const unitRecord = await tx.unit.upsert({
        where: { buildingId_unitNumber: { buildingId, unitNumber: row.unit } },
        create: { buildingId, unitNumber: row.unit, unitType: row.unitType || null, unitCategory: row.unitCategory, isResidential: row.isResidential },
        update: { unitType: row.unitType || undefined, unitCategory: row.unitCategory, isResidential: row.isResidential },
      });
      const unitId = unitRecord.id;

      // Match tenant: by yardiResidentId first, then by unit+name
      let tenant = tenantByResId.get(row.residentId);
      if (!tenant) {
        const byUnit = await tx.tenant.findFirst({
          where: {
            unitId,
            name: { equals: row.tenantName, mode: "insensitive" },
          },
          select: {
            id: true, unitId: true, yardiResidentId: true, name: true,
            balance: true, marketRent: true, moveInDate: true,
            leaseExpiration: true, moveOutDate: true,
          },
        });
        if (byUnit) tenant = byUnit;
      }

      result.matched++;

      let tenantId: string;

      if (tenant) {
        // Update existing tenant
        const tenantUpdate: Record<string, any> = {};
        if (row.tenantName && row.tenantName !== tenant.name) tenantUpdate.name = row.tenantName;
        if (row.currentBalance !== Number(tenant.balance)) tenantUpdate.balance = row.currentBalance;
        if (row.marketRent !== Number(tenant.marketRent)) tenantUpdate.marketRent = row.marketRent;
        if (row.moveInDate && (!tenant.moveInDate || row.moveInDate.getTime() !== tenant.moveInDate.getTime())) {
          tenantUpdate.moveInDate = row.moveInDate;
        }
        if (row.leaseExpiration && (!tenant.leaseExpiration || row.leaseExpiration.getTime() !== tenant.leaseExpiration.getTime())) {
          tenantUpdate.leaseExpiration = row.leaseExpiration;
        }
        const existingMoveOut = tenant.moveOutDate?.getTime() ?? null;
        const newMoveOut = row.moveOutDate?.getTime() ?? null;
        if (existingMoveOut !== newMoveOut) tenantUpdate.moveOutDate = row.moveOutDate;
        if (!tenant.yardiResidentId && row.residentId) tenantUpdate.yardiResidentId = row.residentId;

        if (Object.keys(tenantUpdate).length > 0) {
          await tx.tenant.update({ where: { id: tenant.id }, data: tenantUpdate });
          result.updated++;
        }
        tenantId = tenant.id;
      } else {
        // Create new tenant
        const created = await tx.tenant.create({
          data: {
            unitId,
            name: row.tenantName || "Unknown",
            balance: row.currentBalance,
            marketRent: row.marketRent,
            moveInDate: row.moveInDate,
            leaseExpiration: row.leaseExpiration,
            moveOutDate: row.moveOutDate,
            yardiResidentId: row.residentId || undefined,
          },
        });
        tenantId = created.id;
        result.tenantsCreated++;
        result.updated++;
      }

      // ── Dual-write: Lease sync ──
      const rentAmount = row.chargeAmount || row.marketRent;
      const activeLease = await tx.lease.findFirst({
        where: { tenantId, status: "ACTIVE" },
        select: { id: true, leaseEnd: true, leaseStart: true },
      });

      if (activeLease) {
        const leaseUpdate: Record<string, any> = {};
        if (row.leaseExpiration && (!activeLease.leaseEnd || row.leaseExpiration.getTime() !== activeLease.leaseEnd.getTime())) {
          leaseUpdate.leaseEnd = row.leaseExpiration;
        }
        if (row.moveInDate && (!activeLease.leaseStart || row.moveInDate.getTime() !== activeLease.leaseStart.getTime())) {
          leaseUpdate.leaseStart = row.moveInDate;
          leaseUpdate.moveInDate = row.moveInDate;
        }
        if (row.moveOutDate) leaseUpdate.moveOutDate = row.moveOutDate;
        if (rentAmount) leaseUpdate.monthlyRent = rentAmount;
        leaseUpdate.currentBalance = row.currentBalance;
        // Ensure new fields are populated
        if (!activeLease.id.endsWith("-lease")) {
          leaseUpdate.buildingId = buildingId;
          leaseUpdate.isCurrent = true;
        }

        if (Object.keys(leaseUpdate).length > 0) {
          await tx.lease.update({ where: { id: activeLease.id }, data: leaseUpdate });
        }
      } else {
        // No active lease — create one
        const leaseStatus = row.leaseExpiration
          ? (row.leaseExpiration < new Date() ? "EXPIRED" : "ACTIVE")
          : "MONTH_TO_MONTH";

        await tx.lease.upsert({
          where: { id: `${tenantId}-lease` },
          create: {
            id: `${tenantId}-lease`,
            unitId,
            tenantId,
            buildingId,
            isCurrent: true,
            leaseStart: row.moveInDate ?? null,
            leaseEnd: row.leaseExpiration ?? null,
            moveInDate: row.moveInDate ?? null,
            moveOutDate: row.moveOutDate ?? null,
            monthlyRent: rentAmount || 0,
            currentBalance: row.currentBalance,
            status: leaseStatus as any,
          },
          update: {
            leaseStart: row.moveInDate ?? undefined,
            leaseEnd: row.leaseExpiration ?? undefined,
            moveInDate: row.moveInDate ?? undefined,
            moveOutDate: row.moveOutDate ?? undefined,
            monthlyRent: rentAmount || undefined,
            currentBalance: row.currentBalance,
          },
        });
      }
    }

    // ── Process vacant rows ──
    for (const vr of vacantRows) {
      const buildingId = buildingMap.get(vr.propertyCode.toLowerCase().trim());
      if (!buildingId) {
        result.unmatched++;
        result.unmatchedRows.push({
          propertyCode: vr.propertyCode,
          unit: vr.unit,
          residentId: "",
          tenantName: "VACANT",
          reason: `Building not found for code "${vr.propertyCode}"`,
        });
        continue;
      }

      const unitRecord = await tx.unit.upsert({
        where: { buildingId_unitNumber: { buildingId, unitNumber: vr.unit } },
        create: { buildingId, unitNumber: vr.unit, unitType: vr.unitType || null, unitCategory: vr.unitCategory, isVacant: true, isResidential: vr.isResidential },
        update: { unitType: vr.unitType || undefined, unitCategory: vr.unitCategory, isVacant: true, isResidential: vr.isResidential },
      });

      await tx.vacancyInfo.upsert({
        where: { unitId: unitRecord.id },
        create: { unitId: unitRecord.id, proposedRent: vr.marketRent || null },
        update: { proposedRent: vr.marketRent || undefined },
      });

      result.matched++;
      result.vacanciesCreated++;
    }
  }, { timeout: 120_000 });

  return result;
}
