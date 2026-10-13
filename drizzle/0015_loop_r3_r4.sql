-- Practice loop R3 and R4 (ACA-E11, E13, E15, E16, E18, E19, E20, E21): guardian consent, class teachers, renewals,
-- user language, reviewed interface strings, pack translations, annotations, refinements, invoices and sponsors.
CREATE TABLE `loop_guardian_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`guardian_email` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending','granted','refused','withdrawn')),
	`method` text NOT NULL,
	`created_at` text NOT NULL,
	`decided_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_loop_guardian_token` ON `loop_guardian_consents` (`token_hash`);--> statement-breakpoint
CREATE TABLE `loop_class_teachers` (
	`org_id` text NOT NULL,
	`class_label` text NOT NULL,
	`teacher_member_id` text NOT NULL,
	`assigned_by` text NOT NULL,
	`assigned_at` text NOT NULL,
	PRIMARY KEY (`org_id`,`class_label`,`teacher_member_id`)
);
--> statement-breakpoint
CREATE TABLE `loop_renewals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` text NOT NULL,
	`decision` text NOT NULL CHECK (`decision` IN ('renew','not_renew')),
	`decided_on` text NOT NULL,
	`reason` text NOT NULL,
	`source_ref` text,
	`months` integer,
	`confirmed` integer NOT NULL,
	`recorded_by` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_user_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_ui_strings` (
	`language` text NOT NULL,
	`key` text NOT NULL,
	`text` text NOT NULL,
	`status` text NOT NULL CHECK (`status` IN ('unchecked','approved','rejected')),
	`origin` text NOT NULL,
	`reviewer` text,
	`at` text NOT NULL,
	PRIMARY KEY (`language`,`key`)
);
--> statement-breakpoint
CREATE TABLE `loop_pack_links` (
	`pack_id` text PRIMARY KEY NOT NULL REFERENCES `loop_packs`(`id`),
	`translation_of` text NOT NULL REFERENCES `loop_packs`(`id`),
	`language` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_item_translations` (
	`item_id` text PRIMARY KEY NOT NULL REFERENCES `loop_pack_items`(`id`),
	`source_lineage` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_annotations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` text NOT NULL REFERENCES `loop_pack_items`(`id`),
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`quote` text NOT NULL,
	`note` text NOT NULL,
	`user_id` text NOT NULL,
	`member_id` text,
	`at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL CHECK (`status` IN ('open','resolved','hidden')),
	`resolved_by` text,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_loop_annotations_item` ON `loop_annotations` (`item_id`,`status`);--> statement-breakpoint
CREATE TABLE `loop_refinements` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL REFERENCES `loop_pack_items`(`id`),
	`proposed_body` text NOT NULL,
	`annotation_ids` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending','approved','rejected')),
	`result_item_id` text,
	`decided_by` text,
	`created_at` text NOT NULL,
	`decided_at` text
);
--> statement-breakpoint
CREATE TABLE `loop_sponsors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL CHECK (`kind` IN ('philanthropy','association','csr')),
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `loop_sponsor_viewers` (
	`sponsor_id` text NOT NULL REFERENCES `loop_sponsors`(`id`),
	`user_id` text NOT NULL,
	PRIMARY KEY (`sponsor_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `loop_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`cohort_id` text,
	`kind` text NOT NULL CHECK (`kind` IN ('workshop','sponsored_seats','renewal')),
	`model` text NOT NULL CHECK (`model` IN ('per_participant','per_workshop','per_seat')),
	`unit_paise` integer NOT NULL,
	`quantity` integer NOT NULL,
	`cap` integer,
	`amount_paise` integer NOT NULL,
	`payer` text NOT NULL,
	`sponsor_id` text,
	`months` integer,
	`status` text DEFAULT 'issued' NOT NULL CHECK (`status` IN ('offered','issued','paid','cancelled')),
	`provider_ref` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`paid_at` text
);
--> statement-breakpoint
CREATE TABLE `loop_sponsored_seats` (
	`sponsor_id` text NOT NULL REFERENCES `loop_sponsors`(`id`),
	`cohort_id` text NOT NULL,
	`seats` integer NOT NULL,
	`invoice_id` text NOT NULL,
	`at` text NOT NULL,
	PRIMARY KEY (`sponsor_id`,`cohort_id`)
);
