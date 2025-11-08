import { NextResponse } from 'next/server';

type PracticeEventPayload = {
  exam?: string;
  section?: string;
  mode?: string;
  topic?: string | null;
  questionId?: string | number | null;
  result?: string;
  message?: string | null;
  timestamp?: string;
  source?: string;
};

export async function POST(req: Request) {
  let payload: PracticeEventPayload | null = null;
  try {
    payload = (await req.json()) as PracticeEventPayload;
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: 'Invalid payload' },
      { status: 400 },
    );
  }

  const enriched = {
    ...payload,
    receivedAt: new Date().toISOString(),
  };

  console.info('[PracticeEvent]', enriched);

  return NextResponse.json({ ok: true });
}
