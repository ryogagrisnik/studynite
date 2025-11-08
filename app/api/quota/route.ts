import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  PRACTICE_LIMIT,
  resolvePracticeUser,
  getQuotaState,
  quotaMeta,
} from "@/lib/server/practiceAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const cookieStore = cookies();
  const { userId, isUnlimited } = resolvePracticeUser(session, cookieStore);
  const quotaState = await getQuotaState(userId);
  const meta = quotaMeta(quotaState, isUnlimited);
  return NextResponse.json({
    limit: meta.limit ?? PRACTICE_LIMIT,
    used: meta.used,
    isUnlimited: meta.isUnlimited,
    nextUnlockAt: meta.nextUnlockAt,
  });
}
