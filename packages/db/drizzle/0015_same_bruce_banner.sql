CREATE TABLE `movie_actor` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `actor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_movie_actor` ON `movie_actor` (`movie_id`,`actor_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_movie_actor_actor_id` ON `movie_actor` (`actor_id`);--> statement-breakpoint
CREATE TABLE `movie_publisher` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`publisher_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`publisher_id`) REFERENCES `publisher`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_movie_pub` ON `movie_publisher` (`movie_id`,`publisher_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_movie_pub_publisher_id` ON `movie_publisher` (`publisher_id`);--> statement-breakpoint
DROP INDEX `actor_name_unique`;--> statement-breakpoint
ALTER TABLE `actor` ADD `cover` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `cup_size` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `blood_type` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `debut_date` integer;--> statement-breakpoint
ALTER TABLE `actor` ADD `is_active` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `actor` ADD `retire_date` integer;--> statement-breakpoint
ALTER TABLE `actor` ADD `source` text DEFAULT 'javbus' NOT NULL;--> statement-breakpoint
ALTER TABLE `actor` ADD `source_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `actor` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `has_details_crawled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `actor` ADD `crawl_failure_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `actor` ADD `last_crawl_attempt` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_actor_source_id` ON `actor` (`source`,`source_id`);--> statement-breakpoint
DROP INDEX `publisher_name_unique`;--> statement-breakpoint
ALTER TABLE `publisher` ADD `source` text DEFAULT 'javbus' NOT NULL;--> statement-breakpoint
ALTER TABLE `publisher` ADD `source_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `publisher` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `has_details_crawled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `publisher` ADD `crawl_failure_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `publisher` ADD `last_crawl_attempt` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_publisher_source_id` ON `publisher` (`source`,`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reading_progress_user_chapter` ON `reading_progress` (`user_id`,`chapter_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_watching_progress_user_movie` ON `watching_progress` (`user_id`,`movie_code`);
