CREATE TABLE `academy_audit` (
	`owner` text NOT NULL,
	`revision` integer NOT NULL,
	`event_id` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `revision`)
);
--> statement-breakpoint
CREATE INDEX `idx_academy_audit_owner_event` ON `academy_audit` (`owner`,`event_id`);--> statement-breakpoint
CREATE TABLE `academy_workspaces` (
	`owner` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
