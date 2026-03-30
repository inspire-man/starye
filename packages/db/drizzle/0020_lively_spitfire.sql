CREATE TABLE `aria2_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rpc_url` text NOT NULL,
	`secret` text,
	`use_proxy` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aria2_configs_user_id_unique` ON `aria2_configs` (`user_id`);--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`user_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ratings_player_user` ON `ratings` (`player_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ratings_player` ON `ratings` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_ratings_user` ON `ratings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_ratings_created_at` ON `ratings` (`created_at`);--> statement-breakpoint
ALTER TABLE `actor` ADD `blog` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `twitter` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `instagram` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `wiki_url` text;--> statement-breakpoint
ALTER TABLE `player` ADD `average_rating` integer;--> statement-breakpoint
ALTER TABLE `player` ADD `rating_count` integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX `idx_player_rating` ON `player` (`average_rating`);--> statement-breakpoint
ALTER TABLE `publisher` ADD `twitter` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `instagram` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `wiki_url` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `parent_publisher` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `brand_series` text;