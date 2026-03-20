PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_actor` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`avatar` text,
	`cover` text,
	`bio` text,
	`birth_date` integer,
	`height` integer,
	`measurements` text,
	`cup_size` text,
	`blood_type` text,
	`nationality` text,
	`debut_date` integer,
	`is_active` integer DEFAULT true,
	`retire_date` integer,
	`social_links` text,
	`movie_count` integer DEFAULT 0 NOT NULL,
	`is_r18` integer DEFAULT true NOT NULL,
	`source` text DEFAULT 'javbus' NOT NULL,
	`source_id` text DEFAULT '' NOT NULL,
	`source_url` text,
	`has_details_crawled` integer DEFAULT false,
	`crawl_failure_count` integer DEFAULT 0,
	`last_crawl_attempt` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_actor`("id", "name", "slug", "avatar", "cover", "bio", "birth_date", "height", "measurements", "cup_size", "blood_type", "nationality", "debut_date", "is_active", "retire_date", "social_links", "movie_count", "is_r18", "source", "source_id", "source_url", "has_details_crawled", "crawl_failure_count", "last_crawl_attempt", "created_at", "updated_at") SELECT "id", "name", "slug", "avatar", "cover", "bio", "birth_date", "height", "measurements", "cup_size", "blood_type", "nationality", "debut_date", "is_active", "retire_date", "social_links", "movie_count", "is_r18", "source", COALESCE(NULLIF("source_id", ''), "id"), "source_url", "has_details_crawled", "crawl_failure_count", "last_crawl_attempt", "created_at", "updated_at" FROM `actor`;--> statement-breakpoint
DROP TABLE `actor`;--> statement-breakpoint
ALTER TABLE `__new_actor` RENAME TO `actor`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `actor_slug_unique` ON `actor` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_actor_source_id` ON `actor` (`source`,`source_id`);--> statement-breakpoint
CREATE TABLE `__new_publisher` (
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
	`source` text DEFAULT 'javbus' NOT NULL,
	`source_id` text DEFAULT '' NOT NULL,
	`source_url` text,
	`has_details_crawled` integer DEFAULT false,
	`crawl_failure_count` integer DEFAULT 0,
	`last_crawl_attempt` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_publisher`("id", "name", "slug", "logo", "website", "description", "founded_year", "country", "movie_count", "is_r18", "source", "source_id", "source_url", "has_details_crawled", "crawl_failure_count", "last_crawl_attempt", "created_at", "updated_at") SELECT "id", "name", "slug", "logo", "website", "description", "founded_year", "country", "movie_count", "is_r18", "source", COALESCE(NULLIF("source_id", ''), "id"), "source_url", "has_details_crawled", "crawl_failure_count", "last_crawl_attempt", "created_at", "updated_at" FROM `publisher`;--> statement-breakpoint
DROP TABLE `publisher`;--> statement-breakpoint
ALTER TABLE `__new_publisher` RENAME TO `publisher`;--> statement-breakpoint
CREATE UNIQUE INDEX `publisher_slug_unique` ON `publisher` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_publisher_source_id` ON `publisher` (`source`,`source_id`);
