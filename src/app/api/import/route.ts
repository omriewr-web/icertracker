import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parseRentRollExcel } from "@/lib/excel-import";
import { parsedTenantRowSchema } from "@/lib/validations";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";
import { findMatchingBuilding, fetchBuildingsForMatching, generateYardiId, normalizeAddress } from "@/lib/building-matching";

export const POST = withAuth(async (req, { user }) => {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = parseRentRollExcel(buffer);
  const { tenants, propertyName, errors } = result;

  if (tenants.length === 0) {
    return NextResponse.json({ error: "No tenant records found", errors }, { status: 400 });
  }

  // Create import batch upfront so we can link ImportRows
  const importBatch = await prisma.importBatch.create({
    data: {
      filename: file.name,
      format: result.format,
      recordCount: 0,
      status: "processing",
    },
  });

  let imported = 0;
  let skipped = 0;
  const buildingCache = new Map<string, string>();
  const existing = await fetchBuildingsForMatching();

  for (let rowIdx = 0; rowIdx < tenants.length; rowIdx++) {
    const raw = tenants[rowIdx];
    const parsed = parsedTenantRowSchema.safeParse(raw);
    if (!parsed.success) {
      const rowErrors = parsed.error.issues.map((i) => i.message);
      errors.push(`${raw.unit} ${raw.name}: validation failed – ${rowErrors.join(", ")}`);
      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: rowIdx,
          rawData: raw as any,
          status: "ERROR",
          entityType: "tenant",
          errors: rowErrors,
        },
      });
      skipped++;
      continue;
    }
    const t = parsed.data;
    try {
      const propKey = t.property || propertyName || "Unknown";
      const cacheKey = normalizeAddress(propKey);
      let buildingId = buildingCache.get(cacheKey);

      if (!buildingId) {
        const match = findMatchingBuilding(
          { address: propKey, block: null, lot: null, entity: null },
          existing
        );
        if (match) {
          buildingId = match.id;
        } else {
          const yardiId = generateYardiId(propKey);
          const building = await prisma.building.create({
            data: { yardiId, address: propKey },
          });
          buildingId = building.id;
          existing.push({ id: buildingId, address: propKey, block: null, lot: null, entity: null, yardiId });
        }
        buildingCache.set(cacheKey, buildingId);
      }

      const unit = await prisma.unit.upsert({
        where: { buildingId_unitNumber: { buildingId, unitNumber: t.unit } },
        create: {
          buildingId,
          unitNumber: t.unit,
          unitType: t.unitType,
          isVacant: t.isVacant,
        },
        update: { unitType: t.unitType, isVacant: t.isVacant },
      });

      if (t.isVacant) {
        await prisma.vacancyInfo.upsert({
          where: { unitId: unit.id },
          create: { unitId: unit.id, proposedRent: t.marketRent },
          update: { proposedRent: t.marketRent },
        });
        await prisma.importRow.create({
          data: {
            importBatchId: importBatch.id,
            rowIndex: rowIdx,
            rawData: raw as any,
            status: "UPDATED",
            entityType: "vacancy",
            entityId: unit.id,
          },
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
        balance: t.balance,
        marketRent: t.marketRent,
        arrearsDays,
        leaseStatus,
        legalFlag: false,
        legalRecommended: false,
        isVacant: false,
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
        arrearsCategory,
        arrearsDays,
        monthsOwed,
        leaseStatus,
        collectionScore,
      };

      let tenant;
      let rowAction: "CREATED" | "UPDATED";
      if (t.residentId) {
        const existing = await prisma.tenant.findUnique({ where: { yardiResidentId: t.residentId } });
        rowAction = existing ? "UPDATED" : "CREATED";
        tenant = await prisma.tenant.upsert({
          where: { yardiResidentId: t.residentId },
          create: { unitId: unit.id, yardiResidentId: t.residentId, ...tenantData },
          update: tenantData,
        });
      } else {
        const existing = await prisma.tenant.findUnique({ where: { unitId: unit.id } });
        rowAction = existing ? "UPDATED" : "CREATED";
        tenant = await prisma.tenant.upsert({
          where: { unitId: unit.id },
          create: { unitId: unit.id, ...tenantData },
          update: tenantData,
        });
      }

      // ── Dual-write: Lease + BalanceSnapshot + RecurringCharges ──
      const normalizedLeaseStatus = leaseExp
        ? (leaseExp < new Date() ? "EXPIRED" : "ACTIVE")
        : "MONTH_TO_MONTH";

      const leaseId = `${tenant.id}-lease`;

      await prisma.lease.upsert({
        where: { id: leaseId },
        create: {
          id: leaseId,
          unitId: unit.id,
          tenantId: tenant.id,
          leaseStart: t.moveIn ? new Date(t.moveIn) : null,
          leaseEnd: leaseExp,
          monthlyRent: t.marketRent,
          legalRent: 0,
          preferentialRent: 0,
          securityDeposit: t.deposit,
          status: normalizedLeaseStatus as any,
          isStabilized: false,
        },
        update: {
          leaseStart: t.moveIn ? new Date(t.moveIn) : null,
          leaseEnd: leaseExp,
          monthlyRent: t.marketRent,
          securityDeposit: t.deposit,
          status: normalizedLeaseStatus as any,
        },
      });

      // Write individual charge rows as RecurringCharges
      const charges = (raw as any).charges ?? [];
      if (charges.length > 0) {
        // Deactivate old charges, replace with current import
        await prisma.recurringCharge.updateMany({
          where: { leaseId },
          data: { active: false },
        });
        for (const charge of charges) {
          if (charge.chargeCode && charge.amount !== 0) {
            await prisma.recurringCharge.create({
              data: {
                leaseId,
                chargeCode: charge.chargeCode,
                amount: charge.amount,
                active: true,
              },
            });
          }
        }
      }

      await prisma.balanceSnapshot.create({
        data: {
          tenantId: tenant.id,
          leaseId,
          importBatchId: importBatch.id,
          snapshotDate: new Date(),
          currentCharges: t.chargeAmount || t.marketRent,
          currentBalance: t.balance,
          pastDueBalance: t.balance > 0 ? t.balance : 0,
          arrearsStatus: arrearsCategory,
        },
      });

      // Track this row
      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: rowIdx,
          rawData: raw as any,
          status: rowAction,
          entityType: "tenant",
          entityId: tenant.id,
        },
      });

      imported++;
    } catch (e: any) {
      errors.push(`${t.unit} ${t.name}: ${e.message}`);
      await prisma.importRow.create({
        data: {
          importBatchId: importBatch.id,
          rowIndex: rowIdx,
          rawData: raw as any,
          status: "ERROR",
          entityType: "tenant",
          errors: [e.message],
        },
      }).catch(() => {}); // don't fail the whole import if row tracking fails
      skipped++;
    }
  }

  // Update batch with final counts
  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      recordCount: imported,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  return NextResponse.json({
    imported, skipped, errors,
    total: tenants.length,
    format: result.format,
    batchId: importBatch.id,
  });
}, "upload");
