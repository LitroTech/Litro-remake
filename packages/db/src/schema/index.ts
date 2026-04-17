import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  varchar,
  date,
  unique,
  index,
  boolean,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pk = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const storeRef = () =>
  uuid('store_id')
    .notNull()
    .references(() => stores.id, { onDelete: 'cascade' })

// ─── Stores ───────────────────────────────────────────────────────────────────

export const stores = pgTable('stores', {
  id: pk(),
  name: text('name').notNull(),
  /** 8-char alphanumeric code staff uses to join */
  accessCode: varchar('access_code', { length: 8 }).notNull().unique(),
  /** SHA-256 hash of owner's device token — used to issue new device JWTs */
  ownerTokenHash: varchar('owner_token_hash', { length: 64 }).notNull().unique(),
  /** 12-char recovery code shown once at store creation (hashed here) */
  recoveryCodeHash: varchar('recovery_code_hash', { length: 64 }).notNull(),
  subscriptionTier: varchar('subscription_tier', { length: 10 })
    .notNull()
    .default('basic'),
  language: varchar('language', { length: 5 }).notNull().default('tl'),
  settings: jsonb('settings')
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
})

// ─── Staff Members ────────────────────────────────────────────────────────────

export const staffMembers = pgTable(
  'staff_members',
  {
    id: pk(),
    storeId: storeRef(),
    name: text('name').notNull(),
    /** SHA-256 hash of the JWT token issued to this staff's app session */
    appSessionTokenHash: varchar('app_session_token_hash', { length: 64 }).unique(),
    /** Facebook Page-Scoped User ID — permanent Messenger identity */
    messengerPsid: text('messenger_psid'),
    /** Set when owner links app identity + Messenger identity */
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    joinedAt: createdAt(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => ({
    storeIdx: index('staff_store_idx').on(t.storeId),
    psidIdx: index('staff_psid_idx').on(t.messengerPsid),
  })
)

// ─── Products ─────────────────────────────────────────────────────────────────

export const products = pgTable(
  'products',
  {
    id: pk(),
    storeId: storeRef(),
    name: text('name').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    photoUrl: text('photo_url'),
    /**
     * 'numerical' — tracked as integer quantity, auto-deducted on checkout.
     * 'descriptive' — tracked as high/medium/low/none, manually updated.
     */
    stockMode: varchar('stock_mode', { length: 12 }).notNull(),
    quantity: integer('quantity'),
    /** high | medium | low | none — only used when stockMode = 'descriptive' */
    stockLevel: varchar('stock_level', { length: 10 }),
    /** Quantity at which this product was first stocked (for % color coding) */
    initialQuantity: integer('initial_quantity'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    storeIdx: index('products_store_idx').on(t.storeId),
    storeNameIdx: index('products_store_name_idx').on(t.storeId, t.name),
  })
)

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = pgTable(
  'transactions',
  {
    id: pk(),
    storeId: storeRef(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffMembers.id),
    paymentMethod: varchar('payment_method', { length: 10 }).notNull(),
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
    creditCustomerId: uuid('credit_customer_id').references(
      () => creditCustomers.id
    ),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => staffMembers.id),
    /** 'app' | 'messenger' */
    channel: varchar('channel', { length: 10 }).notNull().default('app'),
  },
  (t) => ({
    storeIdx: index('transactions_store_idx').on(t.storeId),
    storeDateIdx: index('transactions_store_date_idx').on(
      t.storeId,
      t.submittedAt
    ),
    creditCustomerIdx: index('transactions_credit_customer_idx').on(
      t.creditCustomerId
    ),
  })
)

// ─── Transaction Items ────────────────────────────────────────────────────────

export const transactionItems = pgTable('transaction_items', {
  id: pk(),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  /** Nullable — product may be deleted after transaction */
  productId: uuid('product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  /** Snapshot of name at time of sale — survives product deletion */
  productName: text('product_name').notNull(),
  /** Snapshot of price at time of sale */
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  quantity: integer('quantity').notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
})

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expenses = pgTable(
  'expenses',
  {
    id: pk(),
    storeId: storeRef(),
    loggedBy: uuid('logged_by')
      .notNull()
      .references(() => staffMembers.id),
    name: text('name').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    photoUrl: text('photo_url'),
    createdAt: createdAt(),
  },
  (t) => ({
    storeIdx: index('expenses_store_idx').on(t.storeId),
  })
)

// ─── Credit Customers ─────────────────────────────────────────────────────────

export const creditCustomers = pgTable(
  'credit_customers',
  {
    id: pk(),
    storeId: storeRef(),
    name: text('name').notNull(),
    phone: text('phone'),
    createdAt: createdAt(),
  },
  (t) => ({
    storeIdx: index('credit_customers_store_idx').on(t.storeId),
    storeNameIdx: index('credit_customers_store_name_idx').on(
      t.storeId,
      t.name
    ),
  })
)

// ─── Credit Payments ──────────────────────────────────────────────────────────

export const creditPayments = pgTable(
  'credit_payments',
  {
    id: pk(),
    storeId: storeRef(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => creditCustomers.id),
    amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
    loggedBy: uuid('logged_by').references(() => staffMembers.id),
    note: text('note'),
  },
  (t) => ({
    customerIdx: index('credit_payments_customer_idx').on(t.customerId),
  })
)

/**
 * FIFO payment allocation — each payment row tracks how it was distributed
 * across outstanding credit transactions, oldest first.
 */
export const creditPaymentAllocations = pgTable(
  'credit_payment_allocations',
  {
    id: pk(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => creditPayments.id, { onDelete: 'cascade' }),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id),
    amountAllocated: numeric('amount_allocated', {
      precision: 10,
      scale: 2,
    }).notNull(),
  },
  (t) => ({
    paymentIdx: index('cpa_payment_idx').on(t.paymentId),
    transactionIdx: index('cpa_transaction_idx').on(t.transactionId),
  })
)

// ─── Cash Drawer Sessions ─────────────────────────────────────────────────────

export const cashDrawerSessions = pgTable(
  'cash_drawer_sessions',
  {
    id: pk(),
    storeId: storeRef(),
    date: date('date').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    openedBy: uuid('opened_by')
      .notNull()
      .references(() => staffMembers.id),
    openingAmount: numeric('opening_amount', { precision: 10, scale: 2 }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: uuid('closed_by').references(() => staffMembers.id),
    closingAmount: numeric('closing_amount', { precision: 10, scale: 2 }),
  },
  (t) => ({
    storeDateIdx: index('cash_drawer_store_date_idx').on(t.storeId, t.date),
  })
)

// ─── Messenger Carts ──────────────────────────────────────────────────────────

/**
 * Server-side cart for Messenger sessions. Cart builds silently as
 * the user sends line-by-line items. Submit button commits the transaction.
 */
export const messengerCarts = pgTable('messenger_carts', {
  id: pk(),
  psid: text('psid').notNull().unique(),
  storeId: storeRef(),
  staffId: uuid('staff_id').references(() => staffMembers.id),
  items: jsonb('items').notNull().default(sql`'[]'::jsonb`),
  creditCustomerId: uuid('credit_customer_id').references(
    () => creditCustomers.id
  ),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ─── AI Usage (rate limiting) ─────────────────────────────────────────────────

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: pk(),
    storeId: storeRef(),
    date: date('date').notNull(),
    /** Counts only freeform business questions — cart corrections are free */
    questionCount: integer('question_count').notNull().default(0),
  },
  (t) => ({
    uniqueStoreDate: unique('ai_usage_store_date_unique').on(
      t.storeId,
      t.date
    ),
  })
)

// ─── Pattern Library ──────────────────────────────────────────────────────────

/**
 * Regex/token patterns the bot engine uses before falling back to Claude.
 * Global patterns (store_id = null) ship with the app.
 * AI-absorbed patterns are store-specific and grow over time.
 */
export const patternLibrary = pgTable(
  'pattern_library',
  {
    id: pk(),
    /** null = global pattern shipped with the app */
    storeId: uuid('store_id').references(() => stores.id, {
      onDelete: 'cascade',
    }),
    pattern: text('pattern').notNull(),
    intent: varchar('intent', { length: 50 }).notNull(),
    parameters: jsonb('parameters'),
    confidence: numeric('confidence', { precision: 3, scale: 2 }),
    /** 'manual' = shipped globally; 'ai' = absorbed from a Claude correction */
    source: varchar('source', { length: 10 }).notNull().default('manual'),
    createdAt: createdAt(),
  },
  (t) => ({
    storeIdx: index('pattern_library_store_idx').on(t.storeId),
  })
)

// ─── Stock Alerts ─────────────────────────────────────────────────────────────

export const stockAlerts = pgTable(
  'stock_alerts',
  {
    id: pk(),
    storeId: storeRef(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** 'low' (< 20%) | 'critical' (< 10%) | 'out_of_stock' (= 0) */
    alertType: varchar('alert_type', { length: 20 }).notNull(),
    triggeredAt: timestamp('triggered_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  },
  (t) => ({
    storeIdx: index('stock_alerts_store_idx').on(t.storeId),
    unacknowledgedIdx: index('stock_alerts_unacked_idx').on(
      t.storeId,
      t.acknowledgedAt
    ),
  })
)

// ─── Milestones ───────────────────────────────────────────────────────────────

export const milestones = pgTable(
  'milestones',
  {
    id: pk(),
    storeId: storeRef(),
    milestoneKey: varchar('milestone_key', { length: 50 }).notNull(),
    achievedAt: timestamp('achieved_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Null until the full-screen animation has been shown */
    shownAt: timestamp('shown_at', { withTimezone: true }),
  },
  (t) => ({
    uniqueStoreMilestone: unique('milestones_store_key_unique').on(
      t.storeId,
      t.milestoneKey
    ),
  })
)

// ─── Coaching Nudges ──────────────────────────────────────────────────────────

/**
 * Once shown, never shown again. Never shown to users who toggled any
 * advanced setting themselves (isTechy = true).
 */
export const coachingNudges = pgTable(
  'coaching_nudges',
  {
    id: pk(),
    storeId: storeRef(),
    nudgeKey: varchar('nudge_key', { length: 50 }).notNull(),
    shownAt: timestamp('shown_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
  },
  (t) => ({
    uniqueStoreNudge: unique('nudges_store_key_unique').on(
      t.storeId,
      t.nudgeKey
    ),
  })
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const storesRelations = relations(stores, ({ many }) => ({
  staffMembers: many(staffMembers),
  products: many(products),
  transactions: many(transactions),
  expenses: many(expenses),
  creditCustomers: many(creditCustomers),
  cashDrawerSessions: many(cashDrawerSessions),
  stockAlerts: many(stockAlerts),
  milestones: many(milestones),
  coachingNudges: many(coachingNudges),
  aiUsage: many(aiUsage),
}))

export const staffMembersRelations = relations(staffMembers, ({ one, many }) => ({
  store: one(stores, { fields: [staffMembers.storeId], references: [stores.id] }),
  transactions: many(transactions),
  expenses: many(expenses),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  transactionItems: many(transactionItems),
  stockAlerts: many(stockAlerts),
}))

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  store: one(stores, { fields: [transactions.storeId], references: [stores.id] }),
  staff: one(staffMembers, {
    fields: [transactions.staffId],
    references: [staffMembers.id],
  }),
  creditCustomer: one(creditCustomers, {
    fields: [transactions.creditCustomerId],
    references: [creditCustomers.id],
  }),
  items: many(transactionItems),
  creditAllocations: many(creditPaymentAllocations),
}))

export const transactionItemsRelations = relations(transactionItems, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionItems.transactionId],
    references: [transactions.id],
  }),
  product: one(products, {
    fields: [transactionItems.productId],
    references: [products.id],
  }),
}))

export const creditCustomersRelations = relations(
  creditCustomers,
  ({ one, many }) => ({
    store: one(stores, {
      fields: [creditCustomers.storeId],
      references: [stores.id],
    }),
    transactions: many(transactions),
    payments: many(creditPayments),
  })
)

export const creditPaymentsRelations = relations(creditPayments, ({ one, many }) => ({
  customer: one(creditCustomers, {
    fields: [creditPayments.customerId],
    references: [creditCustomers.id],
  }),
  allocations: many(creditPaymentAllocations),
}))

export const creditPaymentAllocationsRelations = relations(
  creditPaymentAllocations,
  ({ one }) => ({
    payment: one(creditPayments, {
      fields: [creditPaymentAllocations.paymentId],
      references: [creditPayments.id],
    }),
    transaction: one(transactions, {
      fields: [creditPaymentAllocations.transactionId],
      references: [transactions.id],
    }),
  })
)
