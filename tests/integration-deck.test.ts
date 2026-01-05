import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import prisma from "@/lib/prisma";
import { POST as createDeck } from "@/app/api/studyhall/decks/route";

process.env.NODE_ENV = "test";

if (!process.env.DATABASE_URL) {
  console.warn("[tests] DATABASE_URL missing; skipping deck integration test.");
} else {
  const run = async () => {
    const email = `deck-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { email, name: "Deck Tester" },
      select: { id: true },
    });

    const form = new FormData();
    form.append("title", "Test Deck");
    form.append("text", "Supply increases when costs fall.");
    form.append("includeQuestions", "true");
    form.append("includeFlashcards", "true");
    form.append("questionCount", "5");
    form.append("flashcardCount", "5");

    const req = new Request("http://localhost/api/studyhall/decks", {
      method: "POST",
      body: form,
      headers: {
        "x-test-user-id": user.id,
        "x-test-mode": "1",
      },
    });

    const res = await createDeck(req);
    const data = await res.json();
    assert.equal(res.status, 200, "deck creation should succeed");
    assert.equal(data.ok, true, "deck creation response should be ok");
    assert.ok(data.deckId, "deckId should be returned");

    const deck = await prisma.studyDeck.findUnique({
      where: { id: data.deckId },
      include: { questions: true, flashcards: true },
    });
    assert.ok(deck, "deck should be persisted");
    assert.equal(deck?.questions.length, 5, "questions should be created");
    assert.equal(deck?.flashcards.length, 5, "flashcards should be created");

    await prisma.user.deleteMany({ where: { id: user.id } });
  };

  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
