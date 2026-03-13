CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`user_email` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`resource_identifier` text,
	`affected_count` integer DEFAULT 1,
	`changes` text,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `movie` ADD `metadata_locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `movie` ADD `sort_order` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `movie` ADD `crawl_status` text DEFAULT 'complete';--> statement-breakpoint
ALTER TABLE `movie` ADD `last_crawled_at` integer;--> statement-breakpoint
ALTER TABLE `movie` ADD `total_players` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `movie` ADD `crawled_players` integer DEFAULT 0;