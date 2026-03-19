/**
 * ODK Command Center auth utilities.
 * PIN-based access, separate from NextAuth.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "crypto";

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

// ── In-memory rate limiter for PIN attempts ──
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function checkRateLimit(ip: string): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + LOCKOUT_MS });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    return { allowed: false, remainingMs: entry.resetAt - now };
  }
  return { allowed: true };
}

export function resetRateLimit(ip: string): void {
  attempts.delete(ip);
}
