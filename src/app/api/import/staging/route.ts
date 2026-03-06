import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

// GET /api/import/staging — list staging batches
export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // pending_review | approved | rejected | all
  const id = url.searchParams.get("id");

  // Single batch detail
  if (id) {
    const batch = await prisma.importStagingBatch.findUnique({ where: { id } });
    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(batch);
  }

  // List batches
  const where = status && status !== "all" ? { status } : {};
  const batches = await prisma.importStagingBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      importType: true,
      fileName: true,
      uploadedById: true,
      status: true,
      summaryJson: true,
      reviewedById: true,
      reviewedAt: true,
      reviewNotes: true,
      importBatchId: true,
      createdAt: true,
    },
  });
  return NextResponse.json(batches);
});

// POST /api/import/staging — approve or reject a staging batch
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json();
  const { id, action, notes } = body as { id: string; action: "approve" | "reject"; notes?: string };

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const batch = await prisma.importStagingBatch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (batch.status !== "pending_review") {
    return NextResponse.json({ error: `Batch already ${batch.status}` }, { status: 400 });
  }

  if (action === "reject") {
    await prisma.importStagingBatch.update({
      where: { id },
      data: { status: "rejected", reviewedById: user.id, reviewedAt: new Date(), reviewNotes: notes },
    });
    return NextResponse.json({ success: true, status: "rejected" });
  }

  // Approve: commit the rows
  // Import the commit function dynamically to avoid circular deps
  const { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } = await import("@/lib/scoring");
  const { findMatchingBuilding, fetchBuildingsForMatching, generateYardiId, normalizeAddress, extractAddressFromEntity } = await import("@/lib/building-matching");

  const rows = batch.rowsJson as any[];
  const existingBuildings = await fetchBuildingsForMatching();
  const buildingCache = new Map<string, string>();

  const importBatch = await prisma.importBatch.create({
    data: { filename: batch.fileName, format: "staged", recordCount: 0, status: "processing" },
  });

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
        imported++;
        continue;
      }

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
      if (t.residentId) {
        tenant = await prisma.tenant.upsert({
          where: { yardiResidentId: t.residentId },
          create: { unitId: unitRecord.id, yardiResidentId: t.residentId, ...tenantData },
          update: tenantData,
        });
      } else {
        const existing = await prisma.tenant.findFirst({
          where: { unit: { buildingId, unitNumber: t.unit }, name: { equals: t.name, mode: "insensitive" } },
        });
        if (existing) {
          tenant = await prisma.tenant.update({ where: { id: existing.id }, data: tenantData });
        } else {
          const byUnit = await prisma.tenant.findUnique({ where: { unitId: unitRecord.id } });
          if (byUnit) {
            tenant = await prisma.tenant.update({ where: { id: byUnit.id }, data: tenantData });
          } else {
            tenant = await prisma.tenant.create({ data: { unitId: unitRecord.id, ...tenantData } });
          }
        }
      }

      // Dual-write lease + snapshot
      const normalizedLeaseStatus = leaseExp ? (leaseExp < new Date() ? "EXPIRED" : "ACTIVE") : "MONTH_TO_MONTH";
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
          tenantId: tenant.id, leaseId, importBatchId: importBatch.id,
          snapshotDate: new Date(), currentCharges: t.chargeAmount || t.marketRent,
          currentBalance: t.balance, pastDueBalance: t.balance > 0 ? t.balance : 0, arrearsStatus: arrearsCategory,
        },
      });

      imported++;
    } catch (e: any) {
      errors.push(`${t.unit} ${t.name}: ${e.message}`);
      skipped++;
    }
  }

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      recordCount: imported,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  await prisma.importStagingBatch.update({
    where: { id },
    data: {
      status: "approved",
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewNotes: notes,
      importBatchId: importBatch.id,
    },
  });

  return NextResponse.json({
    success: true,
    status: "approved",
    imported,
    skipped,
    errors,
    batchId: importBatch.id,
  });
});
