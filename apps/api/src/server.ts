import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'

import { createDb } from '@litro/db'
import { BotEngine } from '@litro/bot-engine'
import type { Session } from '@litro/types'

import { productsRoutes } from './modules/products/products.routes.js'
import { transactionsRoutes } from './modules/transactions/transactions.routes.js'
import { stockRoutes } from './modules/stock/stock.routes.js'
import { staffRoutes } from './modules/staff/staff.routes.js'
import { storeRoutes } from './modules/store/store.routes.js'
import { creditsRoutes } from './modules/credits/credits.routes.js'
import { expensesRoutes } from './modules/expenses/expenses.routes.js'
import { cashDrawerRoutes } from './modules/cash-drawer/cash-drawer.routes.js'
import { chatRoutes } from './modules/chat/chat.routes.js'
import { messengerWebhook } from './messenger/webhook.js'
import { buildBotEngineDeps } from './bot/deps.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof createDb>
    botEngine: BotEngine
  }
  interface FastifyRequest {
    session: Session
  }
}

export async function buildServer() {
  const server = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  // ─── Plugins ──────────────────────────────────────────────────────────────

  await server.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://litro.app', /\.litro\.app$/]
      : true,
  })

  await server.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  await server.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for product photos
  })

  // ─── Database ─────────────────────────────────────────────────────────────

  const db = createDb(process.env.DATABASE_URL!)
  server.decorate('db', db)

  // ─── Bot Engine ───────────────────────────────────────────────────────────

  const botEngine = new BotEngine(
    { anthropicApiKey: process.env.ANTHROPIC_API_KEY! },
    buildBotEngineDeps(db)
  )
  server.decorate('botEngine', botEngine)

  // ─── Auth hook ────────────────────────────────────────────────────────────

  server.addHook('preHandler', async (request, reply) => {
    const { url } = request
    // Public routes that don't need auth
    const isPublic =
      url === '/health' ||
      url.startsWith('/messenger') ||
      url.startsWith('/store/join') ||
      url.startsWith('/store/create')

    if (isPublic) return

    try {
      await request.jwtVerify()
      request.session = request.user as Session
    } catch {
      reply.code(401).send({ ok: false, error: 'Unauthorized' })
    }
  })

  // ─── Routes ───────────────────────────────────────────────────────────────

  server.get('/health', async () => ({ ok: true, service: 'litro-api' }))

  await server.register(storeRoutes, { prefix: '/store' })
  await server.register(staffRoutes, { prefix: '/staff' })
  await server.register(productsRoutes, { prefix: '/products' })
  await server.register(transactionsRoutes, { prefix: '/transactions' })
  await server.register(stockRoutes, { prefix: '/stock' })
  await server.register(creditsRoutes, { prefix: '/credits' })
  await server.register(expensesRoutes, { prefix: '/expenses' })
  await server.register(cashDrawerRoutes, { prefix: '/cash-drawer' })
  await server.register(chatRoutes, { prefix: '/chat' })
  await server.register(messengerWebhook, { prefix: '/messenger' })

  return server
}
