import { NextResponse } from "next/server";

type RunePrepEventPayload = {
  event: string;
  deckId?: string;
  partyId?: string;
  questionId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  timestamp?: string;
};

export async function POST(req: Request) {
  let payload: RunePrepEventPayload | null = null;
  try {
    payload = (await req.json()) as RunePrepEventPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const enriched = {
    ...payload,
    receivedAt: new Date().toISOString(),
  };

  console.info("[RunePrepEvent]", enriched);

  return NextResponse.json({ ok: true });
}
