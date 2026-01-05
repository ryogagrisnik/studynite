import { z } from "zod";

type EnvIssue = {
  level: "warn" | "error";
  message: string;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_ID_MONTHLY: z.string().min(1).optional(),
  STRIPE_PRICE_ID_YEARLY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  JOBS_DRAIN_SECRET: z.string().min(1).optional(),
  LOG_LEVEL: z.string().min(1).optional(),
  RATE_LIMIT_SIGNUP_MAX: z.string().min(1).optional(),
  RATE_LIMIT_LOGIN_MAX: z.string().min(1).optional(),
  RATE_LIMIT_DECK_CREATE_MAX: z.string().min(1).optional(),
  RATE_LIMIT_PARTY_JOIN_MAX: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;

let validated = false;
let cachedIssues: EnvIssue[] = [];

function collectEnvIssues(): EnvIssue[] {
  const issues: EnvIssue[] = [];
  if (env.NODE_ENV === "production") {
    if (!env.DATABASE_URL) issues.push({ level: "error", message: "DATABASE_URL is required." });
    if (!env.NEXTAUTH_SECRET) issues.push({ level: "error", message: "NEXTAUTH_SECRET is required." });
  }

  if (env.STRIPE_SECRET_KEY) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      issues.push({ level: "error", message: "STRIPE_WEBHOOK_SECRET is required when Stripe is enabled." });
    }
    if (!env.STRIPE_PRICE_ID_MONTHLY && !env.STRIPE_PRICE_ID_YEARLY) {
      issues.push({ level: "error", message: "At least one STRIPE_PRICE_ID_* must be set when Stripe is enabled." });
    }
  }

  if (env.UPSTASH_REDIS_REST_URL && !env.UPSTASH_REDIS_REST_TOKEN) {
    issues.push({ level: "warn", message: "UPSTASH_REDIS_REST_TOKEN missing; Redis will not connect." });
  }

  return issues;
}

export function validateEnv(): { ok: boolean; issues: EnvIssue[] } {
  if (validated) {
    return { ok: cachedIssues.every((issue) => issue.level !== "error"), issues: cachedIssues };
  }
  validated = true;
  cachedIssues = collectEnvIssues();
  const errors = cachedIssues.filter((issue) => issue.level === "error");
  if (errors.length > 0 && env.NODE_ENV === "production") {
    const message = errors.map((issue) => issue.message).join(" ");
    throw new Error(`Env validation failed: ${message}`);
  }
  if (cachedIssues.length > 0) {
    const message = cachedIssues.map((issue) => `[${issue.level}] ${issue.message}`).join(" ");
    // Use console directly to avoid any logger import cycles.
    console.warn(message);
  }
  return { ok: errors.length === 0, issues: cachedIssues };
}
