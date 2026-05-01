import Anthropic from '@anthropic-ai/sdk'
import type { CartItem } from '@litro/types'
import {
  buildCorrectionPrompt,
  buildBusinessQuestionPrompt,
  type StoreContext,
} from './context-builder.js'

const HAIKU = 'claude-haiku-4-5'
const SONNET = 'claude-sonnet-4-6'

export interface CorrectionResult {
  reply: string
  correctedCart: CartItem[]
}

export interface QuestionResult {
  reply: string
}

export class AiEngine {
  private client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey })
  }

  /**
   * Corrects the cart based on a user correction message.
   * Uses Haiku for speed and low cost. Prompt caching on the system block
   * (store catalog + name) which changes rarely between calls.
   */
  async correctCart(ctx: StoreContext, userMessage: string): Promise<CorrectionResult> {
    const { systemContent, userContent } = buildCorrectionPrompt(ctx, userMessage)

    const response = await this.client.messages.create({
      model: HAIKU,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: systemContent,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    })

    return parseCorrectionResponse(extractText(response), ctx.cart)
  }

  /**
   * Answers a freeform business question.
   * Uses Sonnet for better quality. Rate-limited per tier.
   */
  async answerQuestion(ctx: StoreContext, question: string): Promise<QuestionResult> {
    const { systemContent, userContent } = buildBusinessQuestionPrompt(ctx, question)

    const response = await this.client.messages.create({
      model: SONNET,
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

    return { reply: extractText(response) }
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(response: Anthropic.Message): string {
  const block = response.content[0]
  return block?.type === 'text' ? block.text : ''
}

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
