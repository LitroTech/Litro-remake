// Detects if a message can be answered from pre-computed data — no AI needed.

export type StructuredQueryType =
  | 'today_sales'
  | 'week_sales'
  | 'month_sales'
  | 'top_products'
  | 'low_stock'
  | 'top_credits'
  | 'expense_total'

interface QueryPattern {
  type: StructuredQueryType
  keywords: string[][]  // each inner array = one keyword group (ANY match triggers)
}

const PATTERNS: QueryPattern[] = [
  {
    type: 'today_sales',
    keywords: [
      ['benta ngayon', 'sales today', 'total ngayon', 'magkano benta', 'kumusta benta',
       'ilang piso na', 'how much today', 'today sales', 'daily sales', 'araw na benta'],
    ],
  },
  {
    type: 'week_sales',
    keywords: [
      ['lingguhang benta', 'this week', 'ngayong linggo', 'week sales', 'weekly',
       'benta ngayong linggo', 'sales this week'],
    ],
  },
  {
    type: 'month_sales',
    keywords: [
      ['buwanang benta', 'this month', 'ngayong buwan', 'month sales', 'monthly',
       'buwan na benta', 'sales this month'],
    ],
  },
  {
    type: 'top_products',
    keywords: [
      ['best seller', 'best selling', 'pinaka maraming nabenta', 'top products',
       'pinakamaraming nabenta', 'top selling', 'pinaka-popular', 'most sold',
       'what sells most', 'anong sikat'],
    ],
  },
  {
    type: 'low_stock',
    keywords: [
      ['mababa na stock', 'kulang na', 'low stock', 'mauubos na', 'kailangan mag-order',
       'restock', 'anong kulang', 'out of stock', 'wala na', 'needs restocking',
       'anong bibilhin', 'mag-order na'],
    ],
  },
  {
    type: 'top_credits',
    keywords: [
      ['pinakamalaking utang', 'pinakamalaking tab', 'who owes most', 'biggest balance',
       'malaking balance', 'pinakamalaking balance', 'top credits', 'sino may utang',
       'listahan ng utang', 'credit list'],
    ],
  },
  {
    type: 'expense_total',
    keywords: [
      ['gastos ngayon', 'total expenses', 'magkano gastos', 'how much expenses',
       'anong gastos', 'expenses today', 'daily expenses'],
    ],
  },
]

export function detectStructuredQuery(message: string): StructuredQueryType | null {
  const lower = message.toLowerCase()
  for (const pattern of PATTERNS) {
    for (const group of pattern.keywords) {
      if (group.some((kw) => lower.includes(kw))) {
        return pattern.type
      }
    }
  }
  return null
}
