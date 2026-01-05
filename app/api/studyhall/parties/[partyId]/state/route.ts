import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { buildPartyState } from "@/lib/studyhall/partyState";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { partyId: string } }) {
  await prisma.party.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const { searchParams } = new URL(req.url);
  const playerToken = searchParams.get("playerToken") || "";

  const result = await buildPartyState(params.partyId, playerToken);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
