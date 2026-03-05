import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { parseRentRollExcel } from "@/lib/excel-import";
import { getArrearsCategory, getArrearsDays, getLeaseStatus, calcCollectionScore } from "@/lib/scoring";

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

  let imported = 0;
  let skipped = 0;
  const buildingCache = new Map<string, string>();

  for (const t of tenants) {
    try {
      const propKey = t.property || propertyName || "Unknown";
      let buildingId = buildingCache.get(propKey);

      if (!buildingId) {
        const building = await prisma.building.upsert({
          where: { yardiId: propKey },
          create: { yardiId: propKey, address: propKey },
          update: {},
        });
        buildingId = building.id;
        buildingCache.set(propKey, buildingId);
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

      if (t.residentId) {
        await prisma.tenant.upsert({
          where: { yardiResidentId: t.residentId },
          create: { unitId: unit.id, yardiResidentId: t.residentId, ...tenantData },
          update: tenantData,
        });
      } else {
        await prisma.tenant.upsert({
          where: { unitId: unit.id },
          create: { unitId: unit.id, ...tenantData },
          update: tenantData,
        });
      }

      imported++;
    } catch (e: any) {
      errors.push(`${t.unit} ${t.name}: ${e.message}`);
      skipped++;
    }
  }

  await prisma.importBatch.create({
    data: {
      filename: file.name,
      format: "excel",
      recordCount: imported,
      status: errors.length > 0 ? "completed_with_errors" : "completed",
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  return NextResponse.json({ imported, skipped, errors, total: tenants.length, format: result.format });
}, "upload");
