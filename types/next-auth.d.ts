import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: (DefaultSession["user"] & {
      id: string;
      emailVerified?: string | Date | null;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      proPlan?: string | null;
      proSince?: string | Date | null;
      proExpiresAt?: string | Date | null;
      isPro?: boolean;
    }) | null;
  }

  interface User {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    proPlan?: string | null;
    proSince?: Date | null;
    proExpiresAt?: Date | null;
  }
}

