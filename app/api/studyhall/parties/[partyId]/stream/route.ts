import { buildPartyState } from "@/lib/studyhall/partyState";
import { getPartyEventStamp } from "@/lib/studyhall/partyEvents";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { partyId: string } }) {
  const { searchParams } = new URL(req.url);
  const playerToken = searchParams.get("playerToken") || "";
  const encoder = new TextEncoder();

  let interval: ReturnType<typeof setInterval> | undefined;
  let lastEventStamp = 0;
  let lastSentAt = 0;
  const EVENT_CHECK_MS = 2000;
  const HEARTBEAT_MS = 15_000;

  const stream = new ReadableStream({
    start(controller) {
      const sendState = async () => {
        try {
          const result = await buildPartyState(params.partyId, playerToken);
          if (!result.ok) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify(result)}\n\n`));
            return;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(result.data)}\n\n`));
          lastSentAt = Date.now();
        } catch (error) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ ok: false })}\n\n`));
        }
      };

      const tick = async () => {
        const now = Date.now();
        try {
          const stamp = await getPartyEventStamp(params.partyId);
          if (stamp !== lastEventStamp) {
            lastEventStamp = stamp;
            await sendState();
            return;
          }
        } catch {
          // ignore stamp issues; heartbeat will keep the stream alive
        }
        if (now - lastSentAt >= HEARTBEAT_MS) {
          await sendState();
        }
      };

      const start = async () => {
        lastEventStamp = await getPartyEventStamp(params.partyId);
        await sendState();
        interval = setInterval(() => {
          void tick();
        }, EVENT_CHECK_MS);
      };

      void start();
      req.signal.addEventListener("abort", () => {
        if (interval) clearInterval(interval);
      });
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
