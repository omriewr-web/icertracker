import { NextResponse } from "next/server";
import { verifyCommandSession } from "@/lib/command-auth";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await verifyCommandSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const filePath = path.join(process.cwd(), "docs", "TRACKER.md");
    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
