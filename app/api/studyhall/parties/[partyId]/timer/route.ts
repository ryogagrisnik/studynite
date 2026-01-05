import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { clampQuestionDurationSec } from "@/lib/studyhall/timer";
import { markPartyEvent } from "@/lib/studyhall/partyEvents";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { partyId: string } }) {
  let payload: { playerToken?: string; questionDurationSec?: number } = {};
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
    select: { hostPlayerId: true, status: true },
  });

  if (!party || party.hostPlayerId !== player.id) {
    return NextResponse.json({ ok: false, error: "Host only" }, { status: 403 });
  }

  if (party.status === "COMPLETE") {
    return NextResponse.json({ ok: false, error: "Party ended" }, { status: 400 });
  }

  const durationSec = clampQuestionDurationSec(payload.questionDurationSec);

  await prisma.party.update({
    where: { id: params.partyId },
    data: { questionDurationSec: durationSec },
  });
  await markPartyEvent(params.partyId);

  return NextResponse.json({ ok: true, questionDurationSec: durationSec });
}
