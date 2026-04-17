import type { CartItem } from '@litro/types'

export type ConversationStateType =
  | 'idle'
  | 'awaiting_correction'    // user said "mali", waiting for corrected order
  | 'awaiting_payment_method' // cart submitted, waiting for "cash/gcash/card/credit"
  | 'awaiting_credit_customer' // payment=credit, waiting for customer name
  | 'awaiting_void_pin'       // void requested, waiting for owner PIN

export interface ConversationState {
  type: ConversationStateType
  /** Cart snapshot at time of state transition */
  pendingCart?: CartItem[]
  /** Generic payload (e.g. transaction ID for void, partial amount for credit) */
  data?: Record<string, unknown>
  /** Unix ms — state auto-expires, never leaves a user stuck */
  expiresAt: number
}

export function isExpired(state: ConversationState): boolean {
  return Date.now() > state.expiresAt
}

/** How long each state waits before expiring (seconds) */
export const STATE_TTL: Record<ConversationStateType, number> = {
  idle: 0,
  awaiting_correction: 300,     // 5 min
  awaiting_payment_method: 120,  // 2 min
  awaiting_credit_customer: 120,
  awaiting_void_pin: 60,
}

// ─── Payment method parsing ───────────────────────────────────────────────────

const PAYMENT_MAP: Record<string, string> = {
  cash: 'cash', 'pera': 'cash', 'bayad': 'cash',
  gcash: 'gcash', 'gc': 'gcash', 'g-cash': 'gcash',
  card: 'card', 'credit card': 'card', 'debit': 'card',
  credit: 'credit', 'utang': 'credit', 'tab': 'credit', 'lista': 'credit',
}

export function parsePaymentMethod(message: string): string | null {
  const lower = message.toLowerCase().trim()
  return PAYMENT_MAP[lower] ?? null
}
