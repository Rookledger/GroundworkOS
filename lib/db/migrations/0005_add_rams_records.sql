CREATE TABLE `rams_records` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`title` text NOT NULL,
	`activity` text NOT NULL,
	`risk_level` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`hazards` text DEFAULT '[]' NOT NULL,
	`ppe` text DEFAULT '[]' NOT NULL,
	`briefed_at` integer,
	`briefed_by` text,
	`attendees` text DEFAULT '[]' NOT NULL,
	`review_date` text,
	`notes` text,
	`created_at` integer NOT NULL
);
