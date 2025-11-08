// app/api/submit-answer/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    await req.json().catch(() => ({}));
    // TODO: persist if desired
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 200 });
  }
}
