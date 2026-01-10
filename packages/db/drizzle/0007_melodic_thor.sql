CREATE TABLE `movie` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`cover_image` text,
	`release_date` integer,
	`duration` integer,
	`source_url` text,
	`actors` text,
	`genres` text,
	`series` text,
	`publisher` text,
	`is_r18` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movie_slug_unique` ON `movie` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_code_unique` ON `movie` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `movie_source_url_unique` ON `movie` (`source_url`);--> statement-breakpoint
CREATE TABLE `player` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`quality` text,
	`sort_order` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade
);
