CREATE TABLE `actor` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`avatar` text,
	`bio` text,
	`birth_date` integer,
	`height` integer,
	`measurements` text,
	`nationality` text,
	`social_links` text,
	`movie_count` integer DEFAULT 0 NOT NULL,
	`is_r18` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `actor_name_unique` ON `actor` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `actor_slug_unique` ON `actor` (`slug`);--> statement-breakpoint
CREATE TABLE `publisher` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`website` text,
	`description` text,
	`founded_year` integer,
	`country` text,
	`movie_count` integer DEFAULT 0 NOT NULL,
	`is_r18` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publisher_name_unique` ON `publisher` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `publisher_slug_unique` ON `publisher` (`slug`);