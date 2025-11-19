import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Verify Stripe signature: v1 signature of `${t}.${raw}` with endpoint secret
async function verifyStripeSignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  try {
    if (!header) return false;
    const parts = header.split(',').map((p) => p.trim());
    const t = parts.find((p) => p.startsWith('t='))?.slice(2);
    const v1 = parts.find((p) => p.startsWith('v1='))?.slice(3);
    if (!t || !v1) return false;
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
    const digest = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return digest === v1;
  } catch {
    return false;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });

  const ok = await verifyStripeSignature(raw, sig, secret);
  if (!ok) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 });

  let event: any;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'BAD_PAYLOAD' }, { status: 400 }); }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id as string | undefined;
        const customer = session.customer as string | undefined;
        const subscription = session.subscription as string | undefined;
        if (userId && customer) {
          await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer, stripeSubscriptionId: subscription ?? null } });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customer = sub.customer as string | undefined;
        if (customer) {
          // Find user by customer and update pro window
          const user = await prisma.user.findFirst({ where: { stripeCustomerId: customer }, select: { id: true } });
          if (user) {
            const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
            const canceled = sub.status === 'canceled' || sub.cancel_at_period_end === true;
            await prisma.user.update({
              where: { id: user.id },
              data: {
                stripeSubscriptionId: sub.id,
                proPlan: (sub.items?.data?.[0]?.plan?.nickname as string | undefined) ?? null,
                proSince: sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
                proExpiresAt: canceled ? currentPeriodEnd : (currentPeriodEnd ?? null),
              },
            });
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] error', err);
    return NextResponse.json({ received: true, error: 'PROCESSING_FAILED' }, { status: 200 });
  }
  return NextResponse.json({ received: true }, { status: 200 });
}

