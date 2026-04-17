import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql, desc } from 'drizzle-orm'
import { cashDrawerSessions, transactions, expenses } from '@litro/db'

export const cashDrawerRoutes: FastifyPluginAsync = async (server) => {
  const { db } = server

  // Get today's dashboard summary
  server.get('/summary', async (request) => {
    const { storeId } = request.session
    const today = new Date().toISOString().slice(0, 10)

    const [salesResult] = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN voided_at IS NULL THEN total_amount ELSE 0 END), 0) AS total_sales,
        COUNT(CASE WHEN voided_at IS NULL THEN 1 END) AS transaction_count
      FROM transactions
      WHERE store_id = ${storeId} AND DATE(submitted_at) = ${today}
    `)

    const [expensesResult] = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0) AS total_expenses
      FROM expenses
      WHERE store_id = ${storeId} AND DATE(created_at) = ${today}
    `)

    const [session] = await db
      .select()
      .from(cashDrawerSessions)
      .where(and(eq(cashDrawerSessions.storeId, storeId), eq(cashDrawerSessions.date, today)))

    const s = (salesResult as any).rows?.[0] ?? salesResult
    const e = (expensesResult as any).rows?.[0] ?? expensesResult

    return {
      ok: true,
      data: {
        date: today,
        totalSales: parseFloat(String(s.total_sales)),
        transactionCount: parseInt(String(s.transaction_count), 10),
        totalExpenses: parseFloat(String(e.total_expenses)),
        cashDrawer: session ?? null,
      },
    }
  })

  // Open cash drawer
  server.post('/open', async (request, reply) => {
    const session = request.session
    const { storeId } = session
    const staffId = 'staffId' in session ? session.staffId : null
    if (!staffId) return reply.code(403).send({ ok: false, error: 'Forbidden' })

    const { openingAmount } = z
      .object({ openingAmount: z.number().min(0).optional() })
      .parse(request.body)

    const today = new Date().toISOString().slice(0, 10)
    const [drawerSession] = await db
      .insert(cashDrawerSessions)
      .values({
        storeId,
        date: today,
        openedBy: staffId,
        openingAmount: openingAmount?.toString() ?? null,
      })
      .returning()

    reply.code(201)
    return { ok: true, data: drawerSession }
  })

  // Close cash drawer
  server.post('/close', async (request, reply) => {
    const session = request.session
    const { storeId } = session
    const staffId = 'staffId' in session ? session.staffId : null
    if (!staffId) return reply.code(403).send({ ok: false, error: 'Forbidden' })

    const { closingAmount } = z
      .object({ closingAmount: z.number().min(0) })
      .parse(request.body)

    const today = new Date().toISOString().slice(0, 10)
    await db
      .update(cashDrawerSessions)
      .set({ closedAt: new Date(), closedBy: staffId, closingAmount: closingAmount.toString() })
      .where(and(eq(cashDrawerSessions.storeId, storeId), eq(cashDrawerSessions.date, today)))

    return { ok: true, data: null }
  })
}
