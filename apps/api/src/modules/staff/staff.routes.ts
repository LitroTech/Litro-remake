import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { staffMembers } from '@litro/db'

export const staffRoutes: FastifyPluginAsync = async (server) => {
  const { db } = server

  // List active staff
  server.get('/', async (request) => {
    const { storeId } = request.session
    const rows = await db
      .select({
        id: staffMembers.id,
        name: staffMembers.name,
        joinedAt: staffMembers.joinedAt,
        hasMessengerLinked: staffMembers.messengerPsid,
        linkedAt: staffMembers.linkedAt,
      })
      .from(staffMembers)
      .where(and(eq(staffMembers.storeId, storeId), isNull(staffMembers.removedAt)))

    return {
      ok: true,
      data: rows.map((r) => ({
        ...r,
        hasMessengerLinked: r.hasMessengerLinked !== null,
      })),
    }
  })

  // Link app identity to Messenger PSID
  server.post('/:id/link-messenger', async (request, reply) => {
    const { storeId, role } = request.session
    if (role !== 'owner') return reply.code(403).send({ ok: false, error: 'Owner only' })

    const { id } = request.params as { id: string }
    const { psid } = z.object({ psid: z.string().min(1) }).parse(request.body)

    await db
      .update(staffMembers)
      .set({ messengerPsid: psid, linkedAt: new Date() })
      .where(and(eq(staffMembers.id, id), eq(staffMembers.storeId, storeId)))

    return { ok: true, data: null }
  })

  // Remove staff member
  server.delete('/:id', async (request, reply) => {
    const { storeId, role } = request.session
    if (role !== 'owner') return reply.code(403).send({ ok: false, error: 'Owner only' })

    const { id } = request.params as { id: string }
    await db
      .update(staffMembers)
      .set({ removedAt: new Date() })
      .where(and(eq(staffMembers.id, id), eq(staffMembers.storeId, storeId)))

    return { ok: true, data: null }
  })
}
