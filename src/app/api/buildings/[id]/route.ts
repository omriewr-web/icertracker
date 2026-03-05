import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";

export const GET = withAuth(async (req, { params }) => {
  const { id } = await params;
  const building = await prisma.building.findUnique({
    where: { id },
    include: {
      units: {
        include: {
          tenant: true,
          vacancyInfo: true,
        },
      },
    },
  });

  if (!building) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(building);
});

export const PATCH = withAuth(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  // Convert null JSON fields to Prisma.DbNull
  const jsonFields = ["superintendent", "elevatorCompany", "fireAlarmCompany", "utilityMeters", "utilityAccounts"];
  const data = { ...body };
  for (const field of jsonFields) {
    if (field in data && data[field] === null) {
      data[field] = Prisma.DbNull;
    }
  }
  if (data.mgmtStartDate && typeof data.mgmtStartDate === "string") {
    data.mgmtStartDate = new Date(data.mgmtStartDate);
  }
  const building = await prisma.building.update({ where: { id }, data });
  return NextResponse.json(building);
}, "edit");

export const DELETE = withAuth(async (req, { params }) => {
  const { id } = await params;
  await prisma.building.delete({ where: { id } });
  return NextResponse.json({ success: true });
}, "upload");
