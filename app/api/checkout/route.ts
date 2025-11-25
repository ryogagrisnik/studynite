import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getAppBaseUrl } from '@/lib/urls';

function form(body: Record<string, string>): string {
  return Object.entries(body)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function stripeCreateCheckoutSession(params: Record<string,string>, secret: string) {
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`stripe session failed: ${text}`);
  }
  return res.json();
}

export async function POST(req: Request){
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const email = (session?.user as any)?.email as string | undefined;
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const secret = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_ID_YEARLY;
  if (!secret || !price) return NextResponse.json({ error: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });

  const base = getAppBaseUrl().replace(/\/$/, '');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  const stripeCustomerId = user?.stripeCustomerId || undefined;

  const params: Record<string,string> = {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: `${base}/dashboard?upgraded=1`,
    cancel_url: `${base}/pricing?canceled=1`,
    client_reference_id: userId,
    allow_promotion_codes: 'true',
  };
  if (stripeCustomerId) params.customer = stripeCustomerId;
  else if (email) params.customer_email = email;

  const out = await stripeCreateCheckoutSession(params, secret);

  const acceptHeader = req.headers.get('accept')?.toLowerCase() ?? '';
  const contentType = req.headers.get('content-type')?.toLowerCase() ?? '';
  const wantsJSON =
    contentType.includes('application/json') ||
    acceptHeader === 'application/json' ||
    acceptHeader.startsWith('application/json,');

  if (wantsJSON) {
    return NextResponse.json({ url: out.url }, { status: 200 });
  }
  return NextResponse.redirect(out.url, { status: 303 });
}
