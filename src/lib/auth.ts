import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import logger from "./logger";
import { hydrateCurrentAuthUser, loadFreshAuthUserById } from "./auth-state";

// ── DB-backed login rate limiter ────────────────────────────────

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if the identifier (username or IP) has exceeded the rate limit.
 * Uses LoginAttempt table — survives deploys and scales across instances.
 * Also cleans up records older than 24 hours in the same call.
 */
async function checkRateLimitDB(username: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  try {
    // Cleanup old records (>24h) — fire-and-forget, don't block login
    prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }).catch(() => {});

    const failedCount = await prisma.loginAttempt.count({
      where: {
        username,
        success: false,
        createdAt: { gte: windowStart },
      },
    });

    return failedCount < RATE_LIMIT_MAX;
  } catch (err) {
    // If DB is down, allow the attempt rather than locking everyone out
    logger.warn({ err }, "Rate limit DB check failed, allowing attempt");
    return true;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const username = (credentials.username as string).toLowerCase().trim();

        // DB-backed rate limit: 5 failed attempts per 15 minutes per username
        if (!(await checkRateLimitDB(username))) {
          throw new Error("Too many login attempts. Try again in 15 minutes.");
        }

        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user || !user.passwordHash || !user.active) {
          const failReason = !user
            ? "user_not_found"
            : !user.active
              ? "inactive_user"
              : "missing_password";

          // Audit log — never let this crash the login flow
          try {
            await prisma.loginAttempt.create({
              data: {
                username,
                success: false,
                failReason,
              },
            });
          } catch {}
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);

        // Audit log — never let this crash the login flow
        try {
          await prisma.loginAttempt.create({
            data: {
              username,
              success: valid,
              failReason: valid ? null : "invalid_password",
            },
          });
        } catch {}

        if (!valid) return null;

        const authUser = await hydrateCurrentAuthUser({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId ?? null,
          managerId: user.managerId ?? null,
          onboardingComplete: user.onboardingComplete,
          active: user.active,
        });

        return {
          ...authUser,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.assignedProperties = user.assignedProperties || [];
        token.organizationId = user.organizationId || null;
        token.managerId = user.managerId || null;
        token.onboardingComplete = user.onboardingComplete ?? false;
        token.active = user.active ?? true;
      }

      // When client calls update(), or when an older token is missing the new active flag,
      // refresh the current authorization state from the database.
      if ((trigger === "update" || token.active === undefined) && token.id) {
        try {
          const fresh = await loadFreshAuthUserById(token.id as string);
          if (fresh) {
            token.onboardingComplete = fresh.onboardingComplete;
            token.role = fresh.role;
            token.assignedProperties = fresh.assignedProperties;
            token.organizationId = fresh.organizationId;
            token.managerId = fresh.managerId;
            token.active = true;
          } else {
            token.assignedProperties = [];
            token.organizationId = null;
            token.managerId = null;
            token.onboardingComplete = false;
            token.active = false;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.assignedProperties = token.assignedProperties;
      session.user.organizationId = token.organizationId || null;
      session.user.managerId = token.managerId || null;
      session.user.onboardingComplete = token.onboardingComplete ?? false;
      session.user.active = token.active ?? true;
      return session;
    },
  },
  pages: { signIn: "/login" },
};
