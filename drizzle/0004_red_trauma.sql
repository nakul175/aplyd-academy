CREATE TABLE `academy_team_history` (
	`team_id` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`team_id`, `revision`)
);
