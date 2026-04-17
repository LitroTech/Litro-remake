// ─── Enums ───────────────────────────────────────────────────────────────────

export type Language = 'tl' | 'en'
export type StockMode = 'numerical' | 'descriptive'
export type StockLevel = 'high' | 'medium' | 'low' | 'none'
export type PaymentMethod = 'cash' | 'gcash' | 'card' | 'credit'
export type Channel = 'app' | 'messenger'
export type AlertType = 'low' | 'critical' | 'out_of_stock'
export type SubscriptionTier = 'basic' | 'pro' | 'ultra'
export type PatternSource = 'manual' | 'ai'

// ─── Store ────────────────────────────────────────────────────────────────────

export interface StoreSettings {
  language: Language
  proMode: boolean
  subscriptionTier: SubscriptionTier
  moneyDashboard: {
    staffCanSeeTotal: boolean
    staffCanSeeCashDrawer: boolean
    staffCanSeeExpenses: boolean
  }
  onboarding: {
    isTechy: boolean
  }
}

export interface Store {
  id: string
  name: string
  accessCode: string
  settings: StoreSettings
  createdAt: string
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string
  storeId: string
  name: string
  /** True if this staff has a Messenger identity linked */
  hasMessengerLinked: boolean
  joinedAt: string
  removedAt: string | null
}

// ─── Product ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  storeId: string
  name: string
  price: number
  photoUrl: string | null
  stockMode: StockMode
  /** Only set when stockMode = 'numerical' */
  quantity: number | null
  /** Only set when stockMode = 'descriptive' */
  stockLevel: StockLevel | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Computed stock color for numerical mode */
export type StockColor = 'green' | 'yellow' | 'red' | 'grey'

export function getStockColor(product: Product): StockColor | null {
  if (product.stockMode !== 'numerical' || product.quantity === null) return null
  if (product.quantity === 0) return 'grey'
  // We need initialQuantity to compute %, so the API returns stockColor directly
  return null
}

// ─── Transaction ──────────────────────────────────────────────────────────────

export interface TransactionItem {
  id: string
  transactionId: string
  productId: string | null
  productName: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export interface Transaction {
  id: string
  storeId: string
  staffId: string
  staffName: string
  paymentMethod: PaymentMethod
  totalAmount: number
  creditCustomerId: string | null
  items: TransactionItem[]
  submittedAt: string
  voidedAt: string | null
  voidedBy: string | null
  channel: Channel
}

// ─── Cart (in-flight, before submission) ─────────────────────────────────────

export interface CartItem {
  productId: string | null
  productName: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export interface Cart {
  items: CartItem[]
  paymentMethod: PaymentMethod | null
  creditCustomerId: string | null
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface Expense {
  id: string
  storeId: string
  loggedBy: string
  loggedByName: string
  name: string
  amount: number
  photoUrl: string | null
  createdAt: string
}

// ─── Credit ───────────────────────────────────────────────────────────────────

export interface CreditCustomer {
  id: string
  storeId: string
  name: string
  phone: string | null
  /** Total unpaid balance (sum of credit transactions - sum of payments) */
  balance: number
  /** Date of most recent payment, null if never paid */
  lastPaidAt: string | null
  createdAt: string
}

export interface CreditPayment {
  id: string
  customerId: string
  storeId: string
  amount: number
  paidAt: string
  note: string | null
}

// ─── Cash Drawer ──────────────────────────────────────────────────────────────

export interface CashDrawerSession {
  id: string
  storeId: string
  date: string
  openedAt: string
  openingAmount: number | null
  closedAt: string | null
  closingAmount: number | null
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export interface StockAlert {
  id: string
  storeId: string
  productId: string
  productName: string
  alertType: AlertType
  triggeredAt: string
  acknowledgedAt: string | null
}

// ─── Milestones + Nudges ─────────────────────────────────────────────────────

export type MilestoneKey =
  | 'store_created'
  | 'first_product'
  | 'first_sale'
  | 'first_low_stock'
  | 'streak_7_days'
  | 'milestone_30_days'

export type NudgeKey =
  | 'chatbot_day1'
  | 'transaction_history_after_5_sales'
  | 'money_dashboard_after_3_days'
  | 'pro_discovery_after_month1'

export interface Milestone {
  key: MilestoneKey
  achievedAt: string
  shown: boolean
}

// ─── Bot Engine ───────────────────────────────────────────────────────────────

export type BotIntent =
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'clear_cart'
  | 'show_cart'
  | 'show_total'
  | 'submit_cart'
  | 'credit_sale'
  | 'credit_payment'
  | 'check_stock'
  | 'business_question'
  | 'correction'
  | 'unknown'

export interface ParsedIntent {
  intent: BotIntent
  confidence: number
  params: Record<string, unknown>
}

export interface BotContext {
  storeId: string
  staffId: string
  channel: Channel
  message: string
  cart: CartItem[]
  correctionMode: boolean
  language: Language
}

export interface BotResponse {
  reply: string
  cartUpdate: CartItem[] | null
  action: BotAction | null
  usedAi: boolean
}

export type BotAction =
  | { type: 'submit_transaction'; paymentMethod: PaymentMethod; creditCustomerId?: string }
  | { type: 'log_credit_sale'; customerId: string; amount: number }
  | { type: 'log_credit_payment'; customerId: string; amount: number }
  | { type: 'show_stock'; productId: string }

// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  code?: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface OwnerSession {
  storeId: string
  role: 'owner'
}

export interface StaffSession {
  storeId: string
  staffId: string
  role: 'staff'
}

export type Session = OwnerSession | StaffSession
