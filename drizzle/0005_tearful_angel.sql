CREATE TABLE `academy_team_directory` (
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `team_id`),
	CONSTRAINT "ck_academy_team_directory_user" CHECK(length(trim("academy_team_directory"."user_id")) > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_academy_team_directory_team` ON `academy_team_directory` (`team_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `academy_teams` ADD `directory_projected` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_academy_teams_directory_legacy` ON `academy_teams` (`id`) WHERE "academy_teams"."directory_projected" = 0;
--> statement-breakpoint
CREATE TRIGGER academy_team_directory_insert
AFTER INSERT ON academy_teams
BEGIN
  INSERT INTO academy_team_directory(user_id, team_id)
  SELECT json_extract(m.value, '$.userId'), NEW.id
  FROM json_each(NEW.data, '$.members') m;
  UPDATE academy_teams SET directory_projected = 1 WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER academy_team_directory_members_changed
AFTER UPDATE OF data ON academy_teams
WHEN OLD.directory_projected = 0
  OR json_extract(OLD.data, '$.members') IS NOT json_extract(NEW.data, '$.members')
BEGIN
  DELETE FROM academy_team_directory WHERE team_id = NEW.id;
  INSERT INTO academy_team_directory(user_id, team_id)
  SELECT json_extract(m.value, '$.userId'), NEW.id
  FROM json_each(NEW.data, '$.members') m;
  UPDATE academy_teams SET directory_projected = 1 WHERE id = NEW.id;
END;
--> statement-breakpoint
CREATE TRIGGER academy_team_directory_delete
AFTER DELETE ON academy_teams
BEGIN
  DELETE FROM academy_team_directory WHERE team_id = OLD.id;
END;
