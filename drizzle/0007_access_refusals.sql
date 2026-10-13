CREATE TABLE `academy_access_refusals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_ref` text NOT NULL,
	`route` text NOT NULL,
	`method` text NOT NULL,
	`status` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_academy_access_refusals_created` ON `academy_access_refusals` (`created_at`);