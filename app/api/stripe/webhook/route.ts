import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { env } from "@/lib/env";
import { enqueueStripeEvent } from "@/lib/jobs";
import { logError } from "@/lib/logger";
import { processStripeEvent } from "@/lib/stripe";

// Verify Stripe signature: v1 signature of `${t}.${raw}` with endpoint secret
async function verifyStripeSignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  try {
    if (!header) return false;
    const parts = header.split(',').map((p) => p.trim());
    const t = parts.find((p) => p.startsWith('t='))?.slice(2);
    const v1List = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
    if (!t || v1List.length === 0) return false;
    const timestamp = Number(t);
    if (!Number.isFinite(timestamp)) return false;
    const age = Math.abs(Date.now() / 1000 - timestamp);
    if (age > 600) return false;
    const encoder = new TextEncoder();
    const data = `${t}.${raw}`;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const digestHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const digest = Buffer.from(digestHex, "hex");
    return v1List.some((signature) => {
      const provided = Buffer.from(signature, "hex");
      if (digest.length !== provided.length) return false;
      return timingSafeEqual(digest, provided);
    });
  } catch {
    return false;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });

  const ok = await verifyStripeSignature(raw, sig, secret);
  if (!ok) return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "BAD_PAYLOAD" }, { status: 400 });
  }

  try {
    await processStripeEvent(event);
  } catch (err: any) {
    logError("stripe.webhook_failed", { error: err?.message ?? String(err), eventType: event?.type });
    await enqueueStripeEvent(event);
    return NextResponse.json({ received: true, queued: true }, { status: 200 });
  }
  return NextResponse.json({ received: true }, { status: 200 });
}
