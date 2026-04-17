import type { Language } from '@litro/types'
import type { StructuredQueryType } from './structured-query-detector.js'

// ─── Data shapes (returned by deps) ──────────────────────────────────────────

export interface AnalyticsSummary {
  period: 'today' | 'week' | 'month'
  totalSales: number
  txCount: number
  previousPeriodSales: number
  totalExpenses: number
}

export interface TopProduct {
  name: string
  unitsSold: number
  revenue: number
}

export interface LowStockItem {
  name: string
  quantity: number
  initialQuantity: number
  alertType: 'low' | 'critical' | 'out_of_stock'
}

export interface CreditSummary {
  name: string
  balance: number
  daysSinceLastPayment: number | null
}

// ─── Formatters ───────────────────────────────────────────────────────────────

export function formatSalesSummary(data: AnalyticsSummary, lang: Language): string {
  const pct =
    data.previousPeriodSales > 0
      ? Math.round(((data.totalSales - data.previousPeriodSales) / data.previousPeriodSales) * 100)
      : null

  const periodLabel =
    data.period === 'today'
      ? lang === 'tl' ? 'ngayon' : 'today'
      : data.period === 'week'
      ? lang === 'tl' ? 'ngayong linggo' : 'this week'
      : lang === 'tl' ? 'ngayong buwan' : 'this month'

  if (lang === 'tl') {
    let msg = `Benta ${periodLabel}: ₱${fmt(data.totalSales)} (${data.txCount} transactions).`
    if (pct !== null) {
      msg +=
        pct >= 0
          ? ` Taas ng ${pct}% kumpara ${data.period === 'today' ? 'kahapon' : 'sa nakaraan'}!`
          : ` Baba ng ${Math.abs(pct)}% kumpara ${data.period === 'today' ? 'kahapon' : 'sa nakaraan'}.`
    }
    if (data.totalExpenses > 0) {
      msg += ` Gastos: ₱${fmt(data.totalExpenses)}. Net: ₱${fmt(data.totalSales - data.totalExpenses)}.`
    }
    return msg
  }

  let msg = `Sales ${periodLabel}: ₱${fmt(data.totalSales)} (${data.txCount} transactions).`
  if (pct !== null) {
    msg +=
      pct >= 0
        ? ` Up ${pct}% from ${data.period === 'today' ? 'yesterday' : 'last period'}!`
        : ` Down ${Math.abs(pct)}% from ${data.period === 'today' ? 'yesterday' : 'last period'}.`
  }
  if (data.totalExpenses > 0) {
    msg += ` Expenses: ₱${fmt(data.totalExpenses)}. Net: ₱${fmt(data.totalSales - data.totalExpenses)}.`
  }
  return msg
}

export function formatTopProducts(products: TopProduct[], lang: Language): string {
  if (products.length === 0) {
    return lang === 'tl' ? 'Wala pang sales data.' : 'No sales data yet.'
  }

  const list = products
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${p.name} — ${p.unitsSold} units (₱${fmt(p.revenue)})`)
    .join('\n')

  return lang === 'tl'
    ? `Top products:\n${list}`
    : `Top selling products:\n${list}`
}

export function formatLowStock(items: LowStockItem[], lang: Language): string {
  if (items.length === 0) {
    return lang === 'tl'
      ? 'Okay naman ang lahat ng stock!'
      : 'All stock levels are fine!'
  }

  const list = items
    .map((item) => {
      const status =
        item.alertType === 'out_of_stock'
          ? lang === 'tl' ? 'WALA NA' : 'OUT'
          : item.alertType === 'critical'
          ? lang === 'tl' ? 'kritikal' : 'critical'
          : lang === 'tl'
          ? 'mababa'
          : 'low'
      const qtyStr = item.alertType !== 'out_of_stock' ? ` (${item.quantity} na lang)` : ''
      return `• ${item.name}${qtyStr} — ${status}`
    })
    .join('\n')

  return lang === 'tl'
    ? `Mga kailangan ng pansin:\n${list}`
    : `Items needing attention:\n${list}`
}

export function formatCredits(credits: CreditSummary[], lang: Language): string {
  if (credits.length === 0) {
    return lang === 'tl' ? 'Walang open tabs!' : 'No open tabs!'
  }

  const list = credits
    .slice(0, 5)
    .map((c) => {
      const days =
        c.daysSinceLastPayment !== null
          ? lang === 'tl'
            ? ` — ${c.daysSinceLastPayment} araw na walang bayad`
            : ` — ${c.daysSinceLastPayment}d since last payment`
          : lang === 'tl'
          ? ' — hindi pa nagbabayad'
          : ' — never paid'
      return `• ${c.name}: ₱${fmt(c.balance)}${days}`
    })
    .join('\n')

  return lang === 'tl'
    ? `Mga may balance:\n${list}`
    : `Open tabs:\n${list}`
}

export function formatExpenses(totalExpenses: number, lang: Language): string {
  return lang === 'tl'
    ? `Gastos ngayon: ₱${fmt(totalExpenses)}.`
    : `Today's expenses: ₱${fmt(totalExpenses)}.`
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export interface AnalyticsData {
  summary?: AnalyticsSummary
  topProducts?: TopProduct[]
  lowStock?: LowStockItem[]
  credits?: CreditSummary[]
}

export function formatAnalyticsResponse(
  queryType: StructuredQueryType,
  data: AnalyticsData,
  lang: Language
): string {
  switch (queryType) {
    case 'today_sales':
    case 'week_sales':
    case 'month_sales':
      return data.summary
        ? formatSalesSummary(data.summary, lang)
        : lang === 'tl' ? 'Walang data pa.' : 'No data yet.'

    case 'top_products':
      return formatTopProducts(data.topProducts ?? [], lang)

    case 'low_stock':
      return formatLowStock(data.lowStock ?? [], lang)

    case 'top_credits':
      return formatCredits(data.credits ?? [], lang)

    case 'expense_total':
      return formatExpenses(data.summary?.totalExpenses ?? 0, lang)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
