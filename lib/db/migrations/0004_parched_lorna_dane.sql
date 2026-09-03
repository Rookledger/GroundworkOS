CREATE TABLE `xero_bill_map` (
	`purchase_order_id` text PRIMARY KEY NOT NULL,
	`xero_bill_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xero_credit_note_map` (
	`invoice_id` text PRIMARY KEY NOT NULL,
	`xero_credit_note_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xero_supplier_map` (
	`subcontractor_id` text PRIMARY KEY NOT NULL,
	`xero_contact_id` text NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `xero_sync_log` (
	`id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`resource` text NOT NULL,
	`succeeded` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`detail` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `xero_connection` ADD `sales_account_code` text;--> statement-breakpoint
ALTER TABLE `xero_connection` ADD `purchases_account_code` text;