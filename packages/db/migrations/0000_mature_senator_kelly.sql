CREATE TABLE IF NOT EXISTS "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"date" date NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_store_date_unique" UNIQUE("store_id","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cash_drawer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"date" date NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_by" uuid NOT NULL,
	"opening_amount" numeric(10, 2),
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"closing_amount" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coaching_nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"nudge_key" varchar(50) NOT NULL,
	"shown_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	CONSTRAINT "nudges_store_key_unique" UNIQUE("store_id","nudge_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"amount_allocated" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logged_by" uuid,
	"note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"logged_by" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messenger_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"psid" text NOT NULL,
	"store_id" uuid NOT NULL,
	"staff_id" uuid,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credit_customer_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messenger_carts_psid_unique" UNIQUE("psid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"milestone_key" varchar(50) NOT NULL,
	"achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shown_at" timestamp with time zone,
	CONSTRAINT "milestones_store_key_unique" UNIQUE("store_id","milestone_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pattern_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid,
	"pattern" text NOT NULL,
	"intent" varchar(50) NOT NULL,
	"parameters" jsonb,
	"confidence" numeric(3, 2),
	"source" varchar(10) DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"photo_url" text,
	"stock_mode" varchar(12) NOT NULL,
	"quantity" integer,
	"stock_level" varchar(10),
	"initial_quantity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"app_session_token_hash" varchar(64),
	"messenger_psid" text,
	"linked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "staff_members_app_session_token_hash_unique" UNIQUE("app_session_token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"alert_type" varchar(20) NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"access_code" varchar(8) NOT NULL,
	"owner_token_hash" varchar(64) NOT NULL,
	"recovery_code_hash" varchar(64) NOT NULL,
	"subscription_tier" varchar(10) DEFAULT 'basic' NOT NULL,
	"language" varchar(5) DEFAULT 'tl' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_access_code_unique" UNIQUE("access_code"),
	CONSTRAINT "stores_owner_token_hash_unique" UNIQUE("owner_token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"payment_method" varchar(10) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"credit_customer_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"channel" varchar(10) DEFAULT 'app' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_opened_by_staff_members_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cash_drawer_sessions" ADD CONSTRAINT "cash_drawer_sessions_closed_by_staff_members_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coaching_nudges" ADD CONSTRAINT "coaching_nudges_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_customers" ADD CONSTRAINT "credit_customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_payment_allocations" ADD CONSTRAINT "credit_payment_allocations_payment_id_credit_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."credit_payments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_payment_allocations" ADD CONSTRAINT "credit_payment_allocations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_customer_id_credit_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."credit_customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_payments" ADD CONSTRAINT "credit_payments_logged_by_staff_members_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_logged_by_staff_members_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messenger_carts" ADD CONSTRAINT "messenger_carts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messenger_carts" ADD CONSTRAINT "messenger_carts_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messenger_carts" ADD CONSTRAINT "messenger_carts_credit_customer_id_credit_customers_id_fk" FOREIGN KEY ("credit_customer_id") REFERENCES "public"."credit_customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pattern_library" ADD CONSTRAINT "pattern_library_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stock_alerts" ADD CONSTRAINT "stock_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_customer_id_credit_customers_id_fk" FOREIGN KEY ("credit_customer_id") REFERENCES "public"."credit_customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_voided_by_staff_members_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cash_drawer_store_date_idx" ON "cash_drawer_sessions" USING btree ("store_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_customers_store_idx" ON "credit_customers" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_customers_store_name_idx" ON "credit_customers" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpa_payment_idx" ON "credit_payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpa_transaction_idx" ON "credit_payment_allocations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_payments_customer_idx" ON "credit_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_store_idx" ON "expenses" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pattern_library_store_idx" ON "pattern_library" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_store_idx" ON "products" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_store_name_idx" ON "products" USING btree ("store_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_store_idx" ON "staff_members" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_psid_idx" ON "staff_members" USING btree ("messenger_psid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_alerts_store_idx" ON "stock_alerts" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_alerts_unacked_idx" ON "stock_alerts" USING btree ("store_id","acknowledged_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_store_idx" ON "transactions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_store_date_idx" ON "transactions" USING btree ("store_id","submitted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_credit_customer_idx" ON "transactions" USING btree ("credit_customer_id");