import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSignalScan } from "@/lib/signals/engine";

// GET /api/cron/signals — triggered by external scheduler (Vercel Cron, etc.)
// Secured by CRON_SECRET header check
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, require it. Otherwise allow (dev mode).
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSignalScan("scheduled");
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
