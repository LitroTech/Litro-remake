import type { BotIntent, CartItem, ParsedIntent } from '@litro/types'

// ─── Token patterns ───────────────────────────────────────────────────────────
// Ordered by specificity — first match wins.

interface Pattern {
  intent: BotIntent
  /** Test function returns params or null if no match */
  test: (tokens: string[], raw: string) => Record<string, unknown> | null
}

const SUBMIT_WORDS = new Set([
  // Filipino
  'submit', 'bayad', 'bayad na', 'okay na', 'ok na', 'tapos na', 'sige na',
  'done', 'go', 'pasok', 'tara', 'checkout', 'check out',
  // English
  'pay', 'confirm', 'send',
])

const CANCEL_WORDS = new Set([
  'cancel', 'burahin', 'burahin lahat', 'clear', 'ulit', 'restart',
  'reset', 'wala na', 'ayaw ko na',
])

const TOTAL_WORDS = new Set([
  'total', 'magkano', 'magkano lahat', 'how much', 'sum', 'cart',
  'ano nasa cart', 'anong nasa cart', 'show cart',
])

const CORRECTION_WORDS = new Set([
  'mali', 'mali yan', 'hindi', 'hindi tama', 'wrong', 'wrong yun',
  'ayaw', 'ibang', 'ibang yan', 'edit', 'baguhin', 'palitan',
  'correct', 'fix',
])

/** Matches: "2 coke", "coke 2", "2x coke", "coke x2", "dalawang coke" */
const ITEM_LINE_RE =
  /^(?:(\d+)\s*[xX]?\s+(.+?)|(.+?)\s+[xX]?\s*(\d+))$/

/** Matches: "utang ni Mike 150" or "2 c2 4 royal utang Mike" */
const CREDIT_SALE_RE =
  /utang\s+(?:ni\s+)?([a-z\s]+?)(?:\s+(\d+(?:\.\d{2})?))?$/i

/** Matches: "nagbayad si Mike 200" or "bayad ni Mike 200" */
const CREDIT_PAYMENT_RE =
  /(?:nagbayad|bayad)\s+(?:si\s+|ni\s+)?([a-z\s]+?)\s+(\d+(?:\.\d{2})?)$/i

/** Matches: "stock ng coke" or "ilan pa coke" */
const STOCK_CHECK_RE = /(?:stock|ilan|ilan pa|marami pa)\s+(?:ng\s+|na\s+)?(.+)$/i

/** Matches: "remove coke" or "tanggalin coke" or "wag na coke" */
const REMOVE_ITEM_RE = /(?:remove|tanggalin|wag na|alisin)\s+(.+)$/i

const PATTERNS: Pattern[] = [
  {
    intent: 'submit_cart',
    test: (_tokens, raw) =>
      SUBMIT_WORDS.has(raw.toLowerCase().trim()) ? {} : null,
  },
  {
    intent: 'clear_cart',
    test: (_tokens, raw) =>
      CANCEL_WORDS.has(raw.toLowerCase().trim()) ? {} : null,
  },
  {
    intent: 'show_total',
    test: (_tokens, raw) =>
      TOTAL_WORDS.has(raw.toLowerCase().trim()) ? {} : null,
  },
  {
    intent: 'correction',
    test: (_tokens, raw) => {
      const lower = raw.toLowerCase()
      return [...CORRECTION_WORDS].some((w) => lower.startsWith(w))
        ? { originalMessage: raw }
        : null
    },
  },
  {
    intent: 'credit_payment',
    test: (_tokens, raw) => {
      const m = CREDIT_PAYMENT_RE.exec(raw)
      if (!m) return null
      return { customerName: m[1].trim(), amount: parseFloat(m[2]) }
    },
  },
  {
    intent: 'credit_sale',
    test: (_tokens, raw) => {
      const m = CREDIT_SALE_RE.exec(raw)
      if (!m) return null
      return {
        customerName: m[1].trim(),
        amount: m[2] ? parseFloat(m[2]) : null,
      }
    },
  },
  {
    intent: 'check_stock',
    test: (_tokens, raw) => {
      const m = STOCK_CHECK_RE.exec(raw)
      return m ? { productQuery: m[1].trim() } : null
    },
  },
  {
    intent: 'remove_from_cart',
    test: (_tokens, raw) => {
      const m = REMOVE_ITEM_RE.exec(raw)
      return m ? { productQuery: m[1].trim() } : null
    },
  },
  {
    intent: 'add_to_cart',
    test: (_tokens, raw) => {
      const m = ITEM_LINE_RE.exec(raw.trim())
      if (!m) return null
      const qty = parseInt(m[1] ?? m[4], 10)
      const name = (m[2] ?? m[3]).trim()
      return { quantity: qty, productQuery: name }
    },
  },
]

// ─── Public API ───────────────────────────────────────────────────────────────

export interface MatchResult {
  intent: BotIntent
  params: Record<string, unknown>
  /** 1.0 = certain regex match, < 1.0 = fuzzy */
  confidence: number
}

export function matchMessage(raw: string): MatchResult {
  const tokens = raw.trim().toLowerCase().split(/\s+/)

  for (const pattern of PATTERNS) {
    const params = pattern.test(tokens, raw)
    if (params !== null) {
      return { intent: pattern.intent, params, confidence: 1.0 }
    }
  }

  // Multi-line messages: each line may be a cart item
  const lines = raw.split(/\n|,/).map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1) {
    const items: Array<{ quantity: number; productQuery: string }> = []
    for (const line of lines) {
      const m = ITEM_LINE_RE.exec(line)
      if (!m) {
        // Any non-matching line = not a clean multi-item message
        return { intent: 'unknown', params: {}, confidence: 0 }
      }
      items.push({
        quantity: parseInt(m[1] ?? m[4], 10),
        productQuery: (m[2] ?? m[3]).trim(),
      })
    }
    return { intent: 'add_to_cart', params: { items }, confidence: 1.0 }
  }

  return { intent: 'unknown', params: {}, confidence: 0 }
}

// ─── Product fuzzy matching ───────────────────────────────────────────────────

interface ProductLookup {
  id: string
  name: string
  price: number
}

/**
 * Finds best matching product for a query string.
 * Returns null if no match is good enough (< 0.5 similarity).
 */
export function fuzzyMatchProduct(
  query: string,
  products: ProductLookup[]
): { product: ProductLookup; score: number } | null {
  const q = normalize(query)
  let best: { product: ProductLookup; score: number } | null = null

  for (const product of products) {
    const name = normalize(product.name)
    const score = similarity(q, name)
    if (!best || score > best.score) {
      best = { product, score }
    }
  }

  return best && best.score >= 0.5 ? best : null
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Dice coefficient bigram similarity */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0

  const bigrams = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.substring(i, i + 2)
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1)
  }

  let intersect = 0
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.substring(i, i + 2)
    const count = bigrams.get(bg) ?? 0
    if (count > 0) {
      bigrams.set(bg, count - 1)
      intersect++
    }
  }

  return (2.0 * intersect) / (a.length + b.length - 2)
}

// ─── Customer fuzzy matching ──────────────────────────────────────────────────

interface CustomerLookup {
  id: string
  name: string
}

export type CustomerMatchResult =
  | { type: 'exact'; customer: CustomerLookup }
  | { type: 'close'; customer: CustomerLookup; score: number }
  | { type: 'none' }

/** Returns exact, close (needs confirmation), or none. */
export function fuzzyMatchCustomer(
  query: string,
  customers: CustomerLookup[]
): CustomerMatchResult {
  const q = normalize(query)
  let best: { customer: CustomerLookup; score: number } | null = null

  for (const customer of customers) {
    const name = normalize(customer.name)
    if (name === q) return { type: 'exact', customer }
    const score = similarity(q, name)
    if (!best || score > best.score) {
      best = { customer, score }
    }
  }

  if (best && best.score >= 0.7) {
    return { type: 'close', customer: best.customer, score: best.score }
  }
  return { type: 'none' }
}
