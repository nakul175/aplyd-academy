CREATE TABLE `academy_login_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email_hash` text NOT NULL,
	`code_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_academy_login_codes_email` ON `academy_login_codes` (`email_hash`,`created_at`);--> statement-breakpoint
CREATE TABLE `academy_login_locks` (
	`email_hash` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`locked_until` text
);
--> statement-breakpoint
CREATE TABLE `academy_mail_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`to_address` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `academy_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_academy_sessions_user` ON `academy_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `academy_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academy_users_email_hash` ON `academy_users` (`email_hash`);