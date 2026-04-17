import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { CartItem, Language } from '@litro/types'

const ChatMessageSchema = z.object({
  message: z.string().min(1).max(500),
  cart: z
    .array(
      z.object({
        productId: z.string().nullable(),
        productName: z.string(),
        unitPrice: z.number(),
        quantity: z.number().int().positive(),
        subtotal: z.number(),
      })
    )
    .default([]),
  correctionMode: z.boolean().default(false),
})

export const chatRoutes: FastifyPluginAsync = async (server) => {
  // In-app chatbot endpoint — same bot engine as Messenger
  server.post('/message', async (request) => {
    const session = request.session
    const { storeId } = session
    const staffId = 'staffId' in session ? session.staffId : 'owner'

    const body = ChatMessageSchema.parse(request.body)

    // Get store language from DB (or default to 'tl')
    // Simplified here — real impl would pull from store settings
    const response = await server.botEngine.process({
      storeId,
      staffId,
      channel: 'app',
      message: body.message,
      cart: body.cart as CartItem[],
      correctionMode: body.correctionMode,
      language: 'tl' as Language,
    })

    return { ok: true, data: response }
  })
}
