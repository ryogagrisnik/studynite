import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function GET() {
  const started = Date.now();
  const out: any = { ok: true, time: new Date().toISOString(), uptime: process.uptime() };
  // DB ping
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    out.db = { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    out.ok = false;
    out.db = { ok: false, error: e?.message ?? String(e) };
  }
  // Redis ping (if configured)
  try {
    if (redis.raw) {
      const t1 = Date.now();
      // Upstash REST has no direct ping; a light GET is fine
      await redis.set("health:last", out.time);
      out.redis = { ok: true, ms: Date.now() - t1 };
    } else {
      out.redis = { ok: true, ms: 0, note: "in-memory" };
    }
  } catch (e: any) {
    out.ok = false;
    out.redis = { ok: false, error: e?.message ?? String(e) };
  }
  out.ms = Date.now() - started;
  return NextResponse.json(out, { status: out.ok ? 200 : 503 });
}
