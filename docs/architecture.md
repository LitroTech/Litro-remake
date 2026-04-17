# Litro — Architecture Document

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│                                                             │
│  ┌─────────────────┐        ┌──────────────────────────┐   │
│  │  Expo Mobile     │        │   Facebook Messenger     │   │
│  │  (iOS/Android/  │        │   (staff, low-end users) │   │
│  │   Web)          │        └──────────┬───────────────┘   │
│  └────────┬────────┘                   │ Webhook            │
│           │ REST + JWT                 │                    │
└───────────┼────────────────────────────┼────────────────────┘
            │                            │
┌───────────▼────────────────────────────▼────────────────────┐
│                   Litro API (Fastify)                        │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │  REST Routes│  │  Messenger   │  │   Bot Engine       │ │
│  │  /products  │  │  Webhook     │  │   (shared)         │ │
│  │  /txns      │  │  /messenger  │  │   ┌─────────────┐  │ │
│  │  /credits   │  │  /webhook    │  │   │Pattern Match│  │ │
│  │  /expenses  │  └──────┬───────┘  │   ├─────────────┤  │ │
│  │  /staff     │         │          │   │ Claude API  │  │ │
│  │  /chat ─────┼─────────┘          │   │ (Haiku/     │  │ │
│  └─────────────┘  ──────────────────┘   │  Sonnet)    │  │ │
│                                         └─────────────┘  │ │
└─────────────────────────────┬───────────────────────────────┘
                              │
        ┌─────────────────────┼──────────────────────┐
        │                     │                      │
┌───────▼──────┐   ┌──────────▼──────┐   ┌───────────▼─────┐
│  PostgreSQL  │   │     Redis        │   │  Cloudflare R2  │
│  (Drizzle)   │   │  Cart sessions   │   │  Product photos │
│  Source of   │   │  Rate limits     │   │  Expense photos │
│  truth       │   │  BullMQ queues   │   └─────────────────┘
└──────────────┘   └─────────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| API | Fastify 4 + TypeScript | Schema-first, fast, great TS DX |
| ORM | Drizzle | Lightweight, SQL-like, type-safe |
| Database | PostgreSQL 16 | ACID for transactions + FIFO credits |
| Queue | BullMQ + Redis | Stock alerts, AI absorption, async jobs |
| Mobile | Expo (React Native) | iOS + Android + Web, one codebase |
| Data fetching | TanStack Query v5 | Optimistic updates + offline queue |
| State | Zustand | Minimal, no boilerplate |
| AI | Anthropic Claude API | Haiku for corrections, Sonnet for Q&A |
| Storage | Cloudflare R2 | Cheap S3-compatible, product/expense photos |
| SMS | Semaphore PH | Philippines-focused, credit reminders |
| CDN | Cloudflare | Edge caching, DDOS protection |
| Hosting | Railway | Simple deploys, PostgreSQL + Redis included |

## Monorepo Structure

```
litro/
├── apps/
│   ├── api/                    Fastify backend
│   │   └── src/
│   │       ├── modules/        One folder per domain
│   │       │   ├── products/   CRUD + stock color logic
│   │       │   ├── transactions/ Checkout + void (DB transaction)
│   │       │   ├── credits/    FIFO payment allocation
│   │       │   ├── expenses/   Owner-only at Basic
│   │       │   ├── cash-drawer/ Open/close + daily summary
│   │       │   ├── staff/      Join, link, remove
│   │       │   ├── store/      Create, join, recover
│   │       │   ├── stock/      Alerts + acknowledge
│   │       │   └── chat/       In-app chatbot endpoint
│   │       ├── messenger/      Facebook webhook handler
│   │       ├── bot/            Wires BotEngine to DB deps
│   │       └── server.ts       Fastify app factory
│   └── mobile/                 Expo app
│       └── src/
│           ├── app/            Expo Router file-based routes
│           ├── lib/            api.ts, store.ts (Zustand)
│           └── constants/      theme.ts (colors, fonts, spacing)
└── packages/
    ├── types/      Shared TypeScript types (no runtime deps)
    ├── db/         Drizzle schema + migrations
    └── bot-engine/ Pattern matcher + Claude AI orchestration
```

## Data Model

### Core tables

| Table | Key columns | Notes |
|---|---|---|
| `stores` | id, name, access_code, owner_token_hash, recovery_code_hash | access_code invalidates all staff on regenerate |
| `staff_members` | id, store_id, name, app_session_token_hash, messenger_psid | two identities, optionally linked by owner |
| `products` | id, store_id, name, price, stock_mode, quantity, stock_level, initial_quantity | initial_quantity used for % color coding |
| `transactions` | id, store_id, staff_id, payment_method, total_amount, credit_customer_id, voided_at | voided rows stay visible, struck through |
| `transaction_items` | id, transaction_id, product_name (snapshot), unit_price (snapshot), quantity | snapshots survive product deletion |
| `expenses` | id, store_id, logged_by, name, amount | owner-only at Basic |
| `credit_customers` | id, store_id, name, phone | phone optional, never called "utang" |
| `credit_payments` | id, customer_id, amount, paid_at | FIFO allocation via junction table |
| `credit_payment_allocations` | payment_id, transaction_id, amount_allocated | tracks which transactions each payment cleared |
| `cash_drawer_sessions` | id, store_id, date, opening_amount, closing_amount | one per store per day |
| `messenger_carts` | psid, store_id, staff_id, items (JSONB) | server-side Messenger cart |
| `ai_usage` | store_id, date, question_count | rate limiting per tier |
| `pattern_library` | store_id (null=global), pattern, intent, source | grows via AI absorption |
| `stock_alerts` | store_id, product_id, alert_type, acknowledged_at | unacknowledged = active |
| `milestones` | store_id, milestone_key, shown_at | shown_at null = pending animation |
| `coaching_nudges` | store_id, nudge_key, shown_at | once shown, never again |

### Key constraints

- `transaction_items.product_name` and `unit_price` are **snapshots** — required so transaction history is accurate after product edits/deletes.
- `initial_quantity` is set once at product creation for color-coding math. Updating stock later doesn't change it.
- `credit_payment_allocations` implements FIFO: when a payment comes in, the service queries outstanding credit transactions ordered by `submitted_at ASC` and allocates oldest-first.
- `stores.access_code` is regeneratable anytime. All staff JWTs embed the access code epoch implicitly — regeneration forces re-join for new staff, but existing JWTs are checked against `staff_members.removed_at` (not the access code itself), so existing staff are not logged out unless explicitly removed.

## Auth Model

```
Owner creates store
  → device token (random, 32 bytes)
  → recovery code (shown once, hashed in DB)
  → JWT signed {storeId, staffId, role: 'owner'}
  → stored in SecureStore on device

Owner on new device
  → POST /store/claim {storeId, recoveryCode}
  → new device token issued, old token invalidated
  → new JWT

Staff joins via access code
  → POST /store/join {accessCode, name}
  → JWT signed {storeId, staffId, role: 'staff'}
  → stored in SecureStore

Staff via Messenger
  → sends "LITRO XXXXXXXX" once
  → PSID permanently stored in messenger_carts
  → subsequent messages identified by PSID
  → no re-auth ever
```

## Bot Engine — How One Brain Serves Two Surfaces

```
In-app chatbot                 Messenger webhook
POST /chat/message             POST /messenger/webhook
{message, cart, ...}           {psid, text}
        │                              │
        │                              │ load cart from
        │                              │ messenger_carts
        └──────────────┬───────────────┘
                       ▼
              BotEngine.process(BotContext)
                       │
                       ▼
            matchMessage(raw) ──► 95%+ handled here
                       │               (zero AI cost)
              intent known?
              /          \
            YES           NO (unknown) ──► businessQuestion
             │
       handle locally                 correctionMode?
       (add/remove/submit/            /           \
        credit/stock/total)         YES            NO
                                     │              │
                                 ask to         correctCart()
                                 retype         via Claude Haiku
                                               max 1 call
                                               + absorb pattern
                                               async
```

**Context payload to Claude (~500 tokens):**
```json
{
  "store": "Nanay's Sari-Sari",
  "language": "tl",
  "products": ["Coke 1.5L ₱65 (qty: 12)", "...top 20"],
  "today": {"sales": 1200, "transactions": 8},
  "openTabs": ["Mike ₱350", "Rose ₱120"],
  "cart": [{"name": "Coke", "qty": 2, "price": 65}],
  "userMessage": "mali yung coke, 3 dapat"
}
```

System prompt is marked `cache_control: {type: 'ephemeral'}` — product catalog changes rarely within a session, so Anthropic caches it. Significant cost reduction at scale.

## Stock Alert Flow

```
Transaction submitted
  → DB transaction deducts stock
  → After commit: checkStockThresholds(items)
    → For each numerical-mode product:
      qty/initial_quantity < 0.20 → queue 'stock:alert' job
      qty === 0 → queue 'stock:alert' {type: 'out_of_stock'}
  → BullMQ worker processes job:
    → Upsert stock_alerts record (avoid duplicate alerts)
    → Unacknowledged alerts returned on next GET /stock/alerts
```

## Credit FIFO Logic

```
Customer Mike has 3 unpaid credit transactions:
  TX-001: ₱150 (Jan 1)
  TX-002: ₱200 (Jan 5)
  TX-003: ₱100 (Jan 10)
  Total owed: ₱450

Mike pays ₱280:
  1. Insert credit_payments row (₱280)
  2. Query outstanding TXs ordered by submitted_at ASC
  3. Allocate FIFO:
     TX-001: ₱150 fully paid → credit_payment_allocations (payment, TX-001, 150)
     TX-002: ₱130 partial  → credit_payment_allocations (payment, TX-002, 130)
     TX-003: ₱0 remaining balance
  4. Mike's balance: ₱170 remaining
```

## Online-First Caching Strategy

- **Server is source of truth** — PostgreSQL.
- **Client uses TanStack Query** — stale-while-revalidate, background refetch.
- **Mutations are optimistic** — cart updates, stock level changes show instantly.
- **Offline queue** — failed mutations are retried in order when connectivity restored. Critical for sari-sari stores with spotty connections.
- **Conflict resolution** — transactions always resolved server-side (sequential IDs, atomic stock deduction). Most other data is last-write-wins.

## Tier Gating

| Feature | Basic | Pro | Ultra |
|---|---|---|---|
| All 9 core features | ✓ | ✓ | ✓ |
| AI business questions/day | 3 | 10 | ∞ |
| Expense logging | Owner only | All staff | All staff |
| Pro mode toggle | – | ✓ (local) | ✓ |
| Advanced analytics | – | – | ✓ |
| Price | Free | Free (dev mode) | ₱699/mo |

Pro mode is a local settings toggle — no server enforcement. Ultra requires `store.subscription_tier = 'ultra'` server-side check.

## Deployment Topology (Railway)

```
Production:
  litro-api       Railway service (Node.js, autoscale)
  litro-db        Railway PostgreSQL (managed backups)
  litro-redis     Railway Redis (cart sessions + BullMQ)
  litro-worker    Railway service (BullMQ worker, same codebase)

CDN:
  Cloudflare      Proxy + R2 for media

Mobile:
  EAS Build       Expo Application Services
  Play Store      Android distribution
  App Store       iOS distribution
  Web             Deployed to Cloudflare Pages
```

## Key Numbers (estimated at launch)

| Metric | Value |
|---|---|
| AI cost per store/month (Basic) | ₱2–8 |
| Pattern match coverage | ~95% of messages |
| Context payload per AI call | ~500 tokens |
| Cart correction model | claude-haiku-4-5-20251001 |
| Business question model | claude-sonnet-4-6 |
| Messenger response target | < 2s p95 |
| API response target | < 200ms p95 |
