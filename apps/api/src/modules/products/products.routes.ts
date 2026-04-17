import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, sql, asc } from 'drizzle-orm'
import { products } from '@litro/db'

const CreateProductSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  stockMode: z.enum(['numerical', 'descriptive']),
  quantity: z.number().int().min(0).optional(),
  stockLevel: z.enum(['high', 'medium', 'low', 'none']).optional(),
})

const UpdateStockSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  stockLevel: z.enum(['high', 'medium', 'low', 'none']).optional(),
})

export const productsRoutes: FastifyPluginAsync = async (server) => {
  const { db } = server

  // List products for a store
  server.get('/', async (request) => {
    const { storeId } = request.session
    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.storeId, storeId), sql`${products.deletedAt} IS NULL`))
      .orderBy(asc(products.name))

    return {
      ok: true,
      data: rows.map(toProductResponse),
    }
  })

  // Create product
  server.post('/', async (request, reply) => {
    const { storeId } = request.session
    const body = CreateProductSchema.parse(request.body)

    if (body.stockMode === 'numerical' && body.quantity === undefined) {
      return reply.code(400).send({ ok: false, error: 'quantity required for numerical stock mode' })
    }
    if (body.stockMode === 'descriptive' && !body.stockLevel) {
      return reply.code(400).send({ ok: false, error: 'stockLevel required for descriptive stock mode' })
    }

    const [product] = await db
      .insert(products)
      .values({
        storeId,
        name: body.name,
        price: body.price.toString(),
        stockMode: body.stockMode,
        quantity: body.quantity ?? null,
        initialQuantity: body.quantity ?? null,
        stockLevel: body.stockLevel ?? null,
      })
      .returning()

    reply.code(201)
    return { ok: true, data: toProductResponse(product) }
  })

  // Update product
  server.patch('/:id', async (request, reply) => {
    const { storeId } = request.session
    const { id } = request.params as { id: string }
    const body = CreateProductSchema.partial().parse(request.body)

    const [updated] = await db
      .update(products)
      .set({
        ...body,
        price: body.price?.toString(),
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning()

    if (!updated) return reply.code(404).send({ ok: false, error: 'Not found' })
    return { ok: true, data: toProductResponse(updated) }
  })

  // Update stock level only
  server.patch('/:id/stock', async (request, reply) => {
    const { storeId } = request.session
    const { id } = request.params as { id: string }
    const body = UpdateStockSchema.parse(request.body)

    const [updated] = await db
      .update(products)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning()

    if (!updated) return reply.code(404).send({ ok: false, error: 'Not found' })
    return { ok: true, data: toProductResponse(updated) }
  })

  // Soft delete
  server.delete('/:id', async (request, reply) => {
    const { storeId } = request.session
    const { id } = request.params as { id: string }

    await db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))

    return { ok: true, data: null }
  })
}

function toProductResponse(p: typeof products.$inferSelect) {
  const qty = p.quantity
  const initial = p.initialQuantity

  let stockColor: 'green' | 'yellow' | 'red' | 'grey' | null = null
  if (p.stockMode === 'numerical' && qty !== null && initial !== null && initial > 0) {
    const pct = qty / initial
    if (qty === 0) stockColor = 'grey'
    else if (pct > 0.5) stockColor = 'green'
    else if (pct >= 0.2) stockColor = 'yellow'
    else stockColor = 'red'
  }

  return {
    id: p.id,
    name: p.name,
    price: parseFloat(p.price),
    photoUrl: p.photoUrl,
    stockMode: p.stockMode,
    quantity: p.quantity,
    stockLevel: p.stockLevel,
    stockColor,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}
