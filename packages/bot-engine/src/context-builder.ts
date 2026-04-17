import type { CartItem, Language } from '@litro/types'

export interface StoreContext {
  storeName: string
  language: Language
  products: Array<{ id: string; name: string; price: number; qty?: number | null }>
  todaySales: number
  todayTransactions: number
  openCredits: Array<{ customerName: string; balance: number }>
  cart: CartItem[]
}

/**
 * Builds the ~500-token context payload sent to Claude.
 * System prompt is marked for prompt caching — it changes rarely (products, store name).
 * Only the user message and cart are dynamic.
 */
export function buildCorrectionPrompt(ctx: StoreContext, userMessage: string) {
  const cartSummary =
    ctx.cart.length === 0
      ? 'Cart is empty.'
      : ctx.cart
          .map((i) => `  - ${i.quantity}x ${i.productName} @ ₱${i.unitPrice} = ₱${i.subtotal}`)
          .join('\n')

  const systemContent = buildSystemContent(ctx)

  return {
    systemContent,
    userContent: `Current cart:\n${cartSummary}\n\nUser said: "${userMessage}"\n\nCorrect the cart based on what the user meant. Reply with:\n1. A brief confirmation in ${ctx.language === 'tl' ? 'Taglish' : 'English'} (1 sentence)\n2. JSON on a new line: {"cart": [{"productId": "...", "productName": "...", "quantity": N, "unitPrice": N, "subtotal": N}]}\n\nIf product not in catalog, use productId: null. Keep prices from catalog.`,
  }
}

export function buildBusinessQuestionPrompt(ctx: StoreContext, question: string) {
  const systemContent = buildSystemContent(ctx)

  return {
    systemContent,
    userContent: question,
  }
}

function buildSystemContent(ctx: StoreContext): string {
  // Top 20 products sorted by name — this is the cacheable part
  const top20 = ctx.products
    .slice(0, 20)
    .map((p) => `${p.name} ₱${p.price}${p.qty != null ? ` (qty: ${p.qty})` : ''}`)
    .join(', ')

  const creditsStr =
    ctx.openCredits.length === 0
      ? 'none'
      : ctx.openCredits
          .slice(0, 5)
          .map((c) => `${c.customerName} ₱${c.balance}`)
          .join(', ')

  return `You are Litro, an AI assistant for a Filipino sari-sari store called "${ctx.storeName}".
Respond in ${ctx.language === 'tl' ? 'Taglish (mix of Filipino and English)' : 'English'}.
Be warm, brief, and helpful. Never use corporate language.

Store catalog (top 20): ${top20}
Today: ₱${ctx.todaySales} sales, ${ctx.todayTransactions} transactions
Open tabs: ${creditsStr}`
}
