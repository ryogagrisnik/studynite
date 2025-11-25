import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchSubscription(subId: string, secret: string) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeSubscriptionId: true, stripeCustomerId: true },
  });
  if (!user?.stripeSubscriptionId) {
    return NextResponse.json({ error: "NO_SUBSCRIPTION" }, { status: 400 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });

  const sub = await fetchSubscription(user.stripeSubscriptionId, secret);
  if (!sub) return NextResponse.json({ error: "SUB_FETCH_FAILED" }, { status: 502 });

  const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const canceled = sub.status === "canceled" || sub.cancel_at_period_end === true;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: sub.customer as string | undefined,
      proPlan: (sub.items?.data?.[0]?.plan?.nickname as string | undefined) ?? null,
      proSince: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
      proExpiresAt: canceled ? currentPeriodEnd : currentPeriodEnd ?? null,
    },
    select: {
      email: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      proPlan: true,
      proSince: true,
      proExpiresAt: true,
    },
  });

  return NextResponse.json({ user: updated, subscription: sub });
}
