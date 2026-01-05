import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { markPartyEvent } from "@/lib/studyhall/partyEvents";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { partyId: string } }) {
  let payload: { playerToken?: string; playerId?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.playerToken || !payload.playerId) {
    return NextResponse.json({ ok: false, error: "Missing data" }, { status: 400 });
  }

  const player = await prisma.partyPlayer.findUnique({
    where: { playerToken: payload.playerToken },
  });

  if (!player || player.partyId !== params.partyId) {
    return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });
  }

  const party = await prisma.party.findUnique({
    where: { id: params.partyId },
    select: { hostPlayerId: true, status: true },
  });

  if (!party || party.hostPlayerId !== player.id) {
    return NextResponse.json({ ok: false, error: "Host only" }, { status: 403 });
  }

  if (party.status === "COMPLETE") {
    return NextResponse.json({ ok: false, error: "Party ended" }, { status: 400 });
  }

  if (payload.playerId === party.hostPlayerId) {
    return NextResponse.json({ ok: false, error: "Cannot remove the host" }, { status: 400 });
  }

  const target = await prisma.partyPlayer.findUnique({
    where: { id: payload.playerId },
  });

  if (!target || target.partyId !== params.partyId) {
    return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });
  }

  if (target.kickedAt) {
    return NextResponse.json({ ok: true });
  }

  await prisma.partyPlayer.update({
    where: { id: target.id },
    data: { kickedAt: new Date(), leftAt: new Date() },
  });
  await markPartyEvent(params.partyId);

  return NextResponse.json({ ok: true });
}
