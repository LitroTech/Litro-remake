import { eq, and, sql } from 'drizzle-orm'
import type { Db } from '@litro/db'
import {
  products,
  creditCustomers,
  aiUsage,
  transactions,
  transactionItems,
  patternLibrary,
  stores,
  staffMembers,
  creditPayments,
} from '@litro/db'
import type { BotEngineDeps } from '@litro/bot-engine'
import type { StoreContext } from '@litro/bot-engine'

export function buildBotEngineDeps(db: Db): BotEngineDeps {
  return {
    async getProducts(storeId) {
      const rows = await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          qty: products.quantity,
        })
        .from(products)
        .where(and(eq(products.storeId, storeId), sql`${products.deletedAt} IS NULL`))
        .limit(100)

      return rows.map((r) => ({
        ...r,
        price: parseFloat(r.price),
      }))
    },

    async getCustomers(storeId) {
      return db
        .select({ id: creditCustomers.id, name: creditCustomers.name })
        .from(creditCustomers)
        .where(eq(creditCustomers.storeId, storeId))
    },

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

    async getStoreContext(storeId): Promise<StoreContext> {
      const today = new Date().toISOString().slice(0, 10)

      const [store] = await db
        .select({ name: stores.name, language: stores.language })
        .from(stores)
        .where(eq(stores.id, storeId))

      const productRows = await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          qty: products.quantity,
        })
        .from(products)
        .where(and(eq(products.storeId, storeId), sql`${products.deletedAt} IS NULL`))
        .limit(20)

      const todayStats = await db
        .select({
          totalSales: sql<string>`COALESCE(SUM(${transactions.totalAmount}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.storeId, storeId),
            sql`DATE(${transactions.submittedAt}) = ${today}`,
            sql`${transactions.voidedAt} IS NULL`
          )
        )

      const openCreditsRows = await db
        .select({
          name: creditCustomers.name,
          balance: sql<string>`
            COALESCE(
              (SELECT SUM(t.total_amount) FROM transactions t
               WHERE t.credit_customer_id = ${creditCustomers.id}
               AND t.voided_at IS NULL),
              0
            ) -
            COALESCE(
              (SELECT SUM(cp.amount) FROM credit_payments cp
               WHERE cp.customer_id = ${creditCustomers.id}),
              0
            )
          `,
        })
        .from(creditCustomers)
        .where(eq(creditCustomers.storeId, storeId))
        .limit(10)

      return {
        storeName: store?.name ?? 'Store',
        language: (store?.language ?? 'tl') as 'tl' | 'en',
        products: productRows.map((p) => ({ ...p, price: parseFloat(p.price) })),
        todaySales: parseFloat(todayStats[0]?.totalSales ?? '0'),
        todayTransactions: todayStats[0]?.count ?? 0,
        openCredits: openCreditsRows
          .map((r) => ({ customerName: r.name, balance: parseFloat(r.balance) }))
          .filter((r) => r.balance > 0),
        cart: [],
      }
    },

    async savePattern(storeId, pattern, intent, parameters) {
      await db.insert(patternLibrary).values({
        storeId,
        pattern,
        intent,
        parameters,
        confidence: '0.80',
        source: 'ai',
      })
    },

    async getSubscriptionTier(storeId) {
      const [store] = await db
        .select({ tier: stores.subscriptionTier })
        .from(stores)
        .where(eq(stores.id, storeId))
      return store?.tier ?? 'basic'
    },
  }
}
