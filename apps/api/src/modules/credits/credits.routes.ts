import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql, desc } from 'drizzle-orm'
import {
  creditCustomers,
  creditPayments,
  creditPaymentAllocations,
  transactions,
} from '@litro/db'

const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().optional(),
})

const RecordPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive(),
  note: z.string().optional(),
})

export const creditsRoutes: FastifyPluginAsync = async (server) => {
  const { db } = server

  // List credit customers sorted by balance descending
  server.get('/', async (request) => {
    const { storeId } = request.session

    const rows = await db.execute(sql`
      SELECT
        cc.id,
        cc.name,
        cc.phone,
        cc.created_at,
        COALESCE(credit_sum.total, 0) - COALESCE(payment_sum.total, 0) AS balance,
        MAX(cp.paid_at) AS last_paid_at
      FROM credit_customers cc
      LEFT JOIN (
        SELECT credit_customer_id, SUM(total_amount) AS total
        FROM transactions
        WHERE store_id = ${storeId} AND voided_at IS NULL AND payment_method = 'credit'
        GROUP BY credit_customer_id
      ) credit_sum ON credit_sum.credit_customer_id = cc.id
      LEFT JOIN (
        SELECT customer_id, SUM(amount) AS total
        FROM credit_payments
        WHERE store_id = ${storeId}
        GROUP BY customer_id
      ) payment_sum ON payment_sum.customer_id = cc.id
      LEFT JOIN credit_payments cp ON cp.customer_id = cc.id AND cp.store_id = ${storeId}
      WHERE cc.store_id = ${storeId}
      GROUP BY cc.id, cc.name, cc.phone, cc.created_at, credit_sum.total, payment_sum.total
      ORDER BY balance DESC
    `)

    return { ok: true, data: rows.rows }
  })

  // Create credit customer
  server.post('/customers', async (request, reply) => {
    const { storeId } = request.session
    const body = CreateCustomerSchema.parse(request.body)

    const [customer] = await db
      .insert(creditCustomers)
      .values({ storeId, name: body.name, phone: body.phone ?? null })
      .returning()

    reply.code(201)
    return { ok: true, data: customer }
  })

  // Record a payment (FIFO allocation)
  server.post('/payments', async (request) => {
    const { storeId } = request.session
    const session = request.session
    const staffId = 'staffId' in session ? session.staffId : null
    const body = RecordPaymentSchema.parse(request.body)

    await db.transaction(async (tx) => {
      const [payment] = await tx
        .insert(creditPayments)
        .values({
          storeId,
          customerId: body.customerId,
          amount: body.amount.toString(),
          loggedBy: staffId,
          note: body.note ?? null,
        })
        .returning()

      // FIFO: get oldest unpaid/partially-paid credit transactions
      const outstanding = await tx.execute(sql`
        SELECT
          t.id,
          t.total_amount,
          COALESCE(SUM(cpa.amount_allocated), 0) AS paid_so_far
        FROM transactions t
        LEFT JOIN credit_payment_allocations cpa ON cpa.transaction_id = t.id
        WHERE t.credit_customer_id = ${body.customerId}
          AND t.store_id = ${storeId}
          AND t.voided_at IS NULL
          AND t.payment_method = 'credit'
        GROUP BY t.id, t.total_amount
        HAVING t.total_amount > COALESCE(SUM(cpa.amount_allocated), 0)
        ORDER BY t.submitted_at ASC
      `)

      let remaining = body.amount
      for (const row of outstanding.rows as Array<{ id: string; total_amount: string; paid_so_far: string }>) {
        if (remaining <= 0) break
        const owed = parseFloat(row.total_amount) - parseFloat(row.paid_so_far)
        const allocated = Math.min(remaining, owed)
        await tx.insert(creditPaymentAllocations).values({
          paymentId: payment.id,
          transactionId: row.id,
          amountAllocated: allocated.toString(),
        })
        remaining -= allocated
      }
    })

    return { ok: true, data: null }
  })
}
