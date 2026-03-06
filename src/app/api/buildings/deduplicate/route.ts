import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { normalizeAddress, normalizeBlockLot, extractAddressFromEntity } from "@/lib/building-matching";

const FORBIDDEN = NextResponse.json({ error: "Forbidden" }, { status: 403 });

// GET /api/buildings/deduplicate?mode=scan
export const GET = withAuth(async (req: NextRequest, { user }) => {
  if (user.role !== "ADMIN") return FORBIDDEN;
  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      address: true,
      block: true,
      lot: true,
      entity: true,
      yardiId: true,
      _count: {
        select: {
          units: true,
          violations: true,
          complianceItems: true,
        },
      },
    },
  });

  // Also count tenants per building
  const tenantCounts = await prisma.tenant.groupBy({
    by: ["unitId"],
    _count: true,
  });
  const unitBuilding = await prisma.unit.findMany({
    select: { id: true, buildingId: true },
  });
  const unitToBuildingMap = new Map(unitBuilding.map((u) => [u.id, u.buildingId]));
  const buildingTenantCount = new Map<string, number>();
  for (const tc of tenantCounts) {
    const bId = unitToBuildingMap.get(tc.unitId);
    if (bId) buildingTenantCount.set(bId, (buildingTenantCount.get(bId) || 0) + tc._count);
  }

  // Group by normalized block+lot
  const blockLotGroups = new Map<string, typeof buildings>();
  const addressGroups = new Map<string, typeof buildings>();
  const yardiIdGroups = new Map<string, typeof buildings>();
  const matched = new Set<string>();

  // Build a yardiId lookup: yardiId → building (only for buildings with block/lot, i.e. "real" records)
  const yardiIdMap = new Map<string, (typeof buildings)[0]>();
  for (const b of buildings) {
    if (b.yardiId && b.block && b.lot) {
      yardiIdMap.set(b.yardiId.toLowerCase(), b);
    }
  }

  for (const b of buildings) {
    if (b.block && b.lot) {
      const key = `${normalizeBlockLot(b.block)}|${normalizeBlockLot(b.lot)}`;
      if (!blockLotGroups.has(key)) blockLotGroups.set(key, []);
      blockLotGroups.get(key)!.push(b);
    }
  }

  // Mark buildings already grouped by block+lot
  for (const [, group] of blockLotGroups) {
    if (group.length >= 2) {
      for (const b of group) matched.add(b.id);
    }
  }

  // Group remaining by normalized address
  for (const b of buildings) {
    if (matched.has(b.id)) continue;
    const key = normalizeAddress(b.address);
    if (!addressGroups.has(key)) addressGroups.set(key, []);
    addressGroups.get(key)!.push(b);
  }

  // Mark buildings already grouped by address
  for (const [, group] of addressGroups) {
    if (group.length >= 2) {
      for (const b of group) matched.add(b.id);
    }
  }

  // Match remaining by yardiId extraction: "Entity Name(yardiCode)" → look up yardiCode
  for (const b of buildings) {
    if (matched.has(b.id)) continue;
    // Extract yardiId from parenthesized pattern in address or yardiId field
    const parenMatch = (b.yardiId || b.address || "").match(/\(([^)]+)\)$/);
    if (parenMatch) {
      const extractedId = parenMatch[1].toLowerCase();
      const realBuilding = yardiIdMap.get(extractedId);
      if (realBuilding && realBuilding.id !== b.id) {
        const key = extractedId;
        if (!yardiIdGroups.has(key)) {
          yardiIdGroups.set(key, [realBuilding]);
          matched.add(realBuilding.id);
        }
        yardiIdGroups.get(key)!.push(b);
        matched.add(b.id);
      }
    }
  }

  // Match entity-style addresses to clean-address buildings by extracting street address
  const entityCrossGroups = new Map<string, typeof buildings>();
  const cleanAddrLookup = new Map<string, (typeof buildings)[0]>();
  for (const b of buildings) {
    if (matched.has(b.id)) continue;
    // Only index buildings with "clean" addresses (no parenthesized yardiId suffix)
    if (!/\([^)]+\)$/.test(b.address)) {
      cleanAddrLookup.set(normalizeAddress(b.address), b);
    }
  }
  for (const b of buildings) {
    if (matched.has(b.id)) continue;
    const extracted = extractAddressFromEntity(b.address);
    if (!extracted) continue;
    const normExtracted = normalizeAddress(extracted);
    const cleanMatch = cleanAddrLookup.get(normExtracted);
    if (cleanMatch && cleanMatch.id !== b.id) {
      const key = `entity-cross:${cleanMatch.id}`;
      if (!entityCrossGroups.has(key)) {
        entityCrossGroups.set(key, [cleanMatch]);
        matched.add(cleanMatch.id);
      }
      entityCrossGroups.get(key)!.push(b);
      matched.add(b.id);
    }
  }

  interface DupBuilding {
    id: string;
    address: string;
    block: string | null;
    lot: string | null;
    entity: string | null;
    unitCount: number;
    tenantCount: number;
    violationCount: number;
    complianceCount: number;
  }

  interface DuplicateSet {
    matchedBy: string;
    buildings: DupBuilding[];
  }

  const duplicateSets: DuplicateSet[] = [];

  const toBuildingInfo = (b: (typeof buildings)[0]): DupBuilding => ({
    id: b.id,
    address: b.address,
    block: b.block,
    lot: b.lot,
    entity: b.entity,
    unitCount: b._count.units,
    tenantCount: buildingTenantCount.get(b.id) || 0,
    violationCount: b._count.violations,
    complianceCount: b._count.complianceItems,
  });

  for (const [, group] of blockLotGroups) {
    if (group.length >= 2) {
      duplicateSets.push({
        matchedBy: "block+lot",
        buildings: group.map(toBuildingInfo),
      });
    }
  }

  for (const [, group] of addressGroups) {
    if (group.length >= 2) {
      duplicateSets.push({
        matchedBy: "address",
        buildings: group.map(toBuildingInfo),
      });
    }
  }

  for (const [, group] of yardiIdGroups) {
    if (group.length >= 2) {
      duplicateSets.push({
        matchedBy: "yardiId",
        buildings: group.map(toBuildingInfo),
      });
    }
  }

  for (const [, group] of entityCrossGroups) {
    if (group.length >= 2) {
      duplicateSets.push({
        matchedBy: "entity-address",
        buildings: group.map(toBuildingInfo),
      });
    }
  }

  // Also flag "junk" buildings like "All Properties" with no relations
  const junkBuildings = buildings.filter(
    (b) =>
      !matched.has(b.id) &&
      !b.block &&
      !b.lot &&
      b._count.units === 0 &&
      b._count.violations === 0 &&
      b._count.complianceItems === 0 &&
      (buildingTenantCount.get(b.id) || 0) === 0
  );
  if (junkBuildings.length > 0) {
    duplicateSets.push({
      matchedBy: "orphan (no data, no block/lot)",
      buildings: junkBuildings.map(toBuildingInfo),
    });
  }

  return NextResponse.json({ duplicateSets });
});

// POST /api/buildings/deduplicate — merge duplicates
export const POST = withAuth(async (req: NextRequest, { user }) => {
  if (user.role !== "ADMIN") return FORBIDDEN;
  const body = await req.json();
  const { keepId, mergeIds } = body as { keepId: string; mergeIds: string[] };

  if (!keepId || !mergeIds?.length) {
    return NextResponse.json({ error: "keepId and mergeIds required" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    let movedUnits = 0;
    let movedViolations = 0;
    let movedCompliance = 0;

    const keepBuilding = await tx.building.findUnique({ where: { id: keepId } });
    if (!keepBuilding) throw new Error("Keep building not found");

    for (const mergeId of mergeIds) {
      const mergeBuilding = await tx.building.findUnique({ where: { id: mergeId } });
      if (!mergeBuilding) continue;

      // Move units — check for unitNumber conflicts
      const mergeUnits = await tx.unit.findMany({ where: { buildingId: mergeId } });
      const keepUnits = await tx.unit.findMany({
        where: { buildingId: keepId },
        select: { unitNumber: true },
      });
      const keepUnitNumbers = new Set(keepUnits.map((u) => u.unitNumber));

      for (const unit of mergeUnits) {
        let unitNumber = unit.unitNumber;
        if (keepUnitNumbers.has(unitNumber)) {
          // Rename conflicting unit with suffix
          let suffix = 2;
          while (keepUnitNumbers.has(`${unitNumber}-${suffix}`)) suffix++;
          unitNumber = `${unitNumber}-${suffix}`;
        }
        await tx.unit.update({
          where: { id: unit.id },
          data: { buildingId: keepId, unitNumber },
        });
        keepUnitNumbers.add(unitNumber);
        movedUnits++;
      }

      // Move violations
      const violationResult = await tx.violation.updateMany({
        where: { buildingId: mergeId },
        data: { buildingId: keepId },
      });
      movedViolations += violationResult.count;

      // Move compliance items — skip if same type already exists on keepId
      const mergeCompliance = await tx.complianceItem.findMany({
        where: { buildingId: mergeId },
      });
      const keepComplianceTypes = await tx.complianceItem.findMany({
        where: { buildingId: keepId },
        select: { type: true },
      });
      const keepTypes = new Set(keepComplianceTypes.map((c) => c.type));
      for (const item of mergeCompliance) {
        if (keepTypes.has(item.type)) {
          // Delete the duplicate compliance item
          await tx.complianceItem.delete({ where: { id: item.id } });
        } else {
          await tx.complianceItem.update({
            where: { id: item.id },
            data: { buildingId: keepId },
          });
          movedCompliance++;
        }
      }

      // Move violation sync logs
      await tx.violationSyncLog.updateMany({
        where: { buildingId: mergeId },
        data: { buildingId: keepId },
      });

      // Move work orders
      await tx.workOrder.updateMany({
        where: { buildingId: mergeId },
        data: { buildingId: keepId },
      });

      // Copy non-null fields from mergeBuilding to keepBuilding (fill gaps)
      const fillFields = [
        "altAddress", "entity", "portfolio", "region", "zip", "block", "lot",
        "owner", "ownerEmail", "manager", "arTeam", "apTeam", "headPortfolio",
        "mgmtStartDate", "einNumber", "bin", "mdrNumber", "dhcrRegId",
        "squareFootage", "yearBuilt", "constructionType", "floors", "floorsBelowGround",
        "lifeSafety", "elevatorInfo", "boilerInfo", "complianceDates",
        "superintendent", "elevatorCompany", "fireAlarmCompany",
        "utilityMeters", "utilityAccounts",
      ] as const;

      const updates: Record<string, any> = {};
      for (const field of fillFields) {
        if ((keepBuilding as any)[field] == null && (mergeBuilding as any)[field] != null) {
          updates[field] = (mergeBuilding as any)[field];
        }
      }
      if (Object.keys(updates).length > 0) {
        await tx.building.update({ where: { id: keepId }, data: updates });
      }

      // Delete the duplicate building (cascade will handle remaining relations)
      await tx.building.delete({ where: { id: mergeId } });
    }

    return { merged: mergeIds.length, kept: keepId, movedUnits, movedViolations, movedCompliance };
  }, { timeout: 30000 });

  return NextResponse.json(result);
}, "upload");

// PUT /api/buildings/deduplicate — auto-scan + auto-merge all duplicates in one call
export const PUT = withAuth(async (req: NextRequest, { user }) => {
  if (user.role !== "ADMIN") return FORBIDDEN;
  // Step 1: Scan (same logic as GET)
  const buildings = await prisma.building.findMany({
    select: {
      id: true, address: true, altAddress: true, block: true, lot: true, entity: true, yardiId: true,
      _count: { select: { units: true, violations: true, complianceItems: true } },
    },
  });

  const tenantCounts = await prisma.tenant.groupBy({ by: ["unitId"], _count: true });
  const unitBuilding = await prisma.unit.findMany({ select: { id: true, buildingId: true } });
  const unitToBuildingMap = new Map(unitBuilding.map((u) => [u.id, u.buildingId]));
  const buildingTenantCount = new Map<string, number>();
  for (const tc of tenantCounts) {
    const bId = unitToBuildingMap.get(tc.unitId);
    if (bId) buildingTenantCount.set(bId, (buildingTenantCount.get(bId) || 0) + tc._count);
  }

  const blockLotGroups = new Map<string, typeof buildings>();
  const addressGroups = new Map<string, typeof buildings>();
  const yardiIdGroups = new Map<string, typeof buildings>();
  const matched = new Set<string>();

  const yardiIdMap = new Map<string, (typeof buildings)[0]>();
  for (const b of buildings) {
    if (b.yardiId && b.block && b.lot) yardiIdMap.set(b.yardiId.toLowerCase(), b);
  }

  for (const b of buildings) {
    if (b.block && b.lot) {
      const key = `${normalizeBlockLot(b.block)}|${normalizeBlockLot(b.lot)}`;
      if (!blockLotGroups.has(key)) blockLotGroups.set(key, []);
      blockLotGroups.get(key)!.push(b);
    }
  }
  for (const [, group] of blockLotGroups) {
    if (group.length >= 2) for (const b of group) matched.add(b.id);
  }

  for (const b of buildings) {
    if (matched.has(b.id)) continue;
    const key = normalizeAddress(b.address);
    if (!addressGroups.has(key)) addressGroups.set(key, []);
    addressGroups.get(key)!.push(b);
  }
  for (const [, group] of addressGroups) {
    if (group.length >= 2) for (const b of group) matched.add(b.id);
  }

  for (const b of buildings) {
    if (matched.has(b.id)) continue;
    const parenMatch = (b.yardiId || b.address || "").match(/\(([^)]+)\)$/);
    if (parenMatch) {
      const extractedId = parenMatch[1].toLowerCase();
      const realBuilding = yardiIdMap.get(extractedId);
      if (realBuilding && realBuilding.id !== b.id) {
        if (!yardiIdGroups.has(extractedId)) {
          yardiIdGroups.set(extractedId, [realBuilding]);
          matched.add(realBuilding.id);
        }
        yardiIdGroups.get(extractedId)!.push(b);
        matched.add(b.id);
      }
    }
  }

  // Entity-to-address cross-matching
  const entityCrossGroupsPut = new Map<string, typeof buildings>();
  const cleanAddrLookupPut = new Map<string, (typeof buildings)[0]>();
  for (const b of buildings) {
    if (matched.has(b.id)) continue;
    if (!/\([^)]+\)$/.test(b.address)) {
      cleanAddrLookupPut.set(normalizeAddress(b.address), b);
    }
  }
  for (const b of buildings) {
    if (matched.has(b.id)) continue;
    const extracted = extractAddressFromEntity(b.address);
    if (!extracted) continue;
    const normExtracted = normalizeAddress(extracted);
    const cleanMatch = cleanAddrLookupPut.get(normExtracted);
    if (cleanMatch && cleanMatch.id !== b.id) {
      const key = `entity-cross:${cleanMatch.id}`;
      if (!entityCrossGroupsPut.has(key)) {
        entityCrossGroupsPut.set(key, [cleanMatch]);
        matched.add(cleanMatch.id);
      }
      entityCrossGroupsPut.get(key)!.push(b);
      matched.add(b.id);
    }
  }

  // Collect all duplicate sets
  interface MergeSet { matchedBy: string; buildings: { id: string; score: number; address: string }[] }
  const mergeSets: MergeSet[] = [];
  const score = (b: (typeof buildings)[0]) =>
    b._count.units + (buildingTenantCount.get(b.id) || 0) + b._count.violations + b._count.complianceItems;

  for (const [, group] of blockLotGroups) {
    if (group.length >= 2)
      mergeSets.push({ matchedBy: "block+lot", buildings: group.map((b) => ({ id: b.id, score: score(b), address: b.address })) });
  }
  for (const [, group] of addressGroups) {
    if (group.length >= 2)
      mergeSets.push({ matchedBy: "address", buildings: group.map((b) => ({ id: b.id, score: score(b), address: b.address })) });
  }
  for (const [, group] of yardiIdGroups) {
    if (group.length >= 2)
      mergeSets.push({ matchedBy: "yardiId", buildings: group.map((b) => ({ id: b.id, score: score(b), address: b.address })) });
  }
  for (const [, group] of entityCrossGroupsPut) {
    if (group.length >= 2)
      mergeSets.push({ matchedBy: "entity-address", buildings: group.map((b) => ({ id: b.id, score: score(b), address: b.address })) });
  }

  // Junk/orphan buildings
  const junkBuildings = buildings.filter(
    (b) =>
      !matched.has(b.id) && !b.block && !b.lot &&
      b._count.units === 0 && b._count.violations === 0 && b._count.complianceItems === 0 &&
      (buildingTenantCount.get(b.id) || 0) === 0
  );

  // Step 2: Auto-merge each set
  let totalMerged = 0;
  let totalDeleted = 0;
  const report: { matchedBy: string; kept: string; merged: string[] }[] = [];

  for (const set of mergeSets) {
    const sorted = [...set.buildings].sort((a, b) => b.score - a.score);
    const keepId = sorted[0].id;
    const mergeIds = sorted.slice(1).map((b) => b.id);

    await prisma.$transaction(async (tx) => {
      const keepBuilding = await tx.building.findUnique({ where: { id: keepId } });
      if (!keepBuilding) return;

      for (const mergeId of mergeIds) {
        const mergeBuilding = await tx.building.findUnique({ where: { id: mergeId } });
        if (!mergeBuilding) continue;

        const mergeUnits = await tx.unit.findMany({ where: { buildingId: mergeId } });
        const keepUnits = await tx.unit.findMany({ where: { buildingId: keepId }, select: { unitNumber: true } });
        const keepUnitNumbers = new Set(keepUnits.map((u) => u.unitNumber));

        for (const unit of mergeUnits) {
          let unitNumber = unit.unitNumber;
          if (keepUnitNumbers.has(unitNumber)) {
            let suffix = 2;
            while (keepUnitNumbers.has(`${unitNumber}-${suffix}`)) suffix++;
            unitNumber = `${unitNumber}-${suffix}`;
          }
          await tx.unit.update({ where: { id: unit.id }, data: { buildingId: keepId, unitNumber } });
          keepUnitNumbers.add(unitNumber);
        }

        await tx.violation.updateMany({ where: { buildingId: mergeId }, data: { buildingId: keepId } });

        const mergeCompliance = await tx.complianceItem.findMany({ where: { buildingId: mergeId } });
        const keepComplianceTypes = await tx.complianceItem.findMany({ where: { buildingId: keepId }, select: { type: true } });
        const keepTypes = new Set(keepComplianceTypes.map((c) => c.type));
        for (const item of mergeCompliance) {
          if (keepTypes.has(item.type)) {
            await tx.complianceItem.delete({ where: { id: item.id } });
          } else {
            await tx.complianceItem.update({ where: { id: item.id }, data: { buildingId: keepId } });
          }
        }

        await tx.violationSyncLog.updateMany({ where: { buildingId: mergeId }, data: { buildingId: keepId } });
        await tx.workOrder.updateMany({ where: { buildingId: mergeId }, data: { buildingId: keepId } });

        const fillFields = [
          "altAddress", "entity", "portfolio", "region", "zip", "block", "lot",
          "owner", "ownerEmail", "manager", "arTeam", "apTeam", "headPortfolio",
          "mgmtStartDate", "einNumber", "bin", "mdrNumber", "dhcrRegId",
          "squareFootage", "yearBuilt", "constructionType", "floors", "floorsBelowGround",
          "lifeSafety", "elevatorInfo", "boilerInfo", "complianceDates",
          "superintendent", "elevatorCompany", "fireAlarmCompany", "utilityMeters", "utilityAccounts",
        ] as const;
        const updates: Record<string, any> = {};
        for (const field of fillFields) {
          if ((keepBuilding as any)[field] == null && (mergeBuilding as any)[field] != null) {
            updates[field] = (mergeBuilding as any)[field];
          }
        }
        if (Object.keys(updates).length > 0) {
          await tx.building.update({ where: { id: keepId }, data: updates });
        }

        await tx.building.delete({ where: { id: mergeId } });
        totalMerged++;
      }
    }, { timeout: 30000 });

    report.push({ matchedBy: set.matchedBy, kept: sorted[0].address, merged: sorted.slice(1).map((b) => b.address) });
  }

  // Step 3: Delete orphan/junk buildings
  for (const junk of junkBuildings) {
    await prisma.building.delete({ where: { id: junk.id } });
    totalDeleted++;
  }

  // Step 4: Count final buildings and units
  const finalBuildingCount = await prisma.building.count();
  const finalUnitCount = await prisma.unit.count();
  const finalTenantCount = await prisma.tenant.count();

  return NextResponse.json({
    duplicateSetsFound: mergeSets.length,
    buildingsMerged: totalMerged,
    orphansDeleted: totalDeleted,
    finalBuildingCount,
    finalUnitCount,
    finalTenantCount,
    report,
  });
}, "upload");
