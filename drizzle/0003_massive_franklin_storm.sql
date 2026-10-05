CREATE TABLE `academy_invite_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`invite_id` text NOT NULL
);
