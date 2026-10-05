DROP INDEX `idx_academy_audit_owner_event`;--> statement-breakpoint
ALTER TABLE `academy_audit` ADD `request_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_academy_audit_owner_event_unique` ON `academy_audit` (`owner`,`event_id`);