import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import prisma from "@/lib/prisma";
import { POST as joinParty } from "@/app/api/studyhall/parties/join/route";

process.env.NODE_ENV = "test";

if (!process.env.DATABASE_URL) {
  console.warn("[tests] DATABASE_URL missing; skipping party integration test.");
} else {
  const run = async () => {
    const email = `party-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { email, name: "Party Host" },
      select: { id: true },
    });

    const deck = await prisma.studyDeck.create({
      data: {
        userId: user.id,
        title: "Party Deck",
        description: "Deck for party tests",
        shareId: `share_${randomUUID()}`,
      },
      select: { id: true },
    });

    const joinCode = "TEST01";
    await prisma.party.deleteMany({ where: { joinCode } });
    const party = await prisma.party.create({
      data: {
        deckId: deck.id,
        joinCode,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        hostUserId: user.id,
      },
      select: { id: true },
    });

    const req = new Request("http://localhost/api/studyhall/parties/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: joinCode, name: "Guest Player" }),
    });

    const res = await joinParty(req);
    const data = await res.json();
    assert.equal(res.status, 200, "join should succeed");
    assert.equal(data.ok, true, "join response should be ok");
    assert.ok(data.player?.playerToken, "player token should be returned");

    const player = await prisma.partyPlayer.findFirst({
      where: { partyId: party.id, name: "Guest Player" },
      select: { id: true },
    });
    assert.ok(player?.id, "party player should be created");

    await prisma.partyPlayer.deleteMany({ where: { partyId: party.id } });
    await prisma.party.deleteMany({ where: { id: party.id } });
    await prisma.studyDeck.deleteMany({ where: { id: deck.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  };

  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
