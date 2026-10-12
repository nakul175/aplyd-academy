-- Practice loop R1 foundation (ACA-E2): owner decisions, operators, organisations, members, invites, audit,
-- cohorts, start groups, privacy notices, consents and AI levels. Hand-written for the Node runtime (ADR-0001).
CREATE TABLE `loop_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`scope` text DEFAULT 'global' NOT NULL,
	`value` text NOT NULL,
	`decided_by` text NOT NULL,
	`decided_at` text NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_loop_decisions_key` ON `loop_decisions` (`key`,`scope`,`id`);--> statement-breakpoint
CREATE TABLE `loop_operators` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL CHECK (`role` IN ('owner','operator')),
	`granted_by` text NOT NULL,
	`granted_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL CHECK (`kind` IN ('association','school','university','institute')),
	`name` text NOT NULL,
	`sector` text NOT NULL,
	`agreement_ref` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL REFERENCES `loop_orgs`(`id`),
	`name` text NOT NULL,
	`sector` text NOT NULL,
	`workshop_date` text,
	`access_months` integer DEFAULT 12 NOT NULL,
	`access_extended_until` text,
	`pack_id` text,
	`loop_version` text DEFAULT 'loop-1' NOT NULL,
	`participant_cap` integer,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_loop_cohorts_org` ON `loop_cohorts` (`org_id`);--> statement-breakpoint
CREATE TABLE `loop_start_groups` (
	`cohort_id` text NOT NULL REFERENCES `loop_cohorts`(`id`),
	`label` text NOT NULL,
	`start_date` text NOT NULL,
	PRIMARY KEY (`cohort_id`,`label`)
);
--> statement-breakpoint
CREATE TABLE `loop_members` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL REFERENCES `loop_orgs`(`id`),
	`cohort_id` text REFERENCES `loop_cohorts`(`id`),
	`role` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`job_role` text,
	`phone` text,
	`user_id` text,
	`status` text NOT NULL CHECK (`status` IN ('invited','joined','refused','removed')),
	`start_group` text,
	`invited_at` text NOT NULL,
	`joined_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_loop_members_unique` ON `loop_members` (`org_id`,`email`,`role`);--> statement-breakpoint
CREATE INDEX `idx_loop_members_user` ON `loop_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_loop_members_cohort` ON `loop_members` (`cohort_id`);--> statement-breakpoint
CREATE TABLE `loop_invites` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL REFERENCES `loop_members`(`id`),
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE TABLE `loop_audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`actor` text NOT NULL,
	`org_id` text,
	`action` text NOT NULL,
	`target` text,
	`outcome` text NOT NULL CHECK (`outcome` IN ('ok','refused'))
);
--> statement-breakpoint
CREATE INDEX `idx_loop_audit_org` ON `loop_audit` (`org_id`,`id`);--> statement-breakpoint
CREATE TABLE `loop_notices` (
	`version` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_consents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL REFERENCES `loop_members`(`id`),
	`purpose` text NOT NULL,
	`granted` integer NOT NULL,
	`notice_version` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_loop_consents_member` ON `loop_consents` (`member_id`,`purpose`,`id`);--> statement-breakpoint
CREATE TABLE `loop_levels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL REFERENCES `loop_members`(`id`),
	`level` text NOT NULL,
	`source` text NOT NULL CHECK (`source` IN ('placement','facilitator')),
	`score` integer,
	`set_by` text NOT NULL,
	`reason` text,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_loop_levels_member` ON `loop_levels` (`member_id`,`id`);--> statement-breakpoint
CREATE TABLE `loop_level_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL REFERENCES `loop_members`(`id`),
	`reason` text NOT NULL,
	`at` text NOT NULL,
	`resolved_at` text,
	`resolved_by` text,
	`outcome` text
);
