import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { commitRentRollImport } from "@/lib/importer/commit";
import { startImportLog, completeImportLog } from "@/lib/utils/import-log";

export const dynamic = "force-dynamic";

// GET /api/import/staging — list staging batches (scoped to user's org)
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const id = url.searchParams.get("id");

  if (id) {
    const batch = await prisma.importStagingBatch.findUnique({ where: { id } });
    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Verify batch belongs to user's org by checking the uploader
    if (user.role !== "SUPER_ADMIN" && batch.uploadedById) {
      const uploader = await prisma.user.findUnique({ where: { id: batch.uploadedById }, select: { organizationId: true } });
      if (uploader && uploader.organizationId !== user.organizationId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
    return NextResponse.json(batch);
  }

  // Scope to batches uploaded by users in the same org
  const orgUserIds = user.role === "SUPER_ADMIN" ? undefined : (
    await prisma.user.findMany({ where: { organizationId: user.organizationId }, select: { id: true } })
  ).map((u) => u.id);

  const where: Record<string, unknown> = status && status !== "all" ? { status } : {};
  if (orgUserIds) {
    where.uploadedById = { in: orgUserIds };
  }

  const batches = await prisma.importStagingBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, importType: true, fileName: true, uploadedById: true,
      status: true, summaryJson: true, reviewedById: true, reviewedAt: true,
      reviewNotes: true, importBatchId: true, createdAt: true,
    },
  });
  return NextResponse.json(batches);
}, "upload");

// POST /api/import/staging — approve or reject a staging batch
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const body = await req.json();
  const { id, action, notes } = body as { id: string; action: "approve" | "reject"; notes?: string };

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const batch = await prisma.importStagingBatch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Verify batch belongs to user's org
  if (user.role !== "SUPER_ADMIN" && batch.uploadedById) {
    const uploader = await prisma.user.findUnique({ where: { id: batch.uploadedById }, select: { organizationId: true } });
    if (uploader && uploader.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
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

  // Approve: commit using shared handler
  const importBatch = await prisma.importBatch.create({
    data: { filename: batch.fileName, format: "staged", recordCount: 0, status: "processing" },
  });

  const logId = await startImportLog({ userId: user.id, organizationId: user.organizationId, importType: "staged-approval", fileName: batch.fileName });

  const rows = batch.rowsJson as any[];

  let imported = 0;
  let skipped = 0;
  let errors: string[] = [];

  try {
    const result = await commitRentRollImport(rows, {
      importBatchId: importBatch.id,
      userId: user.id,
      organizationId: user.organizationId,
    });
    imported = result.imported;
    skipped = result.skipped;
    errors = result.errors;

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
        status: "approved", reviewedById: user.id,
        reviewedAt: new Date(), reviewNotes: notes,
        importBatchId: importBatch.id,
      },
    });

    await completeImportLog(logId, errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED", { rowsInserted: imported, rowsFailed: skipped, rowErrors: errors });
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: { status: "failed", errors: [err instanceof Error ? err.message : "Unknown error"] },
    });

    await prisma.importStagingBatch.update({
      where: { id },
      data: { status: "failed", reviewedById: user.id, reviewedAt: new Date(), reviewNotes: notes },
    });

    await completeImportLog(logId, "FAILED", { rowErrors: [err instanceof Error ? err.message : "Unknown error"] });
    return NextResponse.json({ error: "Import failed", detail: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }

  return NextResponse.json({
    success: true, status: "approved",
    imported, skipped, errors, batchId: importBatch.id,
  });
}, "upload");
