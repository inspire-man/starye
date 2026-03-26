CREATE TABLE `user_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_favorites_user_entity` ON `user_favorites` (`user_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_user_favorites_entity_type` ON `user_favorites` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_user_favorites_entity_id` ON `user_favorites` (`entity_id`);--> statement-breakpoint
DROP INDEX `idx_actor_source_id`;--> statement-breakpoint
DROP INDEX `idx_movie_actor`;--> statement-breakpoint
DROP INDEX `idx_movie_actor_actor_id`;--> statement-breakpoint
DROP INDEX `idx_movie_pub`;--> statement-breakpoint
DROP INDEX `idx_movie_pub_publisher_id`;--> statement-breakpoint
DROP INDEX `idx_publisher_source_id`;--> statement-breakpoint
DROP INDEX `idx_reading_progress_user_chapter`;--> statement-breakpoint
DROP INDEX `idx_watching_progress_user_movie`;