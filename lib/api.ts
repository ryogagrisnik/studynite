import { NextResponse } from "next/server";

import { logError, logInfo } from "@/lib/logger";
import { getRequestIp } from "@/lib/request";

export class ApiError extends Error {
  status: number;
  code: string;
  expose: boolean;

  constructor(status: number, code: string, message: string, expose = true) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}

export function badRequest(message = "Invalid request", code = "BAD_REQUEST") {
  return new ApiError(400, code, message);
}

export function unauthorized(message = "Unauthorized", code = "UNAUTHORIZED") {
  return new ApiError(401, code, message);
}

export function notFound(message = "Not found", code = "NOT_FOUND") {
  return new ApiError(404, code, message);
}

export function tooManyRequests(message = "Too many requests", code = "RATE_LIMITED") {
  return new ApiError(429, code, message);
}

type Handler<TContext = unknown> = (req: Request, ctx: TContext & { requestId: string }) => Promise<Response>;

export function withApi<TContext = unknown>(handler: Handler<TContext>) {
  return async (req: Request, ctx: TContext) => {
    const requestId = crypto.randomUUID();
    const start = Date.now();
    try {
      const res = await handler(req, { ...ctx, requestId });
      res.headers.set("x-request-id", requestId);
      logInfo("api.request", {
        requestId,
        method: req.method,
        path: new URL(req.url).pathname,
        ip: getRequestIp(req),
        ms: Date.now() - start,
        status: res.status,
      });
      return res;
    } catch (error: any) {
      const apiError = error instanceof ApiError ? error : null;
      const status = apiError?.status ?? 500;
      const code = apiError?.code ?? "SERVER_ERROR";
      const message = apiError?.expose ? apiError.message : "Server error";
      logError("api.error", {
        requestId,
        method: req.method,
        path: new URL(req.url).pathname,
        ip: getRequestIp(req),
        ms: Date.now() - start,
        status,
        code,
        error: error?.message ?? String(error),
      });
      return NextResponse.json({ error: code, message, requestId }, { status });
    }
  };
}
