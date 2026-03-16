// Public endpoint — tenant-facing work order request portal.
// Excluded from auth middleware intentionally so tenants can submit
// maintenance requests without an AtlasPM account.
// Protected by: building token (GET) + rate limiting (POST) + honeypot field (POST).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tenantRequestSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

// ── Upstash Redis rate limiter (lazy-initialized on first request) ──
let _upstashRatelimit: any = undefined; // undefined = not yet initialized

function getUpstashRatelimit() {
  if (_upstashRatelimit !== undefined) return _upstashRatelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || url === "XXXXXXXX") {
    _upstashRatelimit = null;
    return null;
  }

  try {
    const { Ratelimit } = require("@upstash/ratelimit");
    const { Redis } = require("@upstash/redis");

    _upstashRatelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      analytics: false,
      prefix: "atlaspm:ratelimit",
    });
  } catch {
    _upstashRatelimit = null;
  }

  return _upstashRatelimit;
}

// ── In-memory fallback rate limiter (resets on deploy) ──────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimitedInMemory(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

let lastCleanup = Date.now();
function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < 10 * 60 * 1000) return;
  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // ── Rate limit check ──
    const ratelimiter = getUpstashRatelimit();
    if (ratelimiter) {
      try {
        const { success, limit, remaining, reset } = await ratelimiter.limit(ip);
        if (!success) {
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": limit.toString(),
                "X-RateLimit-Remaining": remaining.toString(),
                "X-RateLimit-Reset": reset.toString(),
                "Retry-After": Math.max(1, Math.floor((reset - Date.now()) / 1000)).toString(),
              },
            },
          );
        }
      } catch {
        // Upstash call failed — fall through to in-memory
        cleanupStaleEntries();
        if (isRateLimitedInMemory(ip)) {
          return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 },
          );
        }
      }
    } else {
      cleanupStaleEntries();
      if (isRateLimitedInMemory(ip)) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 },
        );
      }
    }

    const body = await req.json();

    // Honeypot: if a hidden "website" field is filled in, it's a bot
    if (body.website) {
      // Silently accept to not tip off bots, but don't create anything
      return NextResponse.json({ success: true, id: "ok" }, { status: 201 });
    }

    const data = tenantRequestSchema.parse(body);

    // Verify building token matches
    const building = await prisma.building.findUnique({
      where: { id: data.buildingId },
      select: { publicAccessToken: true },
    });
    if (!building || !building.publicAccessToken || building.publicAccessToken !== data.token) {
      return NextResponse.json({ error: "Invalid building token" }, { status: 403 });
    }

    const wo = await prisma.workOrder.create({
      data: {
        title: data.title,
        description: `${data.description}\n\n---\nSubmitted by: ${data.tenantName}\nContact: ${data.tenantContact}`,
        status: "PENDING_REVIEW",
        priority: data.priority as any,
        category: data.category as any,
        photos: data.photos ?? undefined,
        buildingId: data.buildingId,
        unitId: data.unitId || null,
      },
    });

    return NextResponse.json({ success: true, id: wo.id }, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("Request portal error:", error);
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}

// Public GET to fetch a single building's units for the request form.
// Requires a valid building token to prevent enumeration of all buildings.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const building = await prisma.building.findUnique({
    where: { publicAccessToken: token },
    select: {
      id: true,
      address: true,
      units: { select: { id: true, unitNumber: true }, orderBy: { unitNumber: "asc" } },
    },
  });

  if (!building) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  return NextResponse.json([building]);
}
