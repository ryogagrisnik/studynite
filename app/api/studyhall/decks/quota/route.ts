import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { hasActiveProSession } from "@/lib/server/membership";
import { getDeckLimitSnapshot } from "@/lib/studyhall/deckLimits";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const isPro = hasActiveProSession(session);
  const hourlyMax = Math.max(1, Number(env.RATE_LIMIT_DECK_CREATE_MAX ?? "8"));
  const snapshot = await getDeckLimitSnapshot(userId, isPro, hourlyMax);

  return NextResponse.json({ ok: true, ...snapshot });
}
