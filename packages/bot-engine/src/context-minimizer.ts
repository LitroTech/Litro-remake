import type { CartItem } from '@litro/types'
import type { StoreContext } from './context-builder.js'
import type { StructuredQueryType } from './structured-query-detector.js'
import { fuzzyMatchProduct } from './pattern-matcher.js'

export type MessageTopic = 'correction' | 'credit' | 'stock' | 'sales' | 'general'

const CREDIT_SIGNALS = ['utang', 'credit', 'tab', 'bayad', 'nagbayad', 'balance', 'owes', 'paid']
const STOCK_SIGNALS = ['stock', 'ilan', 'marami', 'kulang', 'quantity', 'inventory']
const SALES_SIGNALS = ['benta', 'sales', 'kita', 'revenue', 'profit', 'gastos', 'expense']

export function detectTopic(message: string): MessageTopic {
  const lower = message.toLowerCase()

  const correction = ['mali', 'wrong', 'hindi', 'ayaw', 'edit', 'baguhin', 'correct', 'fix']
  if (correction.some((w) => lower.includes(w))) return 'correction'
  if (CREDIT_SIGNALS.some((w) => lower.includes(w))) return 'credit'
  if (STOCK_SIGNALS.some((w) => lower.includes(w))) return 'stock'
  if (SALES_SIGNALS.some((w) => lower.includes(w))) return 'sales'
  return 'general'
}

/**
 * Builds the smallest context payload needed for this specific Claude call.
 * Target: ~200 tokens instead of ~500.
 */
export function buildMinimalContext(
  ctx: StoreContext,
  message: string,
  topic: MessageTopic
): StoreContext {
  switch (topic) {
    case 'correction':
      return buildCorrectionContext(ctx, message)

    case 'credit':
      // Credit questions: no product list needed
      return {
        ...ctx,
        products: [],
        openCredits: ctx.openCredits.slice(0, 10),
      }

    case 'stock':
      // Stock questions: only products mentioned in message
      return {
        ...ctx,
        products: getRelevantProducts(ctx, message),
        openCredits: [],
      }

    case 'sales':
      // Sales questions: summary only, no product list, no credits
      return {
        ...ctx,
        products: ctx.products.slice(0, 5), // just top 5 for context
        openCredits: [],
      }

    case 'general':
    default:
      // General: trim product list and credits to minimum
      return {
        ...ctx,
        products: ctx.products.slice(0, 10),
        openCredits: ctx.openCredits.slice(0, 3),
      }
  }
}

function buildCorrectionContext(ctx: StoreContext, message: string): StoreContext {
  // Only include products that are in the cart OR fuzzy-match the message
  const cartProductIds = new Set(ctx.cart.map((i) => i.productId).filter(Boolean))
  const mentioned = getRelevantProducts(ctx, message)
  const mentionedIds = new Set(mentioned.map((p) => p.id))

  const relevantProducts = ctx.products.filter(
    (p) => cartProductIds.has(p.id) || mentionedIds.has(p.id)
  )

  // Fall back to top 10 if we couldn't narrow it down
  return {
    ...ctx,
    products: relevantProducts.length > 0 ? relevantProducts : ctx.products.slice(0, 10),
    openCredits: [],
  }
}

function getRelevantProducts(
  ctx: StoreContext,
  message: string
): typeof ctx.products {
  const words = message.toLowerCase().split(/\s+/)
  const relevant: typeof ctx.products = []

  // Try each word + bigram as a fuzzy product query
  const queries = [...words, ...words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`)]

  for (const query of queries) {
    if (query.length < 2) continue
    const match = fuzzyMatchProduct(query, ctx.products)
    if (match && !relevant.find((p) => p.id === match.product.id)) {
      relevant.push(match.product)
    }
  }

  return relevant
}
