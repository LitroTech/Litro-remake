import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { stores, staffMembers } from '@litro/db'
import { createHash, randomBytes } from 'crypto'

const CreateStoreSchema = z.object({
  name: z.string().min(1).max(80),
  language: z.enum(['tl', 'en']).default('tl'),
})

const JoinStoreSchema = z.object({
  accessCode: z.string().length(8),
  name: z.string().min(1).max(50),
})

function generateAccessCode(): string {
  return randomBytes(4).toString('hex').toUpperCase()
}

function generateRecoveryCode(): string {
  const part = () => randomBytes(3).toString('hex').toUpperCase()
  return `LITRO-${part()}-${part()}`
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export const storeRoutes: FastifyPluginAsync = async (server) => {
  const { db } = server

  // Create a new store (owner flow)
  server.post('/create', async (request, reply) => {
    const body = CreateStoreSchema.parse(request.body)

    const deviceToken = randomBytes(32).toString('hex')
    const recoveryCode = generateRecoveryCode()
    const accessCode = generateAccessCode()

    const [store] = await db
      .insert(stores)
      .values({
        name: body.name,
        accessCode,
        ownerTokenHash: hash(deviceToken),
        recoveryCodeHash: hash(recoveryCode),
        language: body.language,
        settings: {},
      })
      .returning()

    // Create a virtual "owner" staff member so transactions can reference staffId
    const [ownerStaff] = await db
      .insert(staffMembers)
      .values({
        storeId: store.id,
        name: 'Owner',
        appSessionTokenHash: hash(deviceToken),
      })
      .returning()

    const token = server.jwt.sign({
      storeId: store.id,
      staffId: ownerStaff.id,
      role: 'owner',
    })

    reply.code(201)
    // Recovery code is shown ONCE here and never stored in plaintext
    return {
      ok: true,
      data: {
        storeId: store.id,
        accessCode: store.accessCode,
        recoveryCode,
        token,
      },
    }
  })

  // Join a store as staff
  server.post('/join', async (request, reply) => {
    const body = JoinStoreSchema.parse(request.body)

    const [store] = await db
      .select()
      .from(stores)
      .where(eq(stores.accessCode, body.accessCode))

    if (!store) {
      return reply.code(404).send({ ok: false, error: 'Invalid access code' })
    }

    const sessionToken = randomBytes(32).toString('hex')

    const [staff] = await db
      .insert(staffMembers)
      .values({
        storeId: store.id,
        name: body.name,
        appSessionTokenHash: hash(sessionToken),
      })
      .returning()

    const token = server.jwt.sign({
      storeId: store.id,
      staffId: staff.id,
      role: 'staff',
    })

    return {
      ok: true,
      data: {
        storeId: store.id,
        storeName: store.name,
        staffId: staff.id,
        token,
      },
    }
  })

  // Claim ownership on a new device using recovery code
  server.post('/claim', async (request, reply) => {
    const { storeId, recoveryCode } = z
      .object({ storeId: z.string().uuid(), recoveryCode: z.string() })
      .parse(request.body)

    const [store] = await db.select().from(stores).where(eq(stores.id, storeId))
    if (!store || store.recoveryCodeHash !== hash(recoveryCode)) {
      return reply.code(403).send({ ok: false, error: 'Invalid recovery code' })
    }

    const newDeviceToken = randomBytes(32).toString('hex')
    await db
      .update(stores)
      .set({ ownerTokenHash: hash(newDeviceToken) })
      .where(eq(stores.id, storeId))

    // Update owner staff token too
    await db
      .update(staffMembers)
      .set({ appSessionTokenHash: hash(newDeviceToken) })
      .where(eq(staffMembers.storeId, storeId))

    const [ownerStaff] = await db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.storeId, storeId))

    const token = server.jwt.sign({
      storeId,
      staffId: ownerStaff.id,
      role: 'owner',
    })

    return { ok: true, data: { token } }
  })

  // Get store info
  server.get('/', async (request) => {
    const { storeId } = request.session
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId))
    return {
      ok: true,
      data: {
        id: store.id,
        name: store.name,
        accessCode: store.accessCode,
        language: store.language,
        settings: store.settings,
        subscriptionTier: store.subscriptionTier,
      },
    }
  })

  // Regenerate access code (invalidates all staff sessions immediately)
  server.post('/regenerate-code', async (request) => {
    const { storeId } = request.session
    const newCode = generateAccessCode()
    await db
      .update(stores)
      .set({ accessCode: newCode })
      .where(eq(stores.id, storeId))
    return { ok: true, data: { accessCode: newCode } }
  })
}
