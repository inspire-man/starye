ALTER TABLE `crawler_run` ADD `receipt_schema_version` integer;
--> statement-breakpoint
ALTER TABLE `crawler_run` ADD `receipt_primary_content_id` text;
--> statement-breakpoint
ALTER TABLE `crawler_run` ADD `receipt_source_revision` integer;
--> statement-breakpoint
CREATE TABLE `movie_source_state` (
	`movie_id` text PRIMARY KEY NOT NULL,
	`source_revision` integer DEFAULT 0 NOT NULL,
	`disposition` text NOT NULL,
	`eligible_count` integer DEFAULT 0 NOT NULL,
	`repairable` integer DEFAULT true NOT NULL,
	`reason_code` text,
	`observed_at` integer NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_movie_source_state_disposition` ON `movie_source_state` (`disposition`);
