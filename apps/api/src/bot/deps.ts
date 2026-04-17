import { eq, and, sql } from 'drizzle-orm'
import type { Db } from '@litro/db'
import { products, creditCustomers, aiUsage, stores, staffMembers, patternLibrary } from '@litro/db'
import type { BotEngineDeps } from '@litro/bot-engine'
import type { StoreContext } from '@litro/bot-engine'
import type { ConversationState } from '@litro/bot-engine'
import { rGetJson, rSetJson, rDel } from '../services/redis.js'
import {
  getAnalyticsSummary,
  getLowStockProducts,
  getTopCreditCustomers,
  getTopProducts,
} from '../services/analytics.js'

export function buildBotEngineDeps(db: Db): BotEngineDeps {
  return {
    // ─── Products / customers ───────────────────────────────────────────────

    async getProducts(storeId) {
      const rows = await db
        .select({ id: products.id, name: products.name, price: products.price, qty: products.quantity })
        .from(products)
        .where(and(eq(products.storeId, storeId), sql`${products.deletedAt} IS NULL`))
        .limit(100)
      return rows.map((r) => ({ ...r, price: parseFloat(r.price) }))
    },

    async getCustomers(storeId) {
      return db
        .select({ id: creditCustomers.id, name: creditCustomers.name })
        .from(creditCustomers)
        .where(eq(creditCustomers.storeId, storeId))
    },

    // ─── AI usage ───────────────────────────────────────────────────────────

    async getAiUsage(storeId) {
      const today = new Date().toISOString().slice(0, 10)
      const [row] = await db
        .select({ count: aiUsage.questionCount })
        .from(aiUsage)
        .where(and(eq(aiUsage.storeId, storeId), eq(aiUsage.date, today)))
      return row?.count ?? 0
    },

    async incrementAiUsage(storeId) {
      const today = new Date().toISOString().slice(0, 10)
      await db
        .insert(aiUsage)
        .values({ storeId, date: today, questionCount: 1 })
        .onConflictDoUpdate({
          target: [aiUsage.storeId, aiUsage.date],
          set: { questionCount: sql`${aiUsage.questionCount} + 1` },
        })
    },

    // ─── Full store context (for AI calls) ──────────────────────────────────

    async getStoreContext(storeId): Promise<StoreContext> {
      const today = new Date().toISOString().slice(0, 10)

      const [store] = await db
        .select({ name: stores.name, language: stores.language })
        .from(stores)
        .where(eq(stores.id, storeId))

      const productRows = await db
        .select({ id: products.id, name: products.name, price: products.price, qty: products.quantity })
        .from(products)
        .where(and(eq(products.storeId, storeId), sql`${products.deletedAt} IS NULL`))
        .limit(20)

      const [todayStats] = await db.execute(sql`
        SELECT
          COALESCE(SUM(total_amount), 0)::float AS total_sales,
          COUNT(*)::int AS tx_count
        FROM transactions
        WHERE store_id = ${storeId}
          AND DATE(submitted_at) = ${today}
          AND voided_at IS NULL
      `)

      const credits = await getTopCreditCustomers(db, storeId)

      const s = todayStats as any
      return {
        storeName: store?.name ?? 'Store',
        language: (store?.language ?? 'tl') as 'tl' | 'en',
        products: productRows.map((p) => ({ ...p, price: parseFloat(p.price) })),
        todaySales: parseFloat(s.total_sales ?? 0),
        todayTransactions: parseInt(s.tx_count ?? 0, 10),
        openCredits: credits.slice(0, 5).map((c) => ({ customerName: c.name, balance: c.balance })),
        cart: [],
      }
    },

    async savePattern(storeId, pattern, intent, parameters) {
      await db.insert(patternLibrary).values({
        storeId, pattern, intent, parameters, confidence: '0.80', source: 'ai',
      })
    },

    async getSubscriptionTier(storeId) {
      const [store] = await db.select({ tier: stores.subscriptionTier }).from(stores).where(eq(stores.id, storeId))
      return store?.tier ?? 'basic'
    },

    // ─── Session state (Redis) ───────────────────────────────────────────────

    async getSessionState(sessionKey) {
      return rGetJson<ConversationState>(`session:${sessionKey}`)
    },

    async setSessionState(sessionKey, state, ttlSeconds) {
      await rSetJson(`session:${sessionKey}`, state, ttlSeconds)
    },

    async clearSessionState(sessionKey) {
      await rDel(`session:${sessionKey}`)
    },

    // ─── Analytics (Redis-cached) ────────────────────────────────────────────

    async getAnalyticsSummary(storeId, period) {
      return getAnalyticsSummary(db, storeId, period)
    },

    async getLowStockProducts(storeId) {
      return getLowStockProducts(db, storeId)
    },

    async getTopCreditCustomers(storeId) {
      return getTopCreditCustomers(db, storeId)
    },

    async getTopProducts(storeId, period) {
      return getTopProducts(db, storeId, period)
    },

    // ─── Answer cache (Redis) ────────────────────────────────────────────────

    async getAnswerCache(key) {
      const { rGet } = await import('../services/redis.js')
      return rGet(key)
    },

    async setAnswerCache(key, answer, ttlSeconds) {
      const { rSet } = await import('../services/redis.js')
      await rSet(key, answer, ttlSeconds)
    },
  }
}
