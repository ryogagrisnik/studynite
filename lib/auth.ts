// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { z } from "zod";
import { env } from "./env";
import prisma from "./prisma";
import { verifyPassword } from "./password";
import { rateLimit } from "./rateLimit";
import { track } from "@vercel/analytics/server";

export async function verifyCredentials(
  emailInput: string,
  password: string,
  options: { skipRateLimit?: boolean } = {}
) {
  const email = emailInput.toLowerCase();
  if (!options.skipRateLimit) {
    const loginMax = Math.max(1, Number(env.RATE_LIMIT_LOGIN_MAX ?? "8"));
    const rate = await rateLimit(`auth:login:${email}`, { max: loginMax, windowMs: 60_000 });
    if (!rate.ok) {
      throw new Error("Too many login attempts. Try again soon.");
    }
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.passwordHash) {
    throw new Error("Invalid credentials");
  }

  if (!user.emailVerified) {
    const hasOauth = await prisma.account.findFirst({ where: { userId: user.id } });
    if (!hasOauth) {
      throw new Error("Email not verified");
    }
    try {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    } catch {
      // non-fatal
    }
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid credentials");
  }

  return {
    id: user.id,
    email: user.email!,
    name: user.name ?? undefined,
  };
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });

      const parsed = schema.safeParse(credentials);
      if (!parsed.success) {
        throw new Error("Invalid credentials");
      }

      return verifyCredentials(parsed.data.email, parsed.data.password);
    },
  }),
];

const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleId && googleSecret) {
  providers.unshift(
    GoogleProvider({
      clientId: googleId,
      clientSecret: googleSecret,
      // Allow linking Google accounts to an existing email/password user.
      // TODO: Replace with a proper account-linking flow if you need stricter security.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,

  // ✅ Dev-only: let accounts from different providers link by the same email
  // Remove this before production or implement a proper account-linking flow.

  secret: process.env.NEXTAUTH_SECRET,

  // You’re using the Prisma Session model, so database strategy is correct
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
  },
  events: {
    async signIn({ account, isNewUser }) {
      const method = account?.provider ?? "unknown";
      const eventName = isNewUser ? "signup" : "login";
      try {
        await track(eventName, { method });
      } catch {
        // analytics failures should not block auth
      }
    },
  },

  callbacks: {
    async signIn({ user, account }) {
      // When signing in with Google, mark email as verified if not already.
      if (account?.provider === "google" && user?.id) {
        try {
          const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } });
          if (!existing?.emailVerified) {
            await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
          }
        } catch {
          // ignore; do not block sign-in
        }
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        const enriched = session.user as any;
        const u = user as any; // access Prisma fields not on AdapterUser type
        enriched.id = user.id; // expose userId to client
        enriched.emailVerified = (user as any).emailVerified;
        enriched.stripeCustomerId = u.stripeCustomerId ?? null;
        enriched.stripeSubscriptionId = u.stripeSubscriptionId ?? null;
        enriched.proPlan = u.proPlan ?? null;
        enriched.proSince = u.proSince ? new Date(u.proSince).toISOString() : null;
        enriched.proExpiresAt = u.proExpiresAt ? new Date(u.proExpiresAt).toISOString() : null;
        enriched.isPro = !!(u.proExpiresAt && new Date(u.proExpiresAt).getTime() > Date.now());
      }
      return session;
    },
  },
};
