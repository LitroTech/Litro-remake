import type { BotContext, BotResponse, CartItem, PaymentMethod } from '@litro/types'
import {
  matchMessage,
  fuzzyMatchProduct,
  fuzzyMatchCustomer,
} from './pattern-matcher.js'
import { AiEngine } from './ai-engine.js'
import type { StoreContext } from './context-builder.js'

export { AiEngine } from './ai-engine.js'
export { matchMessage, fuzzyMatchProduct, fuzzyMatchCustomer } from './pattern-matcher.js'
export type { StoreContext } from './context-builder.js'

// ─── Rate limits by tier ──────────────────────────────────────────────────────

const DAILY_QUESTION_LIMITS: Record<string, number> = {
  basic: 3,
  pro: 10,
  ultra: Infinity,
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export interface BotEngineConfig {
  anthropicApiKey: string
}

export interface BotEngineDeps {
  /** Look up products for this store (name + price for fuzzy matching) */
  getProducts: (storeId: string) => Promise<Array<{ id: string; name: string; price: number; qty?: number | null }>>
  /** Look up credit customers for this store */
  getCustomers: (storeId: string) => Promise<Array<{ id: string; name: string }>>
  /** Get today's AI question usage count for this store */
  getAiUsage: (storeId: string) => Promise<number>
  /** Increment AI usage count */
  incrementAiUsage: (storeId: string) => Promise<void>
  /** Get store context for AI (sales summary, open credits, etc.) */
  getStoreContext: (storeId: string) => Promise<StoreContext>
  /** Persist an absorbed pattern */
  savePattern: (storeId: string, pattern: string, intent: string, parameters: unknown) => Promise<void>
  /** Get subscription tier */
  getSubscriptionTier: (storeId: string) => Promise<string>
}

export class BotEngine {
  private ai: AiEngine
  private deps: BotEngineDeps

  constructor(config: BotEngineConfig, deps: BotEngineDeps) {
    this.ai = new AiEngine(config.anthropicApiKey)
    this.deps = deps
  }

  async process(ctx: BotContext): Promise<BotResponse> {
    const { intent, params } = matchMessage(ctx.message)

    switch (intent) {
      case 'submit_cart':
        return this.handleSubmit(ctx)

      case 'clear_cart':
        return {
          reply: ctx.language === 'tl' ? 'Na-clear na ang cart.' : 'Cart cleared.',
          cartUpdate: [],
          action: null,
          usedAi: false,
        }

      case 'show_total':
        return this.handleShowTotal(ctx)

      case 'add_to_cart': {
        const items = (params.items as Array<{ quantity: number; productQuery: string }> | undefined)
          ?? [{ quantity: params.quantity as number, productQuery: params.productQuery as string }]
        return this.handleAddItems(ctx, items)
      }

      case 'remove_from_cart':
        return this.handleRemoveItem(ctx, params.productQuery as string)

      case 'credit_sale':
        return this.handleCreditSale(ctx, params.customerName as string, params.amount as number | null)

      case 'credit_payment':
        return this.handleCreditPayment(ctx, params.customerName as string, params.amount as number)

      case 'check_stock':
        return this.handleCheckStock(ctx, params.productQuery as string)

      case 'correction':
        return this.handleCorrection(ctx)

      case 'business_question':
        return this.handleBusinessQuestion(ctx)

      case 'unknown':
      default:
        // Unknown but not a correction signal — treat as a business question
        return this.handleBusinessQuestion(ctx)
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private async handleAddItems(
    ctx: BotContext,
    items: Array<{ quantity: number; productQuery: string }>
  ): Promise<BotResponse> {
    const products = await this.deps.getProducts(ctx.storeId)
    const updatedCart = [...ctx.cart]
    const added: string[] = []
    const notFound: string[] = []

    for (const { quantity, productQuery } of items) {
      const match = fuzzyMatchProduct(productQuery, products)
      if (!match) {
        notFound.push(productQuery)
        continue
      }

      const { product } = match
      const existing = updatedCart.findIndex((i) => i.productId === product.id)
      if (existing >= 0) {
        updatedCart[existing] = {
          ...updatedCart[existing],
          quantity: updatedCart[existing].quantity + quantity,
          subtotal:
            (updatedCart[existing].quantity + quantity) * updatedCart[existing].unitPrice,
        }
      } else {
        updatedCart.push({
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity,
          subtotal: quantity * product.price,
        })
      }
      added.push(`${quantity}x ${product.name}`)
    }

    let reply = added.length > 0
      ? (ctx.language === 'tl' ? `Naidagdag: ${added.join(', ')}.` : `Added: ${added.join(', ')}.`)
      : ''

    if (notFound.length > 0) {
      reply += (reply ? ' ' : '') +
        (ctx.language === 'tl'
          ? `Hindi nahanap: ${notFound.join(', ')}. Mali ba? I-type ulit o sabihin sa akin.`
          : `Not found: ${notFound.join(', ')}. Wrong spelling? Retype or let me know.`)
    }

    const total = updatedCart.reduce((s, i) => s + i.subtotal, 0)
    if (added.length > 0 && updatedCart.length > 0) {
      reply += ` Total: ₱${total}.`
    }

    return { reply, cartUpdate: updatedCart, action: null, usedAi: false }
  }

  private handleShowTotal(ctx: BotContext): BotResponse {
    if (ctx.cart.length === 0) {
      return {
        reply: ctx.language === 'tl' ? 'Walang laman ang cart.' : 'Cart is empty.',
        cartUpdate: null,
        action: null,
        usedAi: false,
      }
    }

    const lines = ctx.cart.map((i) => `${i.quantity}x ${i.productName} = ₱${i.subtotal}`)
    const total = ctx.cart.reduce((s, i) => s + i.subtotal, 0)
    const reply = `${lines.join('\n')}\n\nTotal: ₱${total}`

    return { reply, cartUpdate: null, action: null, usedAi: false }
  }

  private handleSubmit(ctx: BotContext): BotResponse {
    if (ctx.cart.length === 0) {
      return {
        reply: ctx.language === 'tl' ? 'Walang laman ang cart.' : 'Cart is empty.',
        cartUpdate: null,
        action: null,
        usedAi: false,
      }
    }

    const total = ctx.cart.reduce((s, i) => s + i.subtotal, 0)
    return {
      reply:
        ctx.language === 'tl'
          ? `Isusumite ang ₱${total}. Anong payment? (Cash / GCash / Card / Credit)`
          : `Submitting ₱${total}. Payment method? (Cash / GCash / Card / Credit)`,
      cartUpdate: null,
      action: { type: 'submit_transaction', paymentMethod: 'cash' },
      usedAi: false,
    }
  }

  private async handleRemoveItem(ctx: BotContext, query: string): Promise<BotResponse> {
    const match = ctx.cart.find((i) =>
      i.productName.toLowerCase().includes(query.toLowerCase())
    )

    if (!match) {
      return {
        reply:
          ctx.language === 'tl'
            ? `Hindi ko mahanap ang "${query}" sa cart.`
            : `"${query}" not found in cart.`,
        cartUpdate: null,
        action: null,
        usedAi: false,
      }
    }

    const updatedCart = ctx.cart.filter((i) => i !== match)
    return {
      reply:
        ctx.language === 'tl'
          ? `Tinanggal: ${match.quantity}x ${match.productName}.`
          : `Removed: ${match.quantity}x ${match.productName}.`,
      cartUpdate: updatedCart,
      action: null,
      usedAi: false,
    }
  }

  private async handleCreditSale(
    ctx: BotContext,
    customerName: string,
    amount: number | null
  ): Promise<BotResponse> {
    const customers = await this.deps.getCustomers(ctx.storeId)
    const matchResult = fuzzyMatchCustomer(customerName, customers)

    if (matchResult.type === 'close') {
      return {
        reply:
          ctx.language === 'tl'
            ? `Si ${matchResult.customer.name} ba ito?`
            : `Did you mean ${matchResult.customer.name}?`,
        cartUpdate: null,
        action: null,
        usedAi: false,
      }
    }

    const customerId =
      matchResult.type === 'exact' ? matchResult.customer.id : null

    return {
      reply:
        ctx.language === 'tl'
          ? `Tab para kay ${customerName}${amount ? ` — ₱${amount}` : ''}.`
          : `Tab for ${customerName}${amount ? ` — ₱${amount}` : ''}.`,
      cartUpdate: null,
      action: {
        type: 'log_credit_sale',
        customerId: customerId ?? 'new',
        amount: amount ?? 0,
      },
      usedAi: false,
    }
  }

  private async handleCreditPayment(
    ctx: BotContext,
    customerName: string,
    amount: number
  ): Promise<BotResponse> {
    const customers = await this.deps.getCustomers(ctx.storeId)
    const matchResult = fuzzyMatchCustomer(customerName, customers)

    if (matchResult.type === 'none') {
      return {
        reply:
          ctx.language === 'tl'
            ? `Hindi ko mahanap si "${customerName}" sa listahan.`
            : `"${customerName}" not found in your customer list.`,
        cartUpdate: null,
        action: null,
        usedAi: false,
      }
    }

    if (matchResult.type === 'close') {
      return {
        reply:
          ctx.language === 'tl'
            ? `Si ${matchResult.customer.name} ba ito?`
            : `Did you mean ${matchResult.customer.name}?`,
        cartUpdate: null,
        action: null,
        usedAi: false,
      }
    }

    return {
      reply:
        ctx.language === 'tl'
          ? `Bayad ni ${matchResult.customer.name}: ₱${amount}. Logged.`
          : `Payment from ${matchResult.customer.name}: ₱${amount}. Logged.`,
      cartUpdate: null,
      action: {
        type: 'log_credit_payment',
        customerId: matchResult.customer.id,
        amount,
      },
      usedAi: false,
    }
  }

  private async handleCheckStock(ctx: BotContext, query: string): Promise<BotResponse> {
    const products = await this.deps.getProducts(ctx.storeId)
    const match = fuzzyMatchProduct(query, products)

    if (!match) {
      return {
        reply:
          ctx.language === 'tl'
            ? `Hindi ko mahanap ang "${query}".`
            : `"${query}" not found.`,
        cartUpdate: null,
        action: null,
        usedAi: false,
      }
    }

    const { product } = match
    const qtyStr = product.qty != null ? `${product.qty} units` : 'check the app'
    return {
      reply:
        ctx.language === 'tl'
          ? `${product.name}: ${qtyStr} pa.`
          : `${product.name}: ${qtyStr} left.`,
      cartUpdate: null,
      action: { type: 'show_stock', productId: product.id },
      usedAi: false,
    }
  }

  private async handleCorrection(ctx: BotContext): Promise<BotResponse> {
    if (ctx.correctionMode) {
      // Already in correction mode — ask user to retype
      return {
        reply:
          ctx.language === 'tl'
            ? 'I-type ulit ang order mo (hal: "2 coke 1 sprite").'
            : 'Please retype your order (e.g. "2 coke 1 sprite").',
        cartUpdate: null,
        action: null,
        usedAi: false,
      }
    }

    const storeCtx = await this.deps.getStoreContext(ctx.storeId)
    const result = await this.ai.correctCart(storeCtx, ctx.message)

    // Absorb pattern asynchronously
    this.ai
      .absorbPattern(ctx.storeId, ctx.message, result.correctedCart)
      .then(async (pattern) => {
        if (pattern) {
          await this.deps.savePattern(
            ctx.storeId,
            pattern.pattern,
            pattern.intent,
            pattern.parameters
          )
        }
      })
      .catch(() => {/* best effort */})

    return {
      reply: result.reply,
      cartUpdate: result.correctedCart,
      action: null,
      usedAi: true,
    }
  }

  private async handleBusinessQuestion(ctx: BotContext): Promise<BotResponse> {
    const tier = await this.deps.getSubscriptionTier(ctx.storeId)
    const limit = DAILY_QUESTION_LIMITS[tier] ?? DAILY_QUESTION_LIMITS.basic
    const used = await this.deps.getAiUsage(ctx.storeId)

    if (used >= limit) {
      const msg =
        tier === 'basic'
          ? ctx.language === 'tl'
            ? 'Naabot mo na ang 3 tanong ngayon. Bukas na ulit! Para sa mas maraming tanong, i-upgrade sa Ultra.'
            : "You've used today's 3 free questions. Come back tomorrow, or upgrade to Ultra for unlimited."
          : ctx.language === 'tl'
            ? 'Naabot mo na ang limit mo ngayon.'
            : "You've reached your daily limit."
      return { reply: msg, cartUpdate: null, action: null, usedAi: false }
    }

    const storeCtx = await this.deps.getStoreContext(ctx.storeId)
    const result = await this.ai.answerQuestion(storeCtx, ctx.message)
    await this.deps.incrementAiUsage(ctx.storeId)

    return { reply: result.reply, cartUpdate: null, action: null, usedAi: true }
  }
}
