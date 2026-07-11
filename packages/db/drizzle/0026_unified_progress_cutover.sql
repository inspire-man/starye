CREATE TABLE `progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content_type` text NOT NULL,
	`content_id` text NOT NULL,
	`position` integer NOT NULL,
	`duration` integer,
	`completed` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_progress_user_content` ON `progress` (`user_id`,`content_type`,`content_id`);
--> statement-breakpoint
CREATE INDEX `idx_progress_user_updated_at` ON `progress` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_progress_content_lookup` ON `progress` (`content_type`,`content_id`);
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_reading_progress_user_chapter`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_watching_progress_user_movie`;
--> statement-breakpoint
DROP TABLE IF EXISTS `reading_progress`;
--> statement-breakpoint
DROP TABLE IF EXISTS `watching_progress`;
