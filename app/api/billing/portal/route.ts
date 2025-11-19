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

async function stripeCreatePortalSession(params: Record<string,string>, secret: string) {
  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`stripe portal failed: ${text}`);
  }
  return res.json();
}

export async function POST(){
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: 'STRIPE_NOT_CONFIGURED' }, { status: 503 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) return NextResponse.json({ error: 'NO_CUSTOMER' }, { status: 400 });

  const base = getAppBaseUrl().replace(/\/$/, '');
  const out = await stripeCreatePortalSession({ customer: user.stripeCustomerId, return_url: `${base}/dashboard` }, secret);
  return NextResponse.json({ url: out.url }, { status: 200 });
}

