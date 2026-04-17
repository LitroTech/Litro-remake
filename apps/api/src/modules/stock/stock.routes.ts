import type { FastifyPluginAsync } from 'fastify'
import { eq, and, sql, isNull } from 'drizzle-orm'
import { products, stockAlerts } from '@litro/db'

export const stockRoutes: FastifyPluginAsync = async (server) => {
  const { db } = server

  // List unacknowledged stock alerts
  server.get('/alerts', async (request) => {
    const { storeId } = request.session
    const rows = await db
      .select({
        id: stockAlerts.id,
        productId: stockAlerts.productId,
        productName: products.name,
        alertType: stockAlerts.alertType,
        triggeredAt: stockAlerts.triggeredAt,
      })
      .from(stockAlerts)
      .leftJoin(products, eq(stockAlerts.productId, products.id))
      .where(
        and(
          eq(stockAlerts.storeId, storeId),
          isNull(stockAlerts.acknowledgedAt)
        )
      )

    return { ok: true, data: rows }
  })

  // Acknowledge an alert
  server.post('/alerts/:id/acknowledge', async (request) => {
    const { storeId } = request.session
    const { id } = request.params as { id: string }
    await db
      .update(stockAlerts)
      .set({ acknowledgedAt: new Date() })
      .where(and(eq(stockAlerts.id, id), eq(stockAlerts.storeId, storeId)))
    return { ok: true, data: null }
  })
}
