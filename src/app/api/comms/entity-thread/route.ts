import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getOrCreateEntityThread } from "@/lib/comms/conversation.service";
import { canAccessBuilding } from "@/lib/data-scope";

export const dynamic = "force-dynamic";

const V1_TYPES = ["work_order", "building", "unit", "tenant"];
const V2_TYPES = ["violation", "legal_case", "turnover", "collections_case", "incident"];

export const GET = withAuth(async (req, { user }) => {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  if (V2_TYPES.includes(entityType)) {
    return NextResponse.json(
      { error: `${entityType} threads are coming in V2` },
      { status: 501 }
    );
  }

  if (!V1_TYPES.includes(entityType)) {
    return NextResponse.json({ error: "Unsupported entityType" }, { status: 400 });
  }

  const orgId = user.organizationId!;
  let title: string;
  let buildingId: string | null = null;

  if (entityType === "work_order") {
    const wo = await prisma.workOrder.findFirst({
      where: { id: entityId, building: { organizationId: orgId } },
      select: { id: true, title: true, buildingId: true },
    });
    if (!wo) return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    if (!(await canAccessBuilding(user, wo.buildingId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    title = `WO-${wo.id.slice(-4).toUpperCase()}: ${wo.title}`;
    buildingId = wo.buildingId;
  } else if (entityType === "building") {
    const building = await prisma.building.findFirst({
      where: { id: entityId, organizationId: orgId },
      select: { id: true, address: true },
    });
    if (!building) return NextResponse.json({ error: "Building not found" }, { status: 404 });
    if (!(await canAccessBuilding(user, building.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    title = building.address;
    buildingId = building.id;
  } else if (entityType === "unit") {
    const unit = await prisma.unit.findFirst({
      where: { id: entityId, building: { organizationId: orgId } },
      select: {
        id: true,
        unitNumber: true,
        buildingId: true,
        building: { select: { address: true } },
      },
    });
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    if (!(await canAccessBuilding(user, unit.buildingId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    title = `Unit ${unit.unitNumber} · ${unit.building.address}`;
    buildingId = unit.buildingId;
  } else {
    // tenant
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: entityId,
        unit: { building: { organizationId: orgId } },
      },
      select: {
        id: true,
        name: true,
        unit: {
          select: {
            unitNumber: true,
            buildingId: true,
            building: { select: { address: true } },
          },
        },
      },
    });
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    if (!(await canAccessBuilding(user, tenant.unit.buildingId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    title = `${tenant.name} · ${tenant.unit.unitNumber} ${tenant.unit.building?.address || ""}`;
    buildingId = tenant.unit.buildingId;
  }

  const conversation = await getOrCreateEntityThread(
    orgId,
    user.id,
    entityType,
    entityId,
    title,
    buildingId
  );

  return NextResponse.json({ conversation });
}, "dash");
