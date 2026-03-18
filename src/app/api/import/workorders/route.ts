import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { routeParser } from "@/lib/parsers/router";
import { normalizeAddress } from "@/lib/building-matching";
import { getOrgScope } from "@/lib/data-scope";
import type { WorkOrderPriority, WorkOrderCategory, WorkOrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PRIORITY_MAP: Record<string, WorkOrderPriority> = {
  low: "LOW", medium: "MEDIUM", high: "HIGH", emergency: "URGENT", urgent: "URGENT",
};
const CATEGORY_MAP: Record<string, WorkOrderCategory> = {
  plumbing: "PLUMBING", electric: "ELECTRICAL", electrical: "ELECTRICAL",
  hvac: "HVAC", structural: "GENERAL", pest: "OTHER", other: "OTHER",
};
const STATUS_MAP: Record<string, WorkOrderStatus> = {
  open: "OPEN", "in-progress": "IN_PROGRESS", "in progress": "IN_PROGRESS",
  completed: "COMPLETED", done: "COMPLETED",
};

export const POST = withAuth(async (req: NextRequest, { user }) => {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "true";
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file instanceof File ? file.name : "upload.xlsx";
  const parsed = routeParser(buffer, fileName);

  if (!parsed.success || parsed.data.length === 0) {
    return NextResponse.json({ error: "Could not parse file", errors: parsed.errors }, { status: 400 });
  }

  const orgScope = getOrgScope(user);
  const orgId = user.organizationId;

  const buildings = await prisma.building.findMany({
    where: { ...orgScope },
    select: { id: true, address: true, units: { select: { id: true, unitNumber: true } } },
  });
  const buildingMap = new Map(buildings.map((b) => [normalizeAddress(b.address), b]));

  let imported = 0, skipped = 0;
  const errors: { row: number; field: string; reason: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, any>;
    const addr = normalizeAddress(row.buildingAddress || "");
    const building = buildingMap.get(addr);

    if (!building) {
      errors.push({ row: i + 1, field: "buildingAddress", reason: `Building not found: ${row.buildingAddress}` });
      skipped++;
      continue;
    }

    const title = String(row.title || "").trim();
    if (!title) {
      errors.push({ row: i + 1, field: "title", reason: "Title is required" });
      skipped++;
      continue;
    }

    if (dryRun) { imported++; continue; }

    try {
      const unitNumber = String(row.unitNumber || "").trim();
      const unit = unitNumber ? building.units.find((u) => u.unitNumber.toLowerCase() === unitNumber.toLowerCase()) : null;

      await prisma.workOrder.create({
        data: {
          buildingId: building.id,
          unitId: unit?.id,
          title,
          description: row.description || "",
          priority: (PRIORITY_MAP[(row.priority || "").toLowerCase()] || "MEDIUM") as WorkOrderPriority,
          category: (CATEGORY_MAP[(row.category || "").toLowerCase()] || "GENERAL") as WorkOrderCategory,
          status: (STATUS_MAP[(row.status || "").toLowerCase()] || "OPEN") as WorkOrderStatus,
          createdAt: row.createdDate ? new Date(row.createdDate) : new Date(),
          completedDate: row.completedDate ? new Date(row.completedDate) : undefined,
          actualCost: row.cost ?? undefined,
        },
      });
      imported++;
    } catch (err: any) {
      errors.push({ row: i + 1, field: "row", reason: err.message?.slice(0, 200) || "Unknown error" });
      skipped++;
    }
  }

  const importLog = await prisma.importLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      importType: "WORK_ORDERS",
      fileName,
      fileSize: file.size,
      parserUsed: parsed.parserUsed,
      totalRows: parsed.data.length,
      rowsInserted: imported,
      rowsSkipped: skipped,
      rowsFailed: errors.length,
      rowErrors: errors.length > 0 ? errors : undefined,
      status: dryRun ? "DRY_RUN" : "COMPLETE",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ imported, updated: 0, skipped, errors, warnings: [], importLogId: importLog.id, dryRun });
}, "upload");
