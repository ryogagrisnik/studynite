// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { z } from "zod";
import prisma from "./prisma";
import { verifyPassword } from "./password";

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

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.passwordHash) {
        throw new Error("Invalid credentials");
      }

      // If the user hasn't verified via email but has an OAuth account (e.g., Google),
      // consider them verified to allow password auth and smooth provider switching.
      if (!user.emailVerified) {
        const hasOauth = await prisma.account.findFirst({ where: { userId: user.id } });
        if (!hasOauth) {
          throw new Error("Email not verified");
        }
        // Opportunistically mark as verified for consistency across the app.
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
