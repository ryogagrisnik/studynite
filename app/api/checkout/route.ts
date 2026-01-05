import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { withApi } from "@/lib/api";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import prisma from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/urls";

function form(body: Record<string, string>): string {
  return Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function stripeCreateCheckoutSession(params: Record<string,string>, secret: string) {
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`stripe session failed: ${text}`);
  }
  return res.json();
}

const payloadSchema = z.object({
  plan: z.enum(["monthly", "yearly"]).optional(),
});

async function readPayload(req: Request) {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return await req.json().catch(() => ({}));
  }
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await req.formData().catch(() => null);
    if (!formData) return {};
    return { plan: formData.get("plan")?.toString() };
  }
  return {};
}

export const POST = withApi(async (req: Request) => {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const email = (session?.user as any)?.email as string | undefined;
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const secret = env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });

  const payload = payloadSchema.safeParse(await readPayload(req));
  if (!payload.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const plan = payload.data.plan;
  const monthly = env.STRIPE_PRICE_ID_MONTHLY;
  const yearly = env.STRIPE_PRICE_ID_YEARLY;
  const price =
    plan === "yearly"
      ? yearly
      : plan === "monthly"
      ? monthly
      : monthly || yearly;
  if (!price) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });

  const base = getAppBaseUrl().replace(/\/$/, "");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, proExpiresAt: true },
  });
  if (user?.proExpiresAt && user.proExpiresAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "ALREADY_PRO" }, { status: 409 });
  }
  const stripeCustomerId = user?.stripeCustomerId || undefined;

  const params: Record<string,string> = {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${base}/dashboard?upgraded=1`,
    cancel_url: `${base}/pricing?canceled=1`,
    client_reference_id: userId,
    allow_promotion_codes: "true",
  };
  if (stripeCustomerId) params.customer = stripeCustomerId;
  else if (email) params.customer_email = email;

  const out = await stripeCreateCheckoutSession(params, secret);

  const acceptHeader = req.headers.get("accept")?.toLowerCase() ?? "";
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  const wantsJSON =
    contentType.includes("application/json") ||
    acceptHeader === "application/json" ||
    acceptHeader.startsWith("application/json,");

  if (wantsJSON) {
    return NextResponse.json({ url: out.url }, { status: 200 });
  }
  return NextResponse.redirect(out.url, { status: 303 });
});
