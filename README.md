# BlobPrep — Full Visuals + Randomized Questions + Redis Caching

- White, spacious UI with orange (#F77F00), beige (#FCEBD7), brown (#4A2E1C)
- Pages: Home, Practice, Pricing, QOTD, Dashboard, Blog, Auth (Sign In/Up), Legal (Privacy/Terms), 404
- Random question generator (cheap parametric) for GRE/GMAT Quant + basic Verbal
- Redis caching queues (IDs only), 21-day seen TTL, 25/day quota
- Neon stores question payloads; Redis stores IDs to keep costs low
- Upgrade buttons intact; Stripe backend stubbed (501) until you add keys

## Run
cp .env.local.example .env.local  # paste your NEW rotated keys
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev

## Where to plug OpenAI or more topics
lib/generator.ts — replace parametric templates with your model calls (e.g., gpt-4o-mini)
Validate → upsert → enqueue to the proper queue key

## Cost hygiene
- Redis stores IDs only
- Seen sets TTL = 21 days
- Quota before serve
- Pipeline ready for batch ops (lib/redis.ts)
