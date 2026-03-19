import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-helpers";
import { getOrgScope } from "@/lib/data-scope";
import { runSignalScan } from "@/lib/signals/engine";
import type { UserRole } from "@/types";

export const dynamic = "force-dynamic";

const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "ACCOUNT_ADMIN"];

// GET /api/signals — list signals with filters, scoped by building access
export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const severity = url.searchParams.get("severity");
  const type = url.searchParams.get("type");
  const buildingId = url.searchParams.get("buildingId");
  const status = url.searchParams.get("status") || "active";

  const orgScope = getOrgScope(user);
  const where: any = { ...orgScope };
  if (status !== "all") {
    where.status = status;
  }
  if (severity) where.severity = severity;
  if (type) where.type = type;
  if (buildingId) where.buildingId = buildingId;

  // Scope by building access for non-admin users
  if (!ADMIN_ROLES.includes(user.role as UserRole)) {
    const assigned = user.assignedProperties ?? [];
    if (assigned.length === 0) {
      return NextResponse.json({ signals: [], counts: { critical: 0, high: 0, medium: 0, low: 0, total: 0 } });
    }
    where.buildingId = { in: assigned };
  }

  const signals = await prisma.operationalSignal.findMany({
    where,
    orderBy: [
      { severity: "asc" },
      { lastTriggeredAt: "desc" },
    ],
    take: 200,
  });

  // Re-sort by severity priority (critical > high > medium > low)
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  signals.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  // Summary counts
  const counts = {
    critical: signals.filter((s) => s.severity === "critical").length,
    high: signals.filter((s) => s.severity === "high").length,
    medium: signals.filter((s) => s.severity === "medium").length,
    low: signals.filter((s) => s.severity === "low").length,
    total: signals.length,
  };

  // Fetch last scan log
  const lastScan = await prisma.signalScanLog.findFirst({
    where: orgScope,
    orderBy: { startedAt: "desc" },
    select: {
      scanType: true,
      startedAt: true,
      completedAt: true,
      durationMs: true,
      success: true,
      errorMessage: true,
      createdSignals: true,
      updatedSignals: true,
      resolvedSignals: true,
    },
  });

  return NextResponse.json({ signals, counts, lastScan });
}, "dash");

// POST /api/signals — trigger a scan (admin only)
export const POST = withAuth(async (req, { user }) => {
  if (!ADMIN_ROLES.includes(user.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await runSignalScan("manual", user.id);
  return NextResponse.json(result);
}, "dash");
