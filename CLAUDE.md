# Litro — Codebase Guide

Free Filipino sari-sari store management app. AI-powered POS across mobile app + Facebook Messenger, one backend.

## Monorepo Layout

```
apps/
  api/       Node.js + Fastify backend — REST API + Messenger webhook
  mobile/    Expo (React Native) — iOS, Android, Web
packages/
  db/        PostgreSQL schema (Drizzle ORM) + migrations
  types/     Shared TypeScript types across all packages
  bot-engine/ Pattern matcher + Claude AI orchestration (shared by app chatbot + Messenger)
docs/
  architecture.md  Full system design doc
```

## Key Design Decisions

- **Online-first, cache as safety net** — server (PostgreSQL) is single source of truth. Client uses React Query for optimistic updates + offline queue.
- **One bot brain, two surfaces** — `packages/bot-engine` is called by both the in-app chatbot and the Messenger webhook. Same patterns, same AI, same context payload.
- **Modular monolith** — single deployable API with clean internal module boundaries. Split only when traffic demands it.
- **Pattern-first AI** — 95%+ of messages handled by regex/token patterns at zero cost. Claude only triggered on user-signaled correction or business questions.
- **PSID is permanent** — Facebook Page-Scoped User ID identifies Messenger staff forever. No repeated logins.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Fastify + TypeScript | Fast, schema-first, great TypeScript DX |
| Database | PostgreSQL + Drizzle ORM | ACID for transactions/credits, SQL-like queries |
| Cache/Queue | Redis + BullMQ | Cart sessions, rate limits, async alerts |
| Mobile | Expo (React Native) | Single codebase for iOS/Android/Web |
| Data fetching | TanStack Query (React Query) | Optimistic updates, offline support |
| State | Zustand | Lightweight, no boilerplate |
| AI | Anthropic Claude API | Haiku for corrections, Sonnet for business Q&A |
| File storage | Cloudflare R2 | Cheap S3-compatible, product photos |
| SMS | Semaphore PH | Philippines-focused, credit reminders |
| Hosting | Railway | Simple deploy for API + PostgreSQL + Redis |

## Auth Model

- **Owner:** Creates store with name only → gets device JWT + 12-char recovery code. Recovery code used to claim ownership on new device. No email, no password.
- **Staff (app):** Access code (8 chars) + name → JWT stored on device. Invalidated when owner regenerates code or removes staff.
- **Staff (Messenger):** PSID + access code sent once → permanently identified. No re-auth.

## Stock Thresholds (numerical mode)

- `> 50%` of initial quantity → green
- `20–50%` → yellow
- `< 20%` → red
- `0` → grey

## AI Rate Limits

- Basic: 3 business questions/day (cart corrections are free)
- Pro: 10/day
- Ultra: unlimited

## Tier Gating

All tiers share one codebase. `pro_mode` is a local settings toggle (no server enforcement). Ultra requires server-side subscription check via `store.subscription_tier`.

## Running Locally

```bash
# Install deps
pnpm install

# Start DB (requires Docker)
docker compose up -d

# Run migrations
pnpm db:migrate

# Start API dev server
pnpm --filter @litro/api dev

# Start mobile app
pnpm --filter @litro/mobile dev
```

## Environment Variables

See `apps/api/.env.example` for the full list. Key vars:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `ANTHROPIC_API_KEY` — Claude API key
- `FB_PAGE_ACCESS_TOKEN` — Messenger page token
- `FB_VERIFY_TOKEN` — Messenger webhook verification token
- `R2_*` — Cloudflare R2 credentials

## Module Conventions

Each API module in `apps/api/src/modules/<name>/` contains:
- `<name>.routes.ts` — Fastify route registration
- `<name>.service.ts` — business logic (no HTTP concerns)
- `<name>.schema.ts` — Zod validation schemas

Services import from `@litro/db` for database access. Never import from other modules' service files — go through the service's public interface or use events.
