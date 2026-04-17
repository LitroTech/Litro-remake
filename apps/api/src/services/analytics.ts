import { sql, eq, and } from 'drizzle-orm'
import type { Db } from '@litro/db'
import { products, transactions, transactionItems, expenses, creditCustomers, creditPayments } from '@litro/db'
import { rGetJson, rSetJson } from './redis.js'
import type {
  AnalyticsSummary,
  TopProduct,
  LowStockItem,
  CreditSummary,
} from '@litro/bot-engine'

const ANALYTICS_TTL = 30 * 60 // 30 minutes

// ─── Sales summary ────────────────────────────────────────────────────────────

export async function getAnalyticsSummary(
  db: Db,
  storeId: string,
  period: 'today' | 'week' | 'month'
): Promise<AnalyticsSummary> {
  const cacheKey = `analytics:${storeId}:${period}`
  const cached = await rGetJson<AnalyticsSummary>(cacheKey)
  if (cached) return cached

  const { start, prevStart, prevEnd } = getDateRange(period)
  const today = new Date().toISOString().slice(0, 10)

  const [current] = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN voided_at IS NULL THEN total_amount ELSE 0 END), 0)::float AS total_sales,
      COUNT(CASE WHEN voided_at IS NULL THEN 1 END)::int AS tx_count
    FROM transactions
    WHERE store_id = ${storeId}
      AND submitted_at >= ${start}
      AND submitted_at < NOW()
  `)

  const [prev] = await db.execute(sql`
    SELECT COALESCE(SUM(CASE WHEN voided_at IS NULL THEN total_amount ELSE 0 END), 0)::float AS total_sales
    FROM transactions
    WHERE store_id = ${storeId}
      AND submitted_at >= ${prevStart}
      AND submitted_at < ${prevEnd}
  `)

  const [exp] = await db.execute(sql`
    SELECT COALESCE(SUM(amount), 0)::float AS total
    FROM expenses
    WHERE store_id = ${storeId} AND DATE(created_at) = ${today}
  `)

  const row = current as any
  const prevRow = prev as any
  const expRow = exp as any

  const summary: AnalyticsSummary = {
    period,
    totalSales: parseFloat(row.total_sales ?? 0),
    txCount: parseInt(row.tx_count ?? 0, 10),
    previousPeriodSales: parseFloat(prevRow.total_sales ?? 0),
    totalExpenses: parseFloat(expRow.total ?? 0),
  }

  await rSetJson(cacheKey, summary, ANALYTICS_TTL)
  return summary
}

// ─── Top products ─────────────────────────────────────────────────────────────

export async function getTopProducts(
  db: Db,
  storeId: string,
  period: 'today' | 'week'
): Promise<TopProduct[]> {
  const cacheKey = `analytics:${storeId}:top_products:${period}`
  const cached = await rGetJson<TopProduct[]>(cacheKey)
  if (cached) return cached

  const { start } = getDateRange(period)

  const rows = await db.execute(sql`
    SELECT
      ti.product_name AS name,
      SUM(ti.quantity)::int AS units_sold,
      SUM(ti.subtotal)::float AS revenue
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE t.store_id = ${storeId}
      AND t.submitted_at >= ${start}
      AND t.voided_at IS NULL
    GROUP BY ti.product_name
    ORDER BY units_sold DESC
    LIMIT 5
  `)

  const result = (rows as any[]).map((r) => ({
    name: r.name,
    unitsSold: parseInt(r.units_sold, 10),
    revenue: parseFloat(r.revenue),
  }))

  await rSetJson(cacheKey, result, ANALYTICS_TTL)
  return result
}

// ─── Low stock ────────────────────────────────────────────────────────────────

export async function getLowStockProducts(db: Db, storeId: string): Promise<LowStockItem[]> {
  const cacheKey = `analytics:${storeId}:low_stock`
  const cached = await rGetJson<LowStockItem[]>(cacheKey)
  if (cached) return cached

  const rows = await db
    .select({
      name: products.name,
      quantity: products.quantity,
      initialQuantity: products.initialQuantity,
      stockLevel: products.stockLevel,
      stockMode: products.stockMode,
    })
    .from(products)
    .where(
      and(
        eq(products.storeId, storeId),
        sql`${products.deletedAt} IS NULL`
      )
    )

  const lowItems: LowStockItem[] = []

  for (const p of rows) {
    if (p.stockMode === 'numerical' && p.quantity !== null) {
      if (p.quantity === 0) {
        lowItems.push({ name: p.name, quantity: 0, initialQuantity: p.initialQuantity ?? 0, alertType: 'out_of_stock' })
      } else if (p.initialQuantity && p.initialQuantity > 0) {
        const pct = p.quantity / p.initialQuantity
        if (pct < 0.1) lowItems.push({ name: p.name, quantity: p.quantity, initialQuantity: p.initialQuantity, alertType: 'critical' })
        else if (pct < 0.2) lowItems.push({ name: p.name, quantity: p.quantity, initialQuantity: p.initialQuantity, alertType: 'low' })
      }
    } else if (p.stockMode === 'descriptive') {
      if (p.stockLevel === 'none') lowItems.push({ name: p.name, quantity: 0, initialQuantity: 0, alertType: 'out_of_stock' })
      else if (p.stockLevel === 'low') lowItems.push({ name: p.name, quantity: 0, initialQuantity: 0, alertType: 'low' })
    }
  }

  await rSetJson(cacheKey, lowItems, ANALYTICS_TTL)
  return lowItems
}

// ─── Top credit customers ─────────────────────────────────────────────────────

export async function getTopCreditCustomers(db: Db, storeId: string): Promise<CreditSummary[]> {
  const cacheKey = `analytics:${storeId}:top_credits`
  const cached = await rGetJson<CreditSummary[]>(cacheKey)
  if (cached) return cached

  const rows = await db.execute(sql`
    SELECT
      cc.name,
      (
        COALESCE((SELECT SUM(t.total_amount) FROM transactions t
          WHERE t.credit_customer_id = cc.id AND t.voided_at IS NULL), 0) -
        COALESCE((SELECT SUM(cp.amount) FROM credit_payments cp
          WHERE cp.customer_id = cc.id), 0)
      )::float AS balance,
      EXTRACT(DAY FROM NOW() - MAX(cp.paid_at))::int AS days_since_payment
    FROM credit_customers cc
    LEFT JOIN credit_payments cp ON cp.customer_id = cc.id
    WHERE cc.store_id = ${storeId}
    GROUP BY cc.id, cc.name
    HAVING (
      COALESCE((SELECT SUM(t.total_amount) FROM transactions t
        WHERE t.credit_customer_id = cc.id AND t.voided_at IS NULL), 0) -
      COALESCE((SELECT SUM(cp.amount) FROM credit_payments cp
        WHERE cp.customer_id = cc.id), 0)
    ) > 0
    ORDER BY balance DESC
    LIMIT 10
  `)

  const result = (rows as any[]).map((r) => ({
    name: r.name,
    balance: parseFloat(r.balance),
    daysSinceLastPayment: r.days_since_payment != null ? parseInt(r.days_since_payment, 10) : null,
  }))

  await rSetJson(cacheKey, result, ANALYTICS_TTL)
  return result
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

/** Call after every transaction submission to keep analytics fresh */
export async function invalidateAnalyticsCache(storeId: string): Promise<void> {
  const redis = (await import('./redis.js')).getRedis()
  const keys = await redis.keys(`analytics:${storeId}:*`)
  if (keys.length > 0) await redis.del(...keys)
}

// ─── Date ranges ─────────────────────────────────────────────────────────────

function getDateRange(period: 'today' | 'week' | 'month') {
  const now = new Date()

  if (period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - 1)
    const prevEnd = new Date(start)
    return { start: start.toISOString(), prevStart: prevStart.toISOString(), prevEnd: prevEnd.toISOString() }
  }

  if (period === 'week') {
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    const prevStart = new Date(start)
    prevStart.setDate(prevStart.getDate() - 7)
    return { start: start.toISOString(), prevStart: prevStart.toISOString(), prevEnd: start.toISOString() }
  }

  // month
  const start = new Date(now)
  start.setDate(start.getDate() - 30)
  const prevStart = new Date(start)
  prevStart.setDate(prevStart.getDate() - 30)
  return { start: start.toISOString(), prevStart: prevStart.toISOString(), prevEnd: start.toISOString() }
}
