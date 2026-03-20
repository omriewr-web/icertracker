import { NextRequest, NextResponse } from "next/server";
import { verifyPin, signCommandToken, checkRateLimit, resetRateLimit, recordFailedPinAttempt } from "@/lib/command-auth";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed, remainingMs } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later.", retryAfterMs: remainingMs },
      { status: 429 }
    );
  }

  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.pin || typeof body.pin !== "string") {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }

  if (!verifyPin(body.pin)) {
    await recordFailedPinAttempt(ip);
    return NextResponse.json({ error: "Access denied" }, { status: 401 });
  }

  // Correct PIN — reset rate limit and issue token
  await resetRateLimit(ip);
  const token = await signCommandToken();

  const response = NextResponse.json({ success: true });
  response.cookies.set("odk-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 8 * 60 * 60,
    path: "/",
  });

  return response;
}
