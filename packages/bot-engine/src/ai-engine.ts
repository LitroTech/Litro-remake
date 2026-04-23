import { puter } from '@heyputer/puter.js'
import type { CartItem } from '@litro/types'
import {
  buildCorrectionPrompt,
  buildBusinessQuestionPrompt,
  type StoreContext,
} from './context-builder.js'

const CORRECTION_MODEL = 'claude-haiku-4-5'
const QUESTION_MODEL = 'claude-sonnet-4-6'

export interface CorrectionResult {
  reply: string
  correctedCart: CartItem[]
}

export interface QuestionResult {
  reply: string
}

export class AiEngine {
  async correctCart(
    ctx: StoreContext,
    userMessage: string
  ): Promise<CorrectionResult> {
    const { systemContent, userContent } = buildCorrectionPrompt(ctx, userMessage)
    const prompt = `${systemContent}\n\n${userContent}`

    const response = await puter.ai.chat(prompt, { model: CORRECTION_MODEL })
    const raw = response?.message?.content?.[0]?.text ?? ''
    return parseCorrectionResponse(raw, ctx.cart)
  }

  async answerQuestion(
    ctx: StoreContext,
    question: string
  ): Promise<QuestionResult> {
    const { systemContent, userContent } = buildBusinessQuestionPrompt(ctx, question)
    const prompt = `${systemContent}\n\n${userContent}`

    const response = await puter.ai.chat(prompt, { model: QUESTION_MODEL })
    const reply = response?.message?.content?.[0]?.text ?? ''
    return { reply }
  }

  async absorbPattern(
    storeId: string,
    originalMessage: string,
    correctedCart: CartItem[]
  ): Promise<{ pattern: string; intent: string; parameters: unknown } | null> {
    if (correctedCart.length !== 1) return null

    const item = correctedCart[0]
    const normalized = originalMessage.toLowerCase().trim()
    if (item.productName && normalized.includes(item.productName.toLowerCase())) {
      return {
        pattern: `\\b${escapeRegex(item.productName.toLowerCase())}\\b`,
        intent: 'add_to_cart',
        parameters: {
          productName: item.productName,
          unitPrice: item.unitPrice,
        },
      }
    }

    return null
  }
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseCorrectionResponse(raw: string, fallback: CartItem[]): CorrectionResult {
  const jsonMatch = raw.match(/\{[\s\S]*"cart"[\s\S]*\}/)
  if (!jsonMatch) {
    return { reply: raw.trim(), correctedCart: fallback }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { cart: CartItem[] }
    const replyText = raw.slice(0, raw.indexOf(jsonMatch[0])).trim()
    return {
      reply: replyText || 'Updated ang cart.',
      correctedCart: parsed.cart,
    }
  } catch {
    return { reply: raw.trim(), correctedCart: fallback }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
