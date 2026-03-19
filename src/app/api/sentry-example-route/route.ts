import { NextResponse } from "next/server";

export function GET() {
  throw new Error("Sentry server-side test error");
  return NextResponse.json({ ok: true });
}
