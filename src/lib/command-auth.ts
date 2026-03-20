/**
 * ODK Command Center auth utilities.
 * PIN-based access, separate from NextAuth.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "./prisma";
import logger from "./logger";

const COOKIE_NAME = "odk-session";
const EXPIRES_IN = "8h";

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");
  return new TextEncoder().encode(secret);
}

/** Sign a short-lived JWT for ODK access */
export async function signCommandToken(): Promise<string> {
  return new SignJWT({ scope: "odk" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(getSecret());
}

/** Verify the ODK session cookie. Returns true if valid. */
export async function verifyCommandSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, getSecret());
    return payload.scope === "odk";
  } catch {
    return false;
  }
}

/** Timing-safe PIN comparison */
export function verifyPin(input: string): boolean {
  const expected = process.env.ATLAS_COMMAND_PIN;
  if (!expected || !input) return false;
  if (input.length !== expected.length) return false;
  const a = Buffer.from(input, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  return crypto.timingSafeEqual(a, b);
}

// ── DB-backed rate limiter for PIN attempts ──
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remainingMs?: number }> {
  if (!ip || typeof ip !== "string") return { allowed: false };

  const windowStart = new Date(Date.now() - LOCKOUT_MS);

  try {
    // Cleanup old records (>24h) — fire-and-forget
    prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, username: { startsWith: "pin:" } },
    }).catch(() => {});

    const failedCount = await prisma.loginAttempt.count({
      where: {
        username: `pin:${ip}`,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    if (failedCount >= MAX_ATTEMPTS) {
      return { allowed: false, remainingMs: LOCKOUT_MS };
    }

    return { allowed: true };
  } catch (err) {
    logger.warn({ err }, "Command rate limit DB check failed, allowing attempt");
    return { allowed: true };
  }
}

export async function recordFailedPinAttempt(ip: string): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: { username: `pin:${ip}`, ipAddress: ip, success: false, failReason: "invalid_pin" },
    });
  } catch {}
}

export async function resetRateLimit(ip: string): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({
      where: { username: `pin:${ip}` },
    });
  } catch {}
}
