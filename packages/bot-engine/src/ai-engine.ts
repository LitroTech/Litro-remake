import Anthropic from '@anthropic-ai/sdk'
import type { CartItem } from '@litro/types'
import {
  buildCorrectionPrompt,
  buildBusinessQuestionPrompt,
  type StoreContext,
} from './context-builder.js'

const CORRECTION_MODEL = 'claude-haiku-4-5-20251001'
const QUESTION_MODEL = 'claude-sonnet-4-6'

export interface CorrectionResult {
  reply: string
  correctedCart: CartItem[]
}

export interface QuestionResult {
  reply: string
}

export class AiEngine {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  /**
   * Corrects the cart based on a user correction message.
   * Uses Haiku for speed and low cost. Prompt caching on system content.
   * Max 1 AI call per correction flow.
   */
  async correctCart(
    ctx: StoreContext,
    userMessage: string
  ): Promise<CorrectionResult> {
    const { systemContent, userContent } = buildCorrectionPrompt(ctx, userMessage)

    const response = await this.client.messages.create({
      model: CORRECTION_MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: systemContent,
          // Cache the system prompt — product catalog rarely changes within a session
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    return parseCorrectionResponse(raw, ctx.cart)
  }

  /**
   * Answers a freeform business question.
   * Uses Sonnet for better quality. Rate-limited per tier.
   */
  async answerQuestion(
    ctx: StoreContext,
    question: string
  ): Promise<QuestionResult> {
    const { systemContent, userContent } = buildBusinessQuestionPrompt(
      ctx,
      question
    )

    const response = await this.client.messages.create({
      model: QUESTION_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemContent,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })

    const reply =
      response.content[0].type === 'text' ? response.content[0].text : ''
    return { reply }
  }

  /**
   * Absorbs a successful AI correction into the pattern library.
   * Called asynchronously — non-blocking, best effort.
   */
  async absorbPattern(
    storeId: string,
    originalMessage: string,
    correctedCart: CartItem[]
  ): Promise<{ pattern: string; intent: string; parameters: unknown } | null> {
    // Only absorb if the correction was simple enough to express as a pattern
    if (correctedCart.length !== 1) return null

    const item = correctedCart[0]
    // Build a regex-expressible pattern from the original message + correction
    const normalized = originalMessage.toLowerCase().trim()
    // Simple heuristic: if original contained the product name, create a pattern
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
