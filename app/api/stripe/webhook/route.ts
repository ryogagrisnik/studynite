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

async function fetchStripeSubscription(id: string, secret: string) {
  if (!secret) return null;
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[stripe webhook] failed to fetch subscription', id, text);
    return null;
  }
  return res.json();
}

async function fetchStripeCustomer(id: string, secret: string) {
  if (!secret) return null;
  const res = await fetch(`https://api.stripe.com/v1/customers/${id}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[stripe webhook] failed to fetch customer', id, text);
    return null;
  }
  return res.json();
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
          const updateData: Record<string, any> = {
            stripeCustomerId: customer,
            stripeSubscriptionId: subscription ?? null,
          };
          const secretKey = process.env.STRIPE_SECRET_KEY;
          if (subscription && secretKey) {
            const sub = await fetchStripeSubscription(subscription, secretKey);
            if (sub) {
              const now = new Date();
              const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : now;
              const currentPeriodEnd = sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
              const canceled = sub.status === 'canceled' || sub.cancel_at_period_end === true;
              updateData.proPlan =
                (sub.items?.data?.[0]?.plan?.nickname as string | undefined) ||
                (sub.items?.data?.[0]?.price?.id as string | undefined) ||
                null;
              updateData.proSince = currentPeriodStart;
              updateData.proExpiresAt = canceled ? currentPeriodEnd : currentPeriodEnd ?? null;
            }
          }
          await prisma.user.update({ where: { id: userId }, data: updateData });
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
          let user = await prisma.user.findFirst({ where: { stripeCustomerId: customer }, select: { id: true, email: true } });

          // If we don't have a user for this customer yet, try matching by email
          if (!user) {
            const secretKey = process.env.STRIPE_SECRET_KEY;
            if (secretKey) {
              const customerObj = await fetchStripeCustomer(customer, secretKey);
              const email = (customerObj?.email as string | undefined)?.toLowerCase();
              if (email) {
                const matched = await prisma.user.findFirst({
                  where: { email },
                  select: { id: true, email: true },
                });
                if (matched) {
                  user = matched;
                  await prisma.user.update({
                    where: { id: matched.id },
                    data: { stripeCustomerId: customer },
                  });
                }
              }
            }
          }

          if (user) {
            const now = new Date();
            const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : now;
            const currentPeriodEnd = sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const canceled = sub.status === 'canceled' || sub.cancel_at_period_end === true;
            await prisma.user.update({
              where: { id: user.id },
              data: {
                stripeSubscriptionId: sub.id,
                proPlan:
                  (sub.items?.data?.[0]?.plan?.nickname as string | undefined) ||
                  (sub.items?.data?.[0]?.price?.id as string | undefined) ||
                  null,
                proSince: currentPeriodStart,
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
