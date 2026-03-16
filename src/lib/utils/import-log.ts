import { prisma } from "@/lib/prisma";

interface ImportLogStart {
  userId: string;
  organizationId?: string | null;
  importType: string;
  fileName?: string;
}

interface ImportLogComplete {
  rowsInserted?: number;
  rowsUpdated?: number;
  rowsFailed?: number;
  rowErrors?: string[];
}

export async function startImportLog(data: ImportLogStart): Promise<string | null> {
  try {
    const log = await prisma.importLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId ?? null,
        importType: data.importType,
        fileName: data.fileName ?? null,
        status: "RUNNING",
      },
    });
    return log.id;
  } catch {
    return null;
  }
}

export async function completeImportLog(
  id: string | null,
  status: "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED",
  data?: ImportLogComplete,
): Promise<void> {
  if (!id) return;
  try {
    await prisma.importLog.update({
      where: { id },
      data: {
        status,
        completedAt: new Date(),
        rowsInserted: data?.rowsInserted ?? 0,
        rowsUpdated: data?.rowsUpdated ?? 0,
        rowsFailed: data?.rowsFailed ?? 0,
        rowErrors: data?.rowErrors?.length ? data.rowErrors : undefined,
      },
    });
  } catch {}
}
