import { NextResponse } from "next/server";
import { verifyCommandSession } from "@/lib/command-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await verifyCommandSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    lastDeploy: "2026-03-18",
    testsPassing: 99,
    typescriptErrors: 0,
    liveUrl: "https://www.myatlaspm.com",
    buildPages: 32,
  });
}
