-- Practice loop reminders (ACA-E5), metrics and reports (ACA-E6), retention and the deletion log (ACA-US-6.5).
CREATE TABLE `loop_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`cohort_id` text NOT NULL,
	`kind` text NOT NULL,
	`slot` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL CHECK (`status` IN ('sent','failed','skipped')),
	`reason` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_loop_reminders_slot` ON `loop_reminders` (`member_id`,`kind`,`slot`);--> statement-breakpoint
CREATE TABLE `loop_message_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel` text NOT NULL,
	`to_address` text NOT NULL,
	`template` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_cadence_assignments` (
	`member_id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`cadence` text NOT NULL,
	`assigned_at` text NOT NULL,
	`decision_ref` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_followups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`facilitator` text NOT NULL,
	`outcome` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`cohort_id` text,
	`org_id` text,
	`body` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`approved_by` text,
	`approved_at` text,
	`shared_at` text,
	`shared_note` text
);
--> statement-breakpoint
CREATE INDEX `idx_loop_reports_cohort` ON `loop_reports` (`cohort_id`,`kind`);--> statement-breakpoint
CREATE TABLE `loop_deletion_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`trigger` text NOT NULL,
	`counts` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_deletion_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`tbl` text NOT NULL,
	`row_key` text NOT NULL
);
