-- Practice loop (ACA-E4): weekly tasks, own-work files with resumable upload, coach messages, attempts,
-- submissions (practice cycles), unaided checks, catch-the-AI results and workshop sessions.
CREATE TABLE `loop_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL REFERENCES `loop_members`(`id`),
	`cohort_id` text NOT NULL,
	`kind` text NOT NULL CHECK (`kind` IN ('weekly','workshop','check','catch_ai','brief')),
	`week` integer NOT NULL,
	`item_id` text,
	`pack_version` integer,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL CHECK (`status` IN ('open','submitted')),
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_loop_tasks_member` ON `loop_tasks` (`member_id`,`kind`,`week`);--> statement-breakpoint
CREATE TABLE `loop_files` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL REFERENCES `loop_members`(`id`),
	`task_id` text,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`received` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL CHECK (`status` IN ('uploading','complete')),
	`shared` integer DEFAULT 0 NOT NULL,
	`no_confidential_confirmed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_loop_files_member` ON `loop_files` (`member_id`);--> statement-breakpoint
CREATE TABLE `loop_coach_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL REFERENCES `loop_tasks`(`id`),
	`member_id` text NOT NULL,
	`role` text NOT NULL CHECK (`role` IN ('learner','coach','notice')),
	`mode` text NOT NULL,
	`body` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_loop_coach_task` ON `loop_coach_messages` (`task_id`,`id`);--> statement-breakpoint
CREATE TABLE `loop_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL REFERENCES `loop_tasks`(`id`),
	`member_id` text NOT NULL,
	`body` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL REFERENCES `loop_tasks`(`id`),
	`member_id` text NOT NULL,
	`cohort_id` text NOT NULL,
	`week` integer NOT NULL,
	`kind` text NOT NULL,
	`file_id` text,
	`link` text,
	`note` text NOT NULL,
	`has_artefact` integer NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_loop_submissions_task` ON `loop_submissions` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_loop_submissions_cohort` ON `loop_submissions` (`cohort_id`,`week`);--> statement-breakpoint
CREATE TABLE `loop_check_results` (
	`task_id` text PRIMARY KEY NOT NULL REFERENCES `loop_tasks`(`id`),
	`member_id` text NOT NULL,
	`cohort_id` text NOT NULL,
	`item_id` text NOT NULL,
	`score` integer NOT NULL,
	`max_score` integer NOT NULL,
	`starting_level` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_catch_results` (
	`task_id` text PRIMARY KEY NOT NULL REFERENCES `loop_tasks`(`id`),
	`member_id` text NOT NULL,
	`cohort_id` text NOT NULL,
	`month` integer NOT NULL,
	`shown` integer NOT NULL,
	`caught` integer NOT NULL,
	`false_marks` integer NOT NULL,
	`baseline` integer NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_workshops` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL REFERENCES `loop_cohorts`(`id`),
	`started_by` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text
);
