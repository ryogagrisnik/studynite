import { randomUUID } from "crypto";

import { sendEmail, type SendEmailOptions } from "@/lib/email";
import { logError, logInfo, logWarn } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { processStripeEvent } from "@/lib/stripe";

type JobType = "email" | "stripe_event";

type JobPayload = {
  email: SendEmailOptions;
  stripe_event: { event: any };
};

type JobRecord<T extends JobType> = {
  id: string;
  type: T;
  payload: JobPayload[T];
  attempt: number;
  maxAttempts: number;
  nextRunAt: number;
  createdAt: number;
  lastError?: string;
};

const PENDING_KEY = "jobs:pending";
const DEAD_KEY = "jobs:dead";

function backoffMs(attempt: number) {
  const base = 30_000;
  const max = 15 * 60_000;
  return Math.min(base * Math.pow(2, Math.max(0, attempt - 1)), max);
}

async function enqueueJob<T extends JobType>(
  type: T,
  payload: JobPayload[T],
  maxAttempts = 5
) {
  const job: JobRecord<T> = {
    id: randomUUID(),
    type,
    payload,
    attempt: 0,
    maxAttempts,
    nextRunAt: Date.now(),
    createdAt: Date.now(),
  };
  await redis.rpush(PENDING_KEY, JSON.stringify(job));
  logInfo("job.enqueued", { type, id: job.id });
}

export async function sendEmailWithRetry(options: SendEmailOptions) {
  try {
    await sendEmail(options);
  } catch (error: any) {
    logWarn("email.send_failed", { error: error?.message ?? String(error), to: options.to });
    await enqueueJob("email", options, 5);
  }
}

export async function enqueueStripeEvent(event: any) {
  await enqueueJob("stripe_event", { event }, 6);
}

async function processJob(job: JobRecord<JobType>) {
  if (job.type === "email") {
    await sendEmail(job.payload);
    return;
  }
  if (job.type === "stripe_event") {
    await processStripeEvent(job.payload.event);
    return;
  }
  throw new Error(`Unknown job type: ${(job as any).type}`);
}

export async function drainJobs(limit = 15) {
  const results = {
    processed: 0,
    retried: 0,
    dead: 0,
    skipped: 0,
  };
  for (let i = 0; i < limit; i += 1) {
    const raw = await redis.lpop(PENDING_KEY);
    if (!raw) break;

    let job: JobRecord<JobType> | null = null;
    try {
      job = JSON.parse(raw) as JobRecord<JobType>;
    } catch (error) {
      logError("job.invalid_payload", { error: (error as Error).message });
      continue;
    }

    if (!job) continue;
    if (job.nextRunAt > Date.now()) {
      await redis.rpush(PENDING_KEY, JSON.stringify(job));
      results.skipped += 1;
      break;
    }

    try {
      await processJob(job);
      results.processed += 1;
    } catch (error: any) {
      job.attempt += 1;
      job.lastError = error?.message ?? String(error);
      if (job.attempt >= job.maxAttempts) {
        await redis.rpush(DEAD_KEY, JSON.stringify(job));
        results.dead += 1;
        logError("job.dead_letter", { type: job.type, id: job.id, error: job.lastError });
      } else {
        job.nextRunAt = Date.now() + backoffMs(job.attempt);
        await redis.rpush(PENDING_KEY, JSON.stringify(job));
        results.retried += 1;
        logWarn("job.retry_scheduled", {
          type: job.type,
          id: job.id,
          attempt: job.attempt,
          nextRunAt: job.nextRunAt,
        });
      }
    }
  }
  return results;
}
