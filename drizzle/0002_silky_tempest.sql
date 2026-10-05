CREATE TABLE `academy_team_audit` (
	`team_id` text NOT NULL,
	`revision` integer NOT NULL,
	`actor` text NOT NULL,
	`event_id` text NOT NULL,
	`action` text NOT NULL,
	`request_hash` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`team_id`, `revision`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academy_team_action` ON `academy_team_audit` (`team_id`,`actor`,`event_id`);--> statement-breakpoint
CREATE TABLE `academy_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_academy_teams_creator` ON `academy_teams` (`created_by`);