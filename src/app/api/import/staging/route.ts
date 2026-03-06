import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { commitRentRollImport } from "@/lib/importer/commit";

// GET /api/import/staging — list staging batches
export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const id = url.searchParams.get("id");

  if (id) {
    const batch = await prisma.importStagingBatch.findUnique({ where: { id } });
    if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(batch);
  }

  const where = status && status !== "all" ? { status } : {};
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

  // Approve: commit using shared handler
  const importBatch = await prisma.importBatch.create({
    data: { filename: batch.fileName, format: "staged", recordCount: 0, status: "processing" },
  });

  const rows = batch.rowsJson as any[];
  const { imported, skipped, errors } = await commitRentRollImport(rows, {
    importBatchId: importBatch.id,
    userId: user.id,
  });

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

  return NextResponse.json({
    success: true, status: "approved",
    imported, skipped, errors, batchId: importBatch.id,
  });
});
