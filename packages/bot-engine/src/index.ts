import type { BotContext, BotResponse, CartItem, PaymentMethod, Language } from '@litro/types'
import { matchMessage, fuzzyMatchProduct, fuzzyMatchCustomer } from './pattern-matcher.js'
import { AiEngine } from './ai-engine.js'
import type { StoreContext } from './context-builder.js'
import {
  parseCorrection,
  applyCorrectionToCart,
} from './correction-pre-parser.js'
import {
  parsePaymentMethod,
  STATE_TTL,
  type ConversationState,
} from './conversation-state.js'
import { detectStructuredQuery, type StructuredQueryType } from './structured-query-detector.js'
import {
  formatAnalyticsResponse,
  type AnalyticsSummary,
  type TopProduct,
  type LowStockItem,
  type CreditSummary,
} from './analytics-templates.js'
import { detectTopic, buildMinimalContext } from './context-minimizer.js'
import { FaqMatcher, type EmbedderFn } from './faq-matcher.js'
import { createHash } from 'crypto'

export { AiEngine } from './ai-engine.js'
export { matchMessage, fuzzyMatchProduct, fuzzyMatchCustomer } from './pattern-matcher.js'
export type { StoreContext } from './context-builder.js'
export type { EmbedderFn } from './faq-matcher.js'
export type { AnalyticsSummary, TopProduct, LowStockItem, CreditSummary } from './analytics-templates.js'

// ─── Rate limits ──────────────────────────────────────────────────────────────

const DAILY_QUESTION_LIMITS: Record<string, number> = {
  basic: 3,
  pro: 10,
  ultra: Infinity,
}

// ─── Deps interface ───────────────────────────────────────────────────────────

export interface BotEngineDeps {
  getProducts(storeId: string): Promise<Array<{ id: string; name: string; price: number; qty?: number | null }>>
  getCustomers(storeId: string): Promise<Array<{ id: string; name: string }>>
  getAiUsage(storeId: string): Promise<number>
  incrementAiUsage(storeId: string): Promise<void>
  getStoreContext(storeId: string): Promise<StoreContext>
  savePattern(storeId: string, pattern: string, intent: string, parameters: unknown): Promise<void>
  getSubscriptionTier(storeId: string): Promise<string>

  // ─── Session state (Redis-backed) ─────────────────────────────────────────
  getSessionState(sessionKey: string): Promise<ConversationState | null>
  setSessionState(sessionKey: string, state: ConversationState, ttlSeconds: number): Promise<void>
  clearSessionState(sessionKey: string): Promise<void>

  // ─── Analytics (pre-computed, cached) ────────────────────────────────────
  getAnalyticsSummary(storeId: string, period: 'today' | 'week' | 'month'): Promise<AnalyticsSummary>
  getLowStockProducts(storeId: string): Promise<LowStockItem[]>
  getTopCreditCustomers(storeId: string): Promise<CreditSummary[]>
  getTopProducts(storeId: string, period: 'today' | 'week'): Promise<TopProduct[]>

  // ─── Exact answer cache (Redis) ───────────────────────────────────────────
  getAnswerCache(key: string): Promise<string | null>
  setAnswerCache(key: string, answer: string, ttlSeconds: number): Promise<void>
}

export interface BotEngineConfig {
  /** Optional — enables MiniLM FAQ semantic matching. Pass from embedding service. */
  embedder?: EmbedderFn
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class BotEngine {
  private ai: AiEngine
  private deps: BotEngineDeps
  private faqMatcher: FaqMatcher | null = null
  private embedder: EmbedderFn | null = null

  constructor(config: BotEngineConfig, deps: BotEngineDeps) {
    this.ai = new AiEngine()
    this.deps = deps
    if (config.embedder) {
      this.embedder = config.embedder
      this.faqMatcher = new FaqMatcher()
      // Initialize FAQ embeddings in background — non-blocking
      this.faqMatcher.initialize(config.embedder).catch((err) =>
        console.warn('[bot-engine] FAQ matcher init failed:', err)
      )
    }
  }

  // ─── Main entry point ─────────────────────────────────────────────────────

  async process(ctx: BotContext): Promise<BotResponse> {
    const sessionKey = `${ctx.storeId}:${ctx.staffId}`

    // ── Layer 0: Conversation state machine ───────────────────────────────────
    // Handles multi-turn flows without any pattern matching or AI
    const state = await this.deps.getSessionState(sessionKey)

    if (state && Date.now() < state.expiresAt) {
      if (state.type === 'awaiting_payment_method') {
        return this.resolvePaymentMethod(ctx, state, sessionKey)
      }
      if (state.type === 'awaiting_correction') {
        return this.resolveCorrection(ctx, state, sessionKey)
      }
      if (state.type === 'awaiting_credit_customer') {
        return this.resolveCreditCustomer(ctx, state, sessionKey)
      }
    }

    // ── Layer 1: Pattern matcher ───────────────────────────────────────────────
    const { intent, params } = matchMessage(ctx.message)

    switch (intent) {
      case 'submit_cart':
        return this.handleSubmit(ctx, sessionKey)

      case 'clear_cart':
        return ok(ctx.language === 'tl' ? 'Na-clear na ang cart.' : 'Cart cleared.', [])

      case 'show_total':
        return this.handleShowTotal(ctx)

      case 'add_to_cart': {
        const items =
          (params.items as Array<{ quantity: number; productQuery: string }> | undefined) ??
          [{ quantity: params.quantity as number, productQuery: params.productQuery as string }]
        return this.handleAddItems(ctx, items)
      }

      case 'remove_from_cart':
        return this.handleRemoveItem(ctx, params.productQuery as string)

      case 'credit_sale':
        return this.handleCreditSale(ctx, params.customerName as string, params.amount as number | null, sessionKey)

      case 'credit_payment':
        return this.handleCreditPayment(ctx, params.customerName as string, params.amount as number)

      case 'check_stock':
        return this.handleCheckStock(ctx, params.productQuery as string)

      case 'correction':
        return this.handleCorrectionIntent(ctx, sessionKey)
    }

    // intent === 'unknown' or 'business_question' — exhaust local options before AI

    // ── Layer 2: Structured query detector ────────────────────────────────────
    const structuredType = detectStructuredQuery(ctx.message)
    if (structuredType) {
      return this.handleStructuredQuery(ctx, structuredType)
    }

    // ── Layer 3: FAQ semantic matching (MiniLM) ───────────────────────────────
    if (this.faqMatcher && this.embedder) {
      const faqMatch = await this.faqMatcher.findMatch(ctx.message, this.embedder)
      if (faqMatch) {
        return this.handleStructuredQuery(ctx, faqMatch.topic)
      }
    }

    // ── Layer 4: Exact answer cache ───────────────────────────────────────────
    const cacheKey = buildCacheKey(ctx.storeId, ctx.message)
    const cached = await this.deps.getAnswerCache(cacheKey)
    if (cached) {
      return { reply: cached, cartUpdate: null, action: null, usedAi: false }
    }

    // ── Layer 5: Claude API — only reaches here for genuinely hard questions ──
    return this.handleBusinessQuestion(ctx, cacheKey)
  }

  // ─── Layer 0 resolvers ────────────────────────────────────────────────────

  private async resolvePaymentMethod(
    ctx: BotContext,
    state: ConversationState,
    sessionKey: string
  ): Promise<BotResponse> {
    const method = parsePaymentMethod(ctx.message)
    if (!method) {
      return ok(
        ctx.language === 'tl'
          ? 'Hindi ko naintindihan. Cash, GCash, Card, o Credit?'
          : 'Didn\'t catch that. Cash, GCash, Card, or Credit?'
      )
    }

    await this.deps.clearSessionState(sessionKey)

    if (method === 'credit') {
      // Need customer name — enter next state
      await this.deps.setSessionState(
        sessionKey,
        { type: 'awaiting_credit_customer', pendingCart: state.pendingCart, expiresAt: Date.now() + STATE_TTL.awaiting_credit_customer * 1000 },
        STATE_TTL.awaiting_credit_customer
      )
      return ok(ctx.language === 'tl' ? 'Para kanino ang credit? (i-type ang pangalan)' : 'Who is this credit for? (type the name)')
    }

    const total = (state.pendingCart ?? []).reduce((s, i) => s + i.subtotal, 0)
    return {
      reply: ctx.language === 'tl' ? `Done! ₱${total} — ${method}.` : `Done! ₱${total} — ${method}.`,
      cartUpdate: [],
      action: { type: 'submit_transaction', paymentMethod: method as PaymentMethod },
      usedAi: false,
    }
  }

  private async resolveCorrection(
    ctx: BotContext,
    state: ConversationState,
    sessionKey: string
  ): Promise<BotResponse> {
    await this.deps.clearSessionState(sessionKey)
    const cart = state.pendingCart ?? ctx.cart
    const products = await this.deps.getProducts(ctx.storeId)

    // Try pre-parser on the clarification message
    const parsed = parseCorrection(ctx.message, cart)
    const { cart: updatedCart, applied, description } = applyCorrectionToCart(parsed, cart, products)

    if (applied) {
      const total = updatedCart.reduce((s, i) => s + i.subtotal, 0)
      return {
        reply: `${description} Total: ₱${total}.`,
        cartUpdate: updatedCart,
        action: null,
        usedAi: false,
      }
    }

    // Pre-parser failed — call Claude as last resort
    const storeCtx = await this.deps.getStoreContext(ctx.storeId)
    storeCtx.cart = cart
    const result = await this.ai.correctCart(storeCtx, ctx.message)
    this.absorbPatternAsync(ctx.storeId, ctx.message, result.correctedCart)
    return { reply: result.reply, cartUpdate: result.correctedCart, action: null, usedAi: true }
  }

  private async resolveCreditCustomer(
    ctx: BotContext,
    state: ConversationState,
    sessionKey: string
  ): Promise<BotResponse> {
    await this.deps.clearSessionState(sessionKey)
    const customers = await this.deps.getCustomers(ctx.storeId)
    const matchResult = fuzzyMatchCustomer(ctx.message.trim(), customers)
    const cart = state.pendingCart ?? ctx.cart
    const total = cart.reduce((s, i) => s + i.subtotal, 0)

    if (matchResult.type === 'close') {
      // Re-enter state with candidate flagged
      await this.deps.setSessionState(
        sessionKey,
        { type: 'awaiting_credit_customer', pendingCart: cart, data: { candidate: matchResult.customer.id, candidateName: matchResult.customer.name }, expiresAt: Date.now() + STATE_TTL.awaiting_credit_customer * 1000 },
        STATE_TTL.awaiting_credit_customer
      )
      return ok(ctx.language === 'tl' ? `Si ${matchResult.customer.name} ba ito? (oo/hindi)` : `Did you mean ${matchResult.customer.name}? (yes/no)`)
    }

    const customerId = matchResult.type === 'exact' ? matchResult.customer.id : 'new'
    return {
      reply: ctx.language === 'tl' ? `Done! ₱${total} credit para kay ${ctx.message.trim()}.` : `Done! ₱${total} credit for ${ctx.message.trim()}.`,
      cartUpdate: [],
      action: { type: 'submit_transaction', paymentMethod: 'credit', creditCustomerId: customerId },
      usedAi: false,
    }
  }

  // ─── Layer 1 handlers ─────────────────────────────────────────────────────

  private async handleSubmit(ctx: BotContext, sessionKey: string): Promise<BotResponse> {
    if (ctx.cart.length === 0) {
      return ok(ctx.language === 'tl' ? 'Walang laman ang cart.' : 'Cart is empty.')
    }
    const total = ctx.cart.reduce((s, i) => s + i.subtotal, 0)
    await this.deps.setSessionState(
      sessionKey,
      { type: 'awaiting_payment_method', pendingCart: ctx.cart, expiresAt: Date.now() + STATE_TTL.awaiting_payment_method * 1000 },
      STATE_TTL.awaiting_payment_method
    )
    return ok(ctx.language === 'tl' ? `Total: ₱${total}. Anong payment? Cash / GCash / Card / Credit` : `Total: ₱${total}. Payment? Cash / GCash / Card / Credit`)
  }

  private handleShowTotal(ctx: BotContext): BotResponse {
    if (ctx.cart.length === 0) {
      return ok(ctx.language === 'tl' ? 'Walang laman ang cart.' : 'Cart is empty.')
    }
    const lines = ctx.cart.map((i) => `${i.quantity}x ${i.productName} = ₱${i.subtotal}`)
    const total = ctx.cart.reduce((s, i) => s + i.subtotal, 0)
    return ok(`${lines.join('\n')}\n\nTotal: ₱${total}`)
  }

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
      if (!match) { notFound.push(productQuery); continue }

      const { product } = match
      const idx = updatedCart.findIndex((i) => i.productId === product.id)
      if (idx >= 0) {
        const newQty = updatedCart[idx].quantity + quantity
        updatedCart[idx] = { ...updatedCart[idx], quantity: newQty, subtotal: newQty * updatedCart[idx].unitPrice }
      } else {
        updatedCart.push({ productId: product.id, productName: product.name, unitPrice: product.price, quantity, subtotal: quantity * product.price })
      }
      added.push(`${quantity}x ${product.name}`)
    }

    const total = updatedCart.reduce((s, i) => s + i.subtotal, 0)
    let reply = added.length > 0 ? (ctx.language === 'tl' ? `Naidagdag: ${added.join(', ')}.` : `Added: ${added.join(', ')}.`) : ''
    if (notFound.length > 0) reply += ` ${ctx.language === 'tl' ? `Hindi nahanap: ${notFound.join(', ')}.` : `Not found: ${notFound.join(', ')}.`}`
    if (added.length > 0) reply += ` Total: ₱${total}.`

    return { reply, cartUpdate: updatedCart, action: null, usedAi: false }
  }

  private async handleRemoveItem(ctx: BotContext, query: string): Promise<BotResponse> {
    const idx = ctx.cart.findIndex((i) => i.productName.toLowerCase().includes(query.toLowerCase()))
    if (idx < 0) return ok(ctx.language === 'tl' ? `Hindi ko mahanap ang "${query}" sa cart.` : `"${query}" not in cart.`)
    const removed = ctx.cart[idx]
    const updatedCart = ctx.cart.filter((_, i) => i !== idx)
    return { reply: ctx.language === 'tl' ? `Tinanggal: ${removed.productName}.` : `Removed: ${removed.productName}.`, cartUpdate: updatedCart, action: null, usedAi: false }
  }

  private async handleCreditSale(ctx: BotContext, customerName: string, amount: number | null, sessionKey: string): Promise<BotResponse> {
    const customers = await this.deps.getCustomers(ctx.storeId)
    const match = fuzzyMatchCustomer(customerName, customers)
    if (match.type === 'close') return ok(ctx.language === 'tl' ? `Si ${match.customer.name} ba ito?` : `Did you mean ${match.customer.name}?`)
    const customerId = match.type === 'exact' ? match.customer.id : 'new'
    return { reply: ctx.language === 'tl' ? `Tab para kay ${customerName}${amount ? ` — ₱${amount}` : ''}.` : `Tab for ${customerName}${amount ? ` — ₱${amount}` : ''}.`, cartUpdate: null, action: { type: 'log_credit_sale', customerId, amount: amount ?? 0 }, usedAi: false }
  }

  private async handleCreditPayment(ctx: BotContext, customerName: string, amount: number): Promise<BotResponse> {
    const customers = await this.deps.getCustomers(ctx.storeId)
    const match = fuzzyMatchCustomer(customerName, customers)
    if (match.type === 'none') return ok(ctx.language === 'tl' ? `Hindi ko mahanap si "${customerName}".` : `"${customerName}" not found.`)
    if (match.type === 'close') return ok(ctx.language === 'tl' ? `Si ${match.customer.name} ba ito?` : `Did you mean ${match.customer.name}?`)
    return { reply: ctx.language === 'tl' ? `Bayad ni ${match.customer.name}: ₱${amount}. Logged.` : `Payment from ${match.customer.name}: ₱${amount}. Logged.`, cartUpdate: null, action: { type: 'log_credit_payment', customerId: match.customer.id, amount }, usedAi: false }
  }

  private async handleCheckStock(ctx: BotContext, query: string): Promise<BotResponse> {
    const products = await this.deps.getProducts(ctx.storeId)
    const match = fuzzyMatchProduct(query, products)
    if (!match) return ok(ctx.language === 'tl' ? `Hindi ko mahanap ang "${query}".` : `"${query}" not found.`)
    const { product } = match
    const qtyStr = product.qty != null ? `${product.qty} units` : 'check the app'
    return { reply: ctx.language === 'tl' ? `${product.name}: ${qtyStr} pa.` : `${product.name}: ${qtyStr} left.`, cartUpdate: null, action: { type: 'show_stock', productId: product.id }, usedAi: false }
  }

  private async handleCorrectionIntent(ctx: BotContext, sessionKey: string): Promise<BotResponse> {
    const products = await this.deps.getProducts(ctx.storeId)

    // Try to resolve from current message immediately
    const parsed = parseCorrection(ctx.message, ctx.cart)
    const { cart: updatedCart, applied, description } = applyCorrectionToCart(parsed, ctx.cart, products)

    if (applied) {
      const total = updatedCart.reduce((s, i) => s + i.subtotal, 0)
      return { reply: `${description} Total: ₱${total}.`, cartUpdate: updatedCart, action: null, usedAi: false }
    }

    // Can't parse — enter awaiting_correction state (ask user to clarify)
    await this.deps.setSessionState(
      sessionKey,
      { type: 'awaiting_correction', pendingCart: ctx.cart, expiresAt: Date.now() + STATE_TTL.awaiting_correction * 1000 },
      STATE_TTL.awaiting_correction
    )
    return ok(ctx.language === 'tl' ? 'Ano ang mali? I-type ulit ang tamang order (hal: "3 coke 1 sprite").' : 'What should it be? Retype the correct order (e.g. "3 coke 1 sprite").')
  }

  // ─── Layer 2–4 handler ────────────────────────────────────────────────────

  private async handleStructuredQuery(ctx: BotContext, queryType: StructuredQueryType): Promise<BotResponse> {
    const period = queryType === 'month_sales' ? 'month' : queryType === 'week_sales' ? 'week' : 'today'

    const [summary, topProducts, lowStock, credits] = await Promise.all([
      ['today_sales', 'week_sales', 'month_sales', 'expense_total'].includes(queryType)
        ? this.deps.getAnalyticsSummary(ctx.storeId, period)
        : Promise.resolve(undefined),
      queryType === 'top_products'
        ? this.deps.getTopProducts(ctx.storeId, period === 'month' ? 'week' : period)
        : Promise.resolve(undefined),
      queryType === 'low_stock'
        ? this.deps.getLowStockProducts(ctx.storeId)
        : Promise.resolve(undefined),
      queryType === 'top_credits'
        ? this.deps.getTopCreditCustomers(ctx.storeId)
        : Promise.resolve(undefined),
    ])

    const reply = formatAnalyticsResponse(queryType, { summary, topProducts, lowStock, credits }, ctx.language)
    return { reply, cartUpdate: null, action: null, usedAi: false }
  }

  // ─── Layer 5 handler ──────────────────────────────────────────────────────

  private async handleBusinessQuestion(ctx: BotContext, cacheKey: string): Promise<BotResponse> {
    const tier = await this.deps.getSubscriptionTier(ctx.storeId)
    const limit = DAILY_QUESTION_LIMITS[tier] ?? DAILY_QUESTION_LIMITS.basic
    const used = await this.deps.getAiUsage(ctx.storeId)

    if (used >= limit) {
      const msg = tier === 'basic'
        ? (ctx.language === 'tl' ? 'Naabot mo na ang 3 tanong ngayon. Bukas na ulit!' : "You've used today's 3 free questions. Come back tomorrow!")
        : (ctx.language === 'tl' ? 'Naabot mo na ang limit mo ngayon.' : "You've reached your daily limit.")
      return ok(msg)
    }

    // Build minimal context — only relevant data slices
    const fullCtx = await this.deps.getStoreContext(ctx.storeId)
    const topic = detectTopic(ctx.message)
    const minimalCtx = buildMinimalContext(fullCtx, ctx.message, topic)

    const result = await this.ai.answerQuestion(minimalCtx, ctx.message)
    await this.deps.incrementAiUsage(ctx.storeId)

    // Cache the answer — same question from same store within 1 hour gets free response
    await this.deps.setAnswerCache(cacheKey, result.reply, 60 * 60)

    return { reply: result.reply, cartUpdate: null, action: null, usedAi: true }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private absorbPatternAsync(storeId: string, message: string, cart: CartItem[]): void {
    this.ai.absorbPattern(storeId, message, cart)
      .then(async (pattern) => {
        if (pattern) await this.deps.savePattern(storeId, pattern.pattern, pattern.intent, pattern.parameters)
      })
      .catch(() => {/* best effort */})
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(reply: string, cartUpdate?: CartItem[] | null): BotResponse {
  return { reply, cartUpdate: cartUpdate ?? null, action: null, usedAi: false }
}

function buildCacheKey(storeId: string, message: string): string {
  const normalized = message.toLowerCase().trim().replace(/\s+/g, ' ')
  const hash = createHash('md5').update(normalized).digest('hex')
  return `answer:${storeId}:${hash}`
}
