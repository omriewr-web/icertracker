import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

// ── In-memory login rate limiter ────────────────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= max) return false;
  record.count++;
  return true;
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

        // Rate limit: 10 attempts per 15 minutes per username
        if (!checkRateLimit(`user:${username}`, 10, 15 * 60 * 1000)) {
          throw new Error("Too many login attempts. Try again in 15 minutes.");
        }

        const user = await prisma.user.findUnique({
          where: { username },
        });

        if (!user || !user.passwordHash) {
          // Audit log — never let this crash the login flow
          try {
            await prisma.loginAttempt.create({
              data: {
                username,
                success: false,
                failReason: "user_not_found",
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

        // Load properties separately for session
        const props = await prisma.userProperty.findMany({
          where: { userId: user.id },
          select: { buildingId: true },
        });
        let properties = props.map((p) => p.buildingId);

        // Roles that inherit their manager's buildings
        const INHERITS_MANAGER = ["APM", "LEASING_SPECIALIST", "ACCOUNTING"];
        if (INHERITS_MANAGER.includes(user.role) && user.managerId) {
          const mgrProps = await prisma.userProperty.findMany({
            where: { userId: user.managerId },
            select: { buildingId: true },
          });
          properties = mgrProps.map((p) => p.buildingId);
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          assignedProperties: properties,
          organizationId: user.organizationId || null,
          managerId: user.managerId || null,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.assignedProperties = user.assignedProperties || [];
        token.organizationId = user.organizationId || null;
        token.managerId = user.managerId || null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.assignedProperties = token.assignedProperties;
      session.user.organizationId = token.organizationId || null;
      session.user.managerId = token.managerId || null;
      return session;
    },
  },
  pages: { signIn: "/login" },
};
