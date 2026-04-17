import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql, desc } from 'drizzle-orm'
import { expenses } from '@litro/db'

const CreateExpenseSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  photoUrl: z.string().url().optional(),
})

export const expensesRoutes: FastifyPluginAsync = async (server) => {
  const { db } = server

  server.get('/', async (request) => {
    const { storeId } = request.session
    const { date } = request.query as { date?: string }

    const rows = await db
      .select()
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, storeId),
          date ? sql`DATE(${expenses.createdAt}) = ${date}` : sql`TRUE`
        )
      )
      .orderBy(desc(expenses.createdAt))

    return { ok: true, data: rows }
  })

  server.post('/', async (request, reply) => {
    const session = request.session
    const { storeId } = session
    // Basic tier: owner-only expense logging
    if (session.role !== 'owner') {
      return reply.code(403).send({ ok: false, error: 'Owner only on Basic tier' })
    }
    const staffId = 'staffId' in session ? session.staffId : null
    if (!staffId) return reply.code(403).send({ ok: false, error: 'Forbidden' })

    const body = CreateExpenseSchema.parse(request.body)
    const [expense] = await db
      .insert(expenses)
      .values({
        storeId,
        loggedBy: staffId,
        name: body.name,
        amount: body.amount.toString(),
        photoUrl: body.photoUrl ?? null,
      })
      .returning()

    reply.code(201)
    return { ok: true, data: expense }
  })
}
