-- Practice loop packs (ACA-E3) and AI assurance (ACA-E7): pack items with sources and review status, expert
-- reviews, immutable published versions, learner flags (error log), evaluation cases and runs, AI incidents.
CREATE TABLE `loop_packs` (
	`id` text PRIMARY KEY NOT NULL,
	`sector` text NOT NULL,
	`audience` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`title` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_pack_reviewers` (
	`pack_id` text NOT NULL REFERENCES `loop_packs`(`id`),
	`user_id` text NOT NULL,
	`role` text NOT NULL CHECK (`role` IN ('expert','reviewer','bilingual')),
	`granted_by` text NOT NULL,
	`granted_at` text NOT NULL,
	PRIMARY KEY (`pack_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `loop_pack_items` (
	`id` text PRIMARY KEY NOT NULL,
	`pack_id` text NOT NULL REFERENCES `loop_packs`(`id`),
	`lineage` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL CHECK (`kind` IN ('task','rule','example','pitfall','planted_errors','brief','check')),
	`job_role` text DEFAULT '*' NOT NULL,
	`level` text DEFAULT '*' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`sources` text NOT NULL,
	`origin` text NOT NULL CHECK (`origin` IN ('ai','expert')),
	`status` text NOT NULL CHECK (`status` IN ('unchecked','approved','rejected','superseded')),
	`month` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_loop_pack_items_pack` ON `loop_pack_items` (`pack_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_loop_pack_items_lineage` ON `loop_pack_items` (`lineage`,`revision`);--> statement-breakpoint
CREATE TABLE `loop_pack_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL REFERENCES `loop_pack_items`(`id`),
	`decision` text NOT NULL CHECK (`decision` IN ('approve','correct','reject')),
	`reviewer` text NOT NULL,
	`note` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_pack_versions` (
	`pack_id` text NOT NULL REFERENCES `loop_packs`(`id`),
	`version` integer NOT NULL,
	`item_ids` text NOT NULL,
	`changes` text NOT NULL,
	`published_by` text NOT NULL,
	`published_at` text NOT NULL,
	PRIMARY KEY (`pack_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `loop_flags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL REFERENCES `loop_pack_items`(`id`),
	`pack_version` integer NOT NULL,
	`member_id` text,
	`reason` text NOT NULL,
	`at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL CHECK (`status` IN ('open','resolved')),
	`resolution` text,
	`resolved_by` text,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_loop_flags_item` ON `loop_flags` (`item_id`,`status`);--> statement-breakpoint
CREATE TABLE `loop_eval_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`learner_message` text NOT NULL,
	`context` text NOT NULL,
	`expected` text NOT NULL,
	`checks` text NOT NULL,
	`data_rights` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_eval_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`run_by` text NOT NULL,
	`config_hash` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`thresholds` text NOT NULL,
	`results` text NOT NULL,
	`summary` text NOT NULL,
	`passed` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_ai_incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`reported_by` text NOT NULL,
	`effect` text NOT NULL,
	`action` text NOT NULL,
	`resolved_at` text
);
