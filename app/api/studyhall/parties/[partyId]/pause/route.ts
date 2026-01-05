import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { markPartyEvent } from "@/lib/studyhall/partyEvents";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { partyId: string } }) {
  let payload: { playerToken?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.playerToken) {
    return NextResponse.json({ ok: false, error: "Missing player token" }, { status: 400 });
  }

  const player = await prisma.partyPlayer.findUnique({
    where: { playerToken: payload.playerToken },
  });

  if (!player || player.partyId !== params.partyId) {
    return NextResponse.json({ ok: false, error: "Player not found" }, { status: 404 });
  }

  const party = await prisma.party.findUnique({
    where: { id: params.partyId },
    select: { hostPlayerId: true, status: true, mode: true, pauseStartedAt: true },
  });

  if (!party || party.hostPlayerId !== player.id) {
    return NextResponse.json({ ok: false, error: "Host only" }, { status: 403 });
  }

  if (party.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "Party not active" }, { status: 400 });
  }

  if (party.mode !== "QUIZ") {
    return NextResponse.json({ ok: false, error: "Pause is only for quiz parties" }, { status: 400 });
  }

  if (party.pauseStartedAt) {
    return NextResponse.json({ ok: true });
  }

  await prisma.party.update({
    where: { id: params.partyId },
    data: { pauseStartedAt: new Date() },
  });
  await markPartyEvent(params.partyId);

  return NextResponse.json({ ok: true });
}
