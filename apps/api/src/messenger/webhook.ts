import type { FastifyPluginAsync } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { messengerCarts, staffMembers, stores } from '@litro/db'
import type { CartItem, Language } from '@litro/types'

const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN!
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN!

interface MessengerEntry {
  messaging: Array<{
    sender: { id: string }
    message?: { text: string }
    postback?: { payload: string }
  }>
}

export const messengerWebhook: FastifyPluginAsync = async (server) => {
  const { db } = server

  // Webhook verification (Facebook one-time GET)
  server.get('/webhook', async (request, reply) => {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } =
      request.query as Record<string, string>

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      server.log.info('Messenger webhook verified')
      return reply.send(challenge)
    }
    return reply.code(403).send('Forbidden')
  })

  // Receive messages
  server.post('/webhook', async (request, reply) => {
    const body = request.body as { object: string; entry: MessengerEntry[] }

    if (body.object !== 'page') return reply.code(404).send('Not found')

    for (const entry of body.entry) {
      for (const event of entry.messaging) {
        const psid = event.sender.id
        const text = event.message?.text

        if (!text) continue

        // Fire and forget — Messenger expects fast 200 response
        processMessengerMessage(psid, text, server.db, server.botEngine).catch(
          (err) => server.log.error({ psid, err }, 'Messenger processing error')
        )
      }
    }

    // Messenger requires 200 within 20 seconds
    return reply.code(200).send('EVENT_RECEIVED')
  })
}

async function processMessengerMessage(
  psid: string,
  text: string,
  db: ReturnType<typeof import('@litro/db').createDb>,
  botEngine: import('@litro/bot-engine').BotEngine
) {
  // Look up or bootstrap this PSID's cart/session
  let [cart] = await db
    .select()
    .from(messengerCarts)
    .where(eq(messengerCarts.psid, psid))

  // If no cart exists, the user hasn't joined a store yet
  if (!cart) {
    // Handle join flow: "litro XXXXXXXX" to join a store
    const joinMatch = text.match(/^litro\s+([A-Z0-9]{8})$/i)
    if (joinMatch) {
      await handleMessengerJoin(psid, joinMatch[1].toUpperCase(), db)
    } else {
      await sendMessage(psid, 'Para sumali sa tindahan, i-type: LITRO [access code]')
    }
    return
  }

  // Look up staff info for this PSID
  const [staff] = await db
    .select({ id: staffMembers.id, name: staffMembers.name })
    .from(staffMembers)
    .where(eq(staffMembers.messengerPsid, psid))

  if (!staff) {
    await sendMessage(psid, 'Hindi ka pa connected sa tindahan. I-type: LITRO [access code]')
    return
  }

  // Get store language
  const [store] = await db
    .select({ language: stores.language })
    .from(stores)
    .where(eq(stores.id, cart.storeId))

  // Process through shared bot engine
  const response = await botEngine.process({
    storeId: cart.storeId,
    staffId: staff.id,
    channel: 'messenger',
    message: text,
    cart: (cart.items as CartItem[]) ?? [],
    correctionMode: false,
    language: (store?.language ?? 'tl') as Language,
  })

  // Persist cart update
  if (response.cartUpdate !== null) {
    await db
      .update(messengerCarts)
      .set({ items: response.cartUpdate, updatedAt: new Date() })
      .where(eq(messengerCarts.psid, psid))
  }

  // Execute side-effect actions
  if (response.action?.type === 'submit_transaction') {
    // Delegate to transaction service — simplified here
    await sendMessage(psid, response.reply)
    return
  }

  await sendMessage(psid, response.reply)
}

async function handleMessengerJoin(
  psid: string,
  accessCode: string,
  db: ReturnType<typeof import('@litro/db').createDb>
) {
  const [store] = await db
    .select()
    .from(stores)
    .where(eq(stores.accessCode, accessCode))

  if (!store) {
    await sendMessage(psid, 'Hindi nahanap ang tindahan. Tiyaking tama ang access code.')
    return
  }

  // Create Messenger cart entry
  await db
    .insert(messengerCarts)
    .values({ psid, storeId: store.id, items: [] })
    .onConflictDoNothing()

  await sendMessage(
    psid,
    `Kumusta! Nakakonekta ka na sa "${store.name}". Mag-order ka na! (hal: "2 coke 1 sprite")`
  )
}

async function sendMessage(psid: string, text: string) {
  await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text },
      }),
    }
  )
}
