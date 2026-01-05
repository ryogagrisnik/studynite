import { NextResponse } from "next/server";

import { withApi } from "@/lib/api";
import { env } from "@/lib/env";
import { drainJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export const POST = withApi(async (req: Request) => {
  const secret = env.JOBS_DRAIN_SECRET;
  const provided = req.headers.get("x-job-secret") || "";
  if (secret && provided !== secret) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!secret && env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "DRAIN_SECRET_REQUIRED" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body?.limit === "number" ? Math.max(1, Math.floor(body.limit)) : 15;
  const results = await drainJobs(limit);
  return NextResponse.json({ ok: true, ...results }, { status: 200 });
});
