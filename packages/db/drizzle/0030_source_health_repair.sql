ALTER TABLE `crawler_task` ADD `operation` text DEFAULT 'movie' NOT NULL;
--> statement-breakpoint
CREATE TABLE `movie_source_observation` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`operation` text NOT NULL,
	`run_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`sequence` integer NOT NULL,
	`event_id` text NOT NULL,
	`source_revision` integer NOT NULL,
	`source_ordinal` integer NOT NULL,
	`source_type` text NOT NULL,
	`health` text NOT NULL,
	`observed_at` integer NOT NULL,
	`reason_code` text NOT NULL,
	`eligible` integer NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_movie_source_observation_identity` ON `movie_source_observation` (`movie_id`,`source_revision`,`operation`,`run_id`,`attempt_number`,`sequence`,`event_id`,`source_ordinal`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_movie_source_observation_run_event_source` ON `movie_source_observation` (`run_id`,`event_id`,`source_ordinal`);
--> statement-breakpoint
CREATE INDEX `idx_movie_source_observation_movie_revision` ON `movie_source_observation` (`movie_id`,`source_revision`);
