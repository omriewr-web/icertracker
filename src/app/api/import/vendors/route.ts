import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { routeParser } from "@/lib/parsers/router";
import { checkRowLimit } from "@/lib/importer/validateUpload";

export const dynamic = "force-dynamic";

const TRADE_MAP: Record<string, string> = {
  plumber: "plumbing", plumbing: "plumbing",
  electrician: "electrical", electrical: "electrical",
  carpenter: "carpentry", carpentry: "carpentry",
  super: "superintendent", superintendent: "superintendent",
  elevator: "elevator",
  boiler: "boiler",
  general_contractor: "general", "general contractor": "general",
  other: "other",
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

  const rowLimitError = checkRowLimit(parsed.data.length);
  if (rowLimitError) return rowLimitError;

  const orgId = user.organizationId;

  let imported = 0, updated = 0, skipped = 0;
  const errors: { row: number; field: string; reason: string }[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, any>;
    const companyName = String(row.companyName || "").trim();

    if (!companyName) {
      errors.push({ row: i + 1, field: "companyName", reason: "Company name is required" });
      skipped++;
      continue;
    }

    if (dryRun) {
      const existing = await prisma.vendor.findFirst({
        where: { organizationId: orgId, name: { equals: companyName, mode: "insensitive" } },
      });
      if (existing) updated++;
      else imported++;
      continue;
    }

    try {
      const existing = await prisma.vendor.findFirst({
        where: { organizationId: orgId, name: { equals: companyName, mode: "insensitive" } },
      });

      const trade = TRADE_MAP[(row.trade || "").toLowerCase()] || row.trade || undefined;

      if (existing) {
        await prisma.vendor.update({
          where: { id: existing.id },
          data: {
            company: row.contactName ? companyName : existing.company,
            name: row.contactName || existing.name,
            phone: row.phone || existing.phone,
            email: row.email || existing.email,
            specialty: trade || existing.specialty,
            notes: row.notes || existing.notes,
          },
        });
        updated++;
      } else {
        await prisma.vendor.create({
          data: {
            organizationId: orgId,
            name: row.contactName || companyName,
            company: companyName,
            phone: row.phone || undefined,
            email: row.email || undefined,
            specialty: trade || undefined,
            notes: row.notes || undefined,
          },
        });
        imported++;
      }
    } catch (err: any) {
      errors.push({ row: i + 1, field: "row", reason: err.message?.slice(0, 200) || "Unknown error" });
      skipped++;
    }
  }

  const importLog = await prisma.importLog.create({
    data: {
      organizationId: orgId,
      userId: user.id,
      importType: "VENDORS",
      fileName,
      fileSize: file.size,
      parserUsed: parsed.parserUsed,
      totalRows: parsed.data.length,
      rowsInserted: imported,
      rowsUpdated: updated,
      rowsSkipped: skipped,
      rowsFailed: errors.length,
      rowErrors: errors.length > 0 ? errors : undefined,
      status: dryRun ? "DRY_RUN" : "COMPLETE",
      completedAt: new Date(),
    },
  });

  return NextResponse.json({ imported, updated, skipped, errors, warnings: [], importLogId: importLog.id, dryRun });
}, "upload");
