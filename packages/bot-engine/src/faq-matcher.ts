import type { StructuredQueryType } from './structured-query-detector.js'

export type EmbedderFn = (text: string) => Promise<Float32Array>

interface FaqEntry {
  question: string
  topic: StructuredQueryType
}

// Pre-defined questions — embeddings computed once at startup
const FAQ_ENTRIES: FaqEntry[] = [
  // Today's sales
  { question: 'magkano ang benta natin ngayon', topic: 'today_sales' },
  { question: 'kumusta ang benta ngayon', topic: 'today_sales' },
  { question: 'how much did we make today', topic: 'today_sales' },
  { question: 'total sales today', topic: 'today_sales' },
  { question: 'anong total ngayon', topic: 'today_sales' },
  { question: 'ilang piso na ang benta', topic: 'today_sales' },
  { question: 'pano ang benta natin today', topic: 'today_sales' },
  { question: 'magkano na nakuha natin ngayon', topic: 'today_sales' },

  // Week sales
  { question: 'kumusta ang benta ngayong linggo', topic: 'week_sales' },
  { question: 'how are sales this week', topic: 'week_sales' },
  { question: 'lingguhang benta natin', topic: 'week_sales' },
  { question: 'weekly sales summary', topic: 'week_sales' },
  { question: 'pano ang benta this week', topic: 'week_sales' },

  // Month sales
  { question: 'kumusta ang benta ngayong buwan', topic: 'month_sales' },
  { question: 'monthly sales', topic: 'month_sales' },
  { question: 'buwanang benta natin', topic: 'month_sales' },

  // Top products
  { question: 'ano ang pinakamaraming nabenta', topic: 'top_products' },
  { question: 'ano ang best seller natin', topic: 'top_products' },
  { question: 'what is selling the most', topic: 'top_products' },
  { question: 'anong produkto ang pinaka popular', topic: 'top_products' },
  { question: 'top selling products this week', topic: 'top_products' },
  { question: 'ano ang madalas bilhin ng customers', topic: 'top_products' },
  { question: 'which products are most popular', topic: 'top_products' },

  // Low stock
  { question: 'ano ang mababa na stock', topic: 'low_stock' },
  { question: 'anong kulang na kailangan mag order', topic: 'low_stock' },
  { question: 'what needs restocking', topic: 'low_stock' },
  { question: 'anong mauubos na', topic: 'low_stock' },
  { question: 'low stock items natin', topic: 'low_stock' },
  { question: 'anong bibilhin natin bukas', topic: 'low_stock' },
  { question: 'what should we reorder', topic: 'low_stock' },

  // Top credits
  { question: 'sino ang may pinakamalaking utang', topic: 'top_credits' },
  { question: 'who owes us the most money', topic: 'top_credits' },
  { question: 'anong pinakamalaking balance', topic: 'top_credits' },
  { question: 'listahan ng mga may tab', topic: 'top_credits' },
  { question: 'credit list natin', topic: 'top_credits' },
  { question: 'sino pa hindi nagbabayad ng tab', topic: 'top_credits' },

  // Expenses
  { question: 'magkano ang gastos natin ngayon', topic: 'expense_total' },
  { question: 'total expenses today', topic: 'expense_total' },
  { question: 'anong gastos natin', topic: 'expense_total' },
  { question: 'how much did we spend today', topic: 'expense_total' },
]

export class FaqMatcher {
  private embeddings: Array<{ entry: FaqEntry; embedding: Float32Array }> = []
  private ready = false

  async initialize(embedder: EmbedderFn): Promise<void> {
    for (const entry of FAQ_ENTRIES) {
      const embedding = await embedder(entry.question)
      this.embeddings.push({ entry, embedding })
    }
    this.ready = true
  }

  async findMatch(
    message: string,
    embedder: EmbedderFn,
    threshold = 0.82
  ): Promise<{ topic: StructuredQueryType; score: number } | null> {
    if (!this.ready) return null

    const msgEmbedding = await embedder(message.toLowerCase().trim())
    let best: { topic: StructuredQueryType; score: number } | null = null

    for (const { entry, embedding } of this.embeddings) {
      const score = cosineSimilarity(msgEmbedding, embedding)
      if (!best || score > best.score) {
        best = { topic: entry.topic, score }
      }
    }

    return best && best.score >= threshold ? best : null
  }
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
