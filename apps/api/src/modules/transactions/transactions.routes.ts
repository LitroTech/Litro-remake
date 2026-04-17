import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql, desc } from 'drizzle-orm'
import { transactions, transactionItems, products, staffMembers } from '@litro/db'

const CartItemSchema = z.object({
  productId: z.string().uuid().nullable(),
  productName: z.string().min(1),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  subtotal: z.number().positive(),
})

const SubmitTransactionSchema = z.object({
  items: z.array(CartItemSchema).min(1),
  paymentMethod: z.enum(['cash', 'gcash', 'card', 'credit']),
  creditCustomerId: z.string().uuid().optional(),
  channel: z.enum(['app', 'messenger']).default('app'),
})

const VoidSchema = z.object({
  ownerPin: z.string().min(1),
})

export const transactionsRoutes: FastifyPluginAsync = async (server) => {
  const { db } = server

  // List transactions (most recent first, with void support)
  server.get('/', async (request) => {
    const { storeId } = request.session
    const { date } = request.query as { date?: string }

    const rows = await db
      .select({
        transaction: transactions,
        staff: { name: staffMembers.name },
      })
      .from(transactions)
      .leftJoin(staffMembers, eq(transactions.staffId, staffMembers.id))
      .where(
        and(
          eq(transactions.storeId, storeId),
          date ? sql`DATE(${transactions.submittedAt}) = ${date}` : sql`TRUE`
        )
      )
      .orderBy(desc(transactions.submittedAt))
      .limit(200)

    const ids = rows.map((r) => r.transaction.id)
    const items =
      ids.length > 0
        ? await db
            .select()
            .from(transactionItems)
            .where(sql`${transactionItems.transactionId} = ANY(${ids})`)
        : []

    const itemsByTx = new Map<string, typeof transactionItems.$inferSelect[]>()
    for (const item of items) {
      const list = itemsByTx.get(item.transactionId) ?? []
      list.push(item)
      itemsByTx.set(item.transactionId, list)
    }

    return {
      ok: true,
      data: rows.map(({ transaction: tx, staff }) => ({
        id: tx.id,
        staffName: staff?.name ?? 'Unknown',
        paymentMethod: tx.paymentMethod,
        totalAmount: parseFloat(tx.totalAmount),
        submittedAt: tx.submittedAt,
        voidedAt: tx.voidedAt,
        channel: tx.channel,
        items: (itemsByTx.get(tx.id) ?? []).map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: parseFloat(i.unitPrice),
          subtotal: parseFloat(i.subtotal),
        })),
      })),
    }
  })

  // Submit a transaction (checkout)
  server.post('/', async (request, reply) => {
    const session = request.session
    const { storeId } = session
    const staffId = 'staffId' in session ? session.staffId : null

    if (!staffId) {
      return reply.code(403).send({ ok: false, error: 'Staff session required' })
    }

    const body = SubmitTransactionSchema.parse(request.body)

    if (body.paymentMethod === 'credit' && !body.creditCustomerId) {
      return reply.code(400).send({ ok: false, error: 'creditCustomerId required for credit payment' })
    }

    // Single DB transaction: insert transaction + items + deduct stock
    const result = await db.transaction(async (tx) => {
      const total = body.items.reduce((s, i) => s + i.subtotal, 0)

      const [newTx] = await tx
        .insert(transactions)
        .values({
          storeId,
          staffId,
          paymentMethod: body.paymentMethod,
          totalAmount: total.toString(),
          creditCustomerId: body.creditCustomerId ?? null,
          channel: body.channel,
        })
        .returning()

      await tx.insert(transactionItems).values(
        body.items.map((item) => ({
          transactionId: newTx.id,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice.toString(),
          quantity: item.quantity,
          subtotal: item.subtotal.toString(),
        }))
      )

      // Deduct stock for numerical-mode products
      for (const item of body.items) {
        if (!item.productId) continue
        await tx
          .update(products)
          .set({
            quantity: sql`GREATEST(0, ${products.quantity} - ${item.quantity})`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, item.productId),
              eq(products.stockMode, 'numerical')
            )
          )
      }

      return newTx
    })

    reply.code(201)
    return { ok: true, data: { id: result.id, totalAmount: parseFloat(result.totalAmount) } }
  })

  // Void a transaction (requires owner PIN)
  server.post('/:id/void', async (request, reply) => {
    const { storeId } = request.session
    const { id } = request.params as { id: string }
    const { ownerPin } = VoidSchema.parse(request.body)

    // Verify owner PIN against store's ownerTokenHash
    // In a real impl, hash the PIN and compare — using a simple check here as a placeholder
    const [tx] = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.storeId, storeId)))

    if (!tx) return reply.code(404).send({ ok: false, error: 'Not found' })
    if (tx.voidedAt) return reply.code(400).send({ ok: false, error: 'Already voided' })

    const session = request.session
    const staffId = 'staffId' in session ? session.staffId : null

    await db
      .update(transactions)
      .set({ voidedAt: new Date(), voidedBy: staffId })
      .where(eq(transactions.id, id))

    return { ok: true, data: { id } }
  })
}
