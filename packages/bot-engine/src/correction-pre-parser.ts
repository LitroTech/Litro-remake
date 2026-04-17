import type { CartItem } from '@litro/types'

// ─── Result types ─────────────────────────────────────────────────────────────

export type CorrectionType =
  | 'set_quantity'    // "mali, 3 coke dapat"
  | 'adjust_quantity' // "dagdag 1 coke" / "bawasan 1 coke"
  | 'remove_item'     // "wag yung sprite"
  | 'full_replace'    // "3 coke 1 sprite" (after awaiting_correction state)
  | 'ambiguous'       // can't parse — needs Claude

export interface CorrectionResult {
  type: CorrectionType
  productQuery?: string
  quantity?: number
  delta?: number // positive = add, negative = subtract
}

// ─── Patterns ────────────────────────────────────────────────────────────────

// Strip leading correction signal words so we can parse what's left
const CORRECTION_PREFIXES = /^(mali[,.]?\s*|mali yung\s*|wrong[,.]?\s*|hindi tama[,.]?\s*|ayaw\s*|edit\s*|baguhin\s*|dapat\s*)/i

// "dagdag 2 coke" / "add 2 more coke" / "plus 2 coke"
const ADD_MORE_RE = /(?:dagdag|add|plus|idagdag)\s+(\d+)\s+(.+)/i

// "bawasan ng 1 coke" / "minus 1 coke" / "less 1 coke"
const SUBTRACT_RE = /(?:bawasan|minus|less|ibawas)(?:\s+ng?)?\s+(\d+)\s+(.+)/i

// "wag yung sprite" / "remove sprite" / "tanggalin sprite" / "cancel sprite"
const REMOVE_RE = /(?:wag|wag na|remove|tanggalin|alisin|cancel|wala na)\s+(?:yung\s+|ang\s+)?(.+)/i

// "dapat 3 coke" / "3 coke dapat" / "mali, 3 coke" / "3 lang yung coke"
const SET_QTY_RE = /(?:^|\s)(\d+)\s*(?:lang\s+)?(?:yung\s+|ang\s+)?(.+?)(?:\s+dapat)?$/i

// Plain item line — used when we're already in awaiting_correction state
// Matches "3 coke 1 sprite" as a full cart replacement
const MULTI_ITEM_RE = /^(?:\d+\s*[xX]?\s+\S+(?:\s+|,\s*)?)+$/

export function parseCorrection(
  message: string,
  currentCart: CartItem[]
): CorrectionResult {
  const raw = message.trim()

  // Remove correction signal prefix to get the actual content
  const stripped = raw.replace(CORRECTION_PREFIXES, '').trim()

  // "wag yung sprite" / "remove sprite"
  const removeMatch = REMOVE_RE.exec(raw)
  if (removeMatch) {
    return { type: 'remove_item', productQuery: removeMatch[1].trim() }
  }

  // "dagdag 1 coke"
  const addMatch = ADD_MORE_RE.exec(stripped)
  if (addMatch) {
    return {
      type: 'adjust_quantity',
      delta: parseInt(addMatch[1], 10),
      productQuery: addMatch[2].trim(),
    }
  }

  // "bawasan ng 1 coke"
  const subMatch = SUBTRACT_RE.exec(stripped)
  if (subMatch) {
    return {
      type: 'adjust_quantity',
      delta: -parseInt(subMatch[1], 10),
      productQuery: subMatch[2].trim(),
    }
  }

  // "3 coke" / "dapat 3 coke" / "mali, 3 coke"
  const setMatch = SET_QTY_RE.exec(stripped)
  if (setMatch) {
    return {
      type: 'set_quantity',
      quantity: parseInt(setMatch[1], 10),
      productQuery: setMatch[2].trim(),
    }
  }

  // If the stripped message looks like a full order ("3 coke 1 sprite"),
  // treat as full cart replacement — only when cart has items to compare
  if (currentCart.length > 0 && MULTI_ITEM_RE.test(stripped)) {
    return { type: 'full_replace' }
  }

  return { type: 'ambiguous' }
}

// ─── Apply correction to cart ─────────────────────────────────────────────────

import { fuzzyMatchProduct } from './pattern-matcher.js'

interface ProductRef {
  id: string
  name: string
  price: number
}

export function applyCorrectionToCart(
  result: CorrectionResult,
  cart: CartItem[],
  products: ProductRef[]
): { cart: CartItem[]; applied: boolean; description: string } {
  if (result.type === 'ambiguous' || result.type === 'full_replace') {
    return { cart, applied: false, description: '' }
  }

  if (result.type === 'remove_item' && result.productQuery) {
    const idx = cart.findIndex((i) =>
      i.productName.toLowerCase().includes(result.productQuery!.toLowerCase())
    )
    if (idx < 0) {
      // Try fuzzy match against products
      const match = fuzzyMatchProduct(result.productQuery, products)
      const cartIdx = match
        ? cart.findIndex((i) => i.productId === match.product.id)
        : -1
      if (cartIdx < 0) return { cart, applied: false, description: '' }
      const removed = cart[cartIdx]
      return {
        cart: cart.filter((_, i) => i !== cartIdx),
        applied: true,
        description: `Tinanggal: ${removed.productName}`,
      }
    }
    const removed = cart[idx]
    return {
      cart: cart.filter((_, i) => i !== idx),
      applied: true,
      description: `Tinanggal: ${removed.productName}`,
    }
  }

  if (
    (result.type === 'set_quantity' || result.type === 'adjust_quantity') &&
    result.productQuery
  ) {
    // Find in cart first, then fuzzy match products
    let cartIdx = cart.findIndex((i) =>
      i.productName.toLowerCase().includes(result.productQuery!.toLowerCase())
    )

    if (cartIdx < 0) {
      const match = fuzzyMatchProduct(result.productQuery, products)
      if (match) {
        cartIdx = cart.findIndex((i) => i.productId === match.product.id)
      }
    }

    if (cartIdx < 0) return { cart, applied: false, description: '' }

    const item = cart[cartIdx]
    const newQty =
      result.type === 'set_quantity'
        ? result.quantity!
        : Math.max(0, item.quantity + result.delta!)

    if (newQty === 0) {
      return {
        cart: cart.filter((_, i) => i !== cartIdx),
        applied: true,
        description: `Tinanggal: ${item.productName}`,
      }
    }

    const updated = [...cart]
    updated[cartIdx] = {
      ...item,
      quantity: newQty,
      subtotal: newQty * item.unitPrice,
    }
    return {
      cart: updated,
      applied: true,
      description: `${item.productName}: ${newQty} na.`,
    }
  }

  return { cart, applied: false, description: '' }
}
