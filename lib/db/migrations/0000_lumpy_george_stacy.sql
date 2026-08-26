CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`address` text,
	`vat_number` text,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_number` text NOT NULL,
	`title` text NOT NULL,
	`client_id` text,
	`type` text,
	`site_address` text,
	`value` real,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'enquiry' NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`description` text,
	`foreman` text,
	`crew_count` integer,
	`nrswa_required` integer DEFAULT false NOT NULL,
	`permit_number` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_job_number_unique` ON `jobs` (`job_number`);--> statement-breakpoint
CREATE TABLE `line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'No' NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_number` text NOT NULL,
	`client_id` text,
	`job_id` text,
	`title` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`valid_until` text,
	`notes` text,
	`sent_at` integer,
	`share_token` text,
	`approved_by_name` text,
	`approved_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_quote_number_unique` ON `quotes` (`quote_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_share_token_unique` ON `quotes` (`share_token`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`client_id` text,
	`job_id` text,
	`quote_id` text,
	`subcontractor_id` text,
	`subtotal` real DEFAULT 0 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issued_date` text NOT NULL,
	`due_date` text,
	`paid_at` integer,
	`notes` text,
	`cis_deduction` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `subcontractors` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`utr_number` text,
	`cis_status` text DEFAULT 'unverified' NOT NULL,
	`cis_deduction_rate` real DEFAULT 30 NOT NULL,
	`trade` text,
	`nrswa_card_number` text,
	`nrswa_expiry` text,
	`public_liability_expiry` text,
	`cscs_card_expiry` text,
	`address` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'valid' NOT NULL,
	`expiry_date` text,
	`issued_date` text,
	`related_to` text DEFAULT 'company' NOT NULL,
	`related_id` text,
	`related_name` text,
	`notes` text,
	`file_path` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedule_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`title` text NOT NULL,
	`start_datetime` integer NOT NULL,
	`end_datetime` integer NOT NULL,
	`crew_count` integer DEFAULT 1 NOT NULL,
	`plant_assigned` text,
	`foreman` text,
	`notes` text,
	`type` text DEFAULT 'site_work' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plant` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`registration` text,
	`category` text NOT NULL,
	`make` text,
	`model` text,
	`year` integer,
	`status` text DEFAULT 'available' NOT NULL,
	`current_job_id` text,
	`service_due` text,
	`mot_due` text,
	`thorough_exam_due` text,
	`notes` text,
	`daily_rate` real,
	`owned` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_book` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`unit` text NOT NULL,
	`labour_rate` real DEFAULT 0 NOT NULL,
	`material_rate` real DEFAULT 0 NOT NULL,
	`plant_rate` real DEFAULT 0 NOT NULL,
	`total_rate` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xero_client_map` (
	`client_id` text PRIMARY KEY NOT NULL,
	`xero_contact_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xero_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`tenant_name` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`connected_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xero_invoice_map` (
	`invoice_id` text PRIMARY KEY NOT NULL,
	`xero_invoice_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xero_quote_map` (
	`quote_id` text PRIMARY KEY NOT NULL,
	`xero_quote_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quickbooks_client_map` (
	`client_id` text PRIMARY KEY NOT NULL,
	`quickbooks_customer_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quickbooks_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`realm_id` text NOT NULL,
	`company_name` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`connected_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quickbooks_invoice_map` (
	`invoice_id` text PRIMARY KEY NOT NULL,
	`quickbooks_invoice_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quickbooks_quote_map` (
	`quote_id` text PRIMARY KEY NOT NULL,
	`quickbooks_estimate_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sage_client_map` (
	`client_id` text PRIMARY KEY NOT NULL,
	`sage_contact_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sage_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`business_name` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`connected_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sage_invoice_map` (
	`invoice_id` text PRIMARY KEY NOT NULL,
	`sage_invoice_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sage_quote_map` (
	`quote_id` text PRIMARY KEY NOT NULL,
	`sage_quote_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `freeagent_client_map` (
	`client_id` text PRIMARY KEY NOT NULL,
	`freeagent_contact_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `freeagent_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`connected_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `freeagent_invoice_map` (
	`invoice_id` text PRIMARY KEY NOT NULL,
	`freeagent_invoice_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `freeagent_quote_map` (
	`quote_id` text PRIMARY KEY NOT NULL,
	`freeagent_estimate_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timesheets` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`worker_name` text NOT NULL,
	`work_date` text NOT NULL,
	`hours_worked` real DEFAULT 8 NOT NULL,
	`day_rate` real,
	`cost` real,
	`description` text,
	`created_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`po_number` text NOT NULL,
	`job_id` text,
	`supplier` text NOT NULL,
	`description` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`vat_amount` real DEFAULT 0 NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`order_date` text NOT NULL,
	`expected_delivery` text,
	`delivery_date` text,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_po_number_unique` ON `purchase_orders` (`po_number`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`changes` text,
	`user_id` text,
	`user_name` text,
	`user_email` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `id_counters` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
