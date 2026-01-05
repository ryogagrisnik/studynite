import { NextResponse } from "next/server";

type StudyNiteEventPayload = {
  event: string;
  deckId?: string;
  partyId?: string;
  questionId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  timestamp?: string;
};

export async function POST(req: Request) {
  let payload: StudyNiteEventPayload | null = null;
  try {
    payload = (await req.json()) as StudyNiteEventPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const enriched = {
    ...payload,
    receivedAt: new Date().toISOString(),
  };

  console.info("[StudyNiteEvent]", enriched);

  return NextResponse.json({ ok: true });
}
