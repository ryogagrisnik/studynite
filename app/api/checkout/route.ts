import { NextResponse } from 'next/server';
export async function POST(){
  return new NextResponse(JSON.stringify({ message: 'Payments coming soon. Add Stripe keys to enable.' }), { status: 501, headers:{'content-type':'application/json'} });
}
