# BlobPrep — Full Visuals + Randomized Questions + Redis Caching

- White, spacious UI with orange (#F77F00), beige (#FCEBD7), brown (#4A2E1C)
- Pages: Home, Practice, Pricing, QOTD, Dashboard, Blog, Auth (Sign In/Up), Legal (Privacy/Terms), 404
- Random question generator (cheap parametric) for GRE/GMAT Quant + basic Verbal
- Redis caching queues (IDs only), 21-day seen TTL, 25/day quota
- Neon stores question payloads; Redis stores IDs to keep costs low
- Upgrade buttons intact; Stripe backend returns `STRIPE_NOT_CONFIGURED` until keys are set, then runs live

## Run
cp .env.local.example .env.local  # paste your NEW rotated keys
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev

## Enable billing (Stripe)
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID_MONTHLY` (and/or `STRIPE_PRICE_ID_YEARLY`).
- Add a Stripe webhook endpoint pointing to `/api/stripe/webhook` with events:
  - `checkout.session.completed`, `customer.subscription.created|updated|deleted`.
- Use `POST /api/checkout` to get a Checkout URL.
- Use `POST /api/billing/portal` for a customer billing portal URL.

## Membership flow (Stripe → access)
- Checkout (`/api/checkout`) requires an authenticated user and a configured price; it creates a Stripe subscription checkout session.
- Webhook (`/api/stripe/webhook`) handles `checkout.session.completed` and `customer.subscription.*` events and updates `User` with `stripeCustomerId`, `stripeSubscriptionId`, `proPlan`, `proSince`, and `proExpiresAt`.
- When Stripe reports a cancel or `cancel_at_period_end`, `proExpiresAt` is set to that period end. After that timestamp passes, the user automatically reverts to free.
- Access checks use `lib/server/membership.ts`:
  - `hasActiveProSession` returns true if `isPro` is set or `proExpiresAt` is in the future.
  - `hasUnlimitedAccess` returns true for active Pro or (in non-prod) emails listed in `UNLIMITED_EMAILS`.

## Required environment
- Postgres: `DATABASE_URL`
- Redis (Upstash or compatible): `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- NextAuth: `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (prod only)
- App base URL: `APP_URL` and `NEXT_PUBLIC_APP_URL`
- Optional: `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`
- Optional (explanations): `EXPLANATION_TARGET_WORDS`, `EXPLANATION_WORD_MIN`, `EXPLANATION_WORD_MAX`
- Optional (dev): `UNLIMITED_EMAILS` for unlimited practice bypass

## Where to plug OpenAI or more topics
lib/generator.ts — replace parametric templates with your model calls (e.g., gpt-4o-mini)
Validate → upsert → enqueue to the proper queue key

## Cost hygiene
- Redis stores IDs only
- Seen sets TTL = 21 days
- Quota before serve
- Pipeline ready for batch ops (lib/redis.ts)

## Production hardening done here
- Server-side HTML sanitization for stems/explanations before serving
- Rate limit on `/api/explain`
- Sitemap at `/sitemap.xml` and robots referencing it
- Example envs for NextAuth/Google included
- Added `lint`, `typecheck`, and `test` scripts
- Stripe checkout + webhook endpoints added (no extra dependency; REST API usage)
- Daily queue prefill implemented (`lib/queue.ts`)

## CI
GitHub Actions (`.github/workflows/ci.yml`) runs install → typecheck → lint → test → build on pushes and PRs.

Consider next steps:
- Stripe checkout + webhook to set `proExpiresAt`
- Real queue prefill in `lib/queue.ts` (currently no-op)
- Enable TypeScript/ESLint error enforcement in `next.config.js`
