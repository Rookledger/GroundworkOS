CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"address" text,
	"vat_number" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"job_number" text NOT NULL,
	"title" text NOT NULL,
	"client_id" text,
	"type" text,
	"site_address" text,
	"value" real,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'enquiry' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"description" text,
	"foreman" text,
	"crew_count" integer,
	"nrswa_required" boolean DEFAULT false NOT NULL,
	"permit_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_job_number_unique" UNIQUE("job_number")
);
--> statement-breakpoint
CREATE TABLE "line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" real DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'No' NOT NULL,
	"unit_price" real DEFAULT 0 NOT NULL,
	"total" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_number" text NOT NULL,
	"client_id" text,
	"job_id" text,
	"title" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" real DEFAULT 0 NOT NULL,
	"vat_amount" real DEFAULT 0 NOT NULL,
	"total_amount" real DEFAULT 0 NOT NULL,
	"valid_until" date,
	"notes" text,
	"sent_at" timestamp with time zone,
	"share_token" text,
	"approved_by_name" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_quote_number_unique" UNIQUE("quote_number"),
	CONSTRAINT "quotes_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"client_id" text,
	"job_id" text,
	"quote_id" text,
	"subcontractor_id" text,
	"subtotal" real DEFAULT 0 NOT NULL,
	"vat_amount" real DEFAULT 0 NOT NULL,
	"total_amount" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issued_date" date NOT NULL,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"notes" text,
	"cis_deduction" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "subcontractors" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"utr_number" text,
	"cis_status" text DEFAULT 'unverified' NOT NULL,
	"cis_deduction_rate" real DEFAULT 30 NOT NULL,
	"trade" text,
	"nrswa_card_number" text,
	"nrswa_expiry" date,
	"public_liability_expiry" date,
	"cscs_card_expiry" date,
	"address" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'valid' NOT NULL,
	"expiry_date" date,
	"issued_date" date,
	"related_to" text DEFAULT 'company' NOT NULL,
	"related_id" text,
	"related_name" text,
	"notes" text,
	"file_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text,
	"title" text NOT NULL,
	"start_datetime" timestamp with time zone NOT NULL,
	"end_datetime" timestamp with time zone NOT NULL,
	"crew_count" integer DEFAULT 1 NOT NULL,
	"plant_assigned" text,
	"foreman" text,
	"notes" text,
	"type" text DEFAULT 'site_work' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plant" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"registration" text,
	"category" text NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"status" text DEFAULT 'available' NOT NULL,
	"current_job_id" text,
	"service_due" date,
	"mot_due" date,
	"thorough_exam_due" date,
	"notes" text,
	"daily_rate" real,
	"owned" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_book" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"labour_rate" real DEFAULT 0 NOT NULL,
	"material_rate" real DEFAULT 0 NOT NULL,
	"plant_rate" real DEFAULT 0 NOT NULL,
	"total_rate" real DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xero_client_map" (
	"client_id" text PRIMARY KEY NOT NULL,
	"xero_contact_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xero_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"tenant_name" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xero_invoice_map" (
	"invoice_id" text PRIMARY KEY NOT NULL,
	"xero_invoice_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xero_quote_map" (
	"quote_id" text PRIMARY KEY NOT NULL,
	"xero_quote_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_client_map" (
	"client_id" text PRIMARY KEY NOT NULL,
	"quickbooks_customer_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"realm_id" text NOT NULL,
	"company_name" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_invoice_map" (
	"invoice_id" text PRIMARY KEY NOT NULL,
	"quickbooks_invoice_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quickbooks_quote_map" (
	"quote_id" text PRIMARY KEY NOT NULL,
	"quickbooks_estimate_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sage_client_map" (
	"client_id" text PRIMARY KEY NOT NULL,
	"sage_contact_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sage_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"business_name" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sage_invoice_map" (
	"invoice_id" text PRIMARY KEY NOT NULL,
	"sage_invoice_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sage_quote_map" (
	"quote_id" text PRIMARY KEY NOT NULL,
	"sage_quote_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freeagent_client_map" (
	"client_id" text PRIMARY KEY NOT NULL,
	"freeagent_contact_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freeagent_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" text,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freeagent_invoice_map" (
	"invoice_id" text PRIMARY KEY NOT NULL,
	"freeagent_invoice_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "freeagent_quote_map" (
	"quote_id" text PRIMARY KEY NOT NULL,
	"freeagent_estimate_id" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text,
	"worker_name" text NOT NULL,
	"work_date" date NOT NULL,
	"hours_worked" real DEFAULT 8 NOT NULL,
	"day_rate" real,
	"cost" real,
	"description" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"job_id" text,
	"supplier" text NOT NULL,
	"description" text NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"vat_amount" real DEFAULT 0 NOT NULL,
	"total_amount" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery" date,
	"delivery_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb,
	"user_id" text,
	"user_name" text,
	"user_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "id_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
