-- Practice loop: help reports (ACA-US-12.5), live sessions and follow-up threads (ACA-E8), confirmations of changed
-- work (ACA-US-10.1), interviews (10.3), the change list after the A-01 decision (10.5), fix proposals for pack v2 (14.1).
CREATE TABLE `loop_help_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`member_id` text,
	`org_id` text,
	`screen` text NOT NULL,
	`kind` text NOT NULL CHECK (`kind` IN ('problem','content','security')),
	`body` text NOT NULL,
	`at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL CHECK (`status` IN ('open','resolved')),
	`resolution` text,
	`resolved_by` text,
	`resolved_at` text
);
--> statement-breakpoint
CREATE TABLE `loop_live_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL REFERENCES `loop_cohorts`(`id`),
	`level` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`link` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`ended_at` text
);
--> statement-breakpoint
CREATE TABLE `loop_session_invites` (
	`session_id` text NOT NULL REFERENCES `loop_live_sessions`(`id`),
	`member_id` text NOT NULL,
	`attended` integer,
	`at` text NOT NULL,
	PRIMARY KEY (`session_id`,`member_id`)
);
--> statement-breakpoint
CREATE TABLE `loop_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL REFERENCES `loop_cohorts`(`id`),
	`session_id` text,
	`title` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` text NOT NULL REFERENCES `loop_threads`(`id`),
	`member_id` text,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`at` text NOT NULL,
	`reported` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`hidden_by` text,
	`hidden_at` text
);
--> statement-breakpoint
CREATE TABLE `loop_confirmations` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`member_id` text NOT NULL,
	`confirmer_email` text NOT NULL,
	`relation` text NOT NULL CHECK (`relation` IN ('supervisor','peer')),
	`token_hash` text NOT NULL,
	`shared_text` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending','confirmed','declined')),
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`decided_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_loop_confirmations_token` ON `loop_confirmations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `loop_interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text,
	`cohort_id` text NOT NULL,
	`activity_band` text NOT NULL CHECK (`activity_band` IN ('most_active','least_active')),
	`consent_at` text NOT NULL,
	`held_at` text,
	`notes` text,
	`summary` text,
	`recorded_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_change_list` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cohort_id` text NOT NULL,
	`decision_ref` text NOT NULL,
	`change` text NOT NULL,
	`evidence` text NOT NULL,
	`expected_signal` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL CHECK (`status` IN ('planned','built','compared')),
	`comparison` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_fix_proposals` (
	`flag_id` integer PRIMARY KEY NOT NULL REFERENCES `loop_flags`(`id`),
	`kind` text NOT NULL CHECK (`kind` IN ('fix','no_change')),
	`text` text NOT NULL,
	`origin` text NOT NULL CHECK (`origin` IN ('ai','expert')),
	`decided` text CHECK (`decided` IN ('accepted','rejected')),
	`decided_by` text,
	`at` text NOT NULL
);
