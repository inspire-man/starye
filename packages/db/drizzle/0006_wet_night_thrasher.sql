PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_page` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`image_url` text NOT NULL,
	`width` integer,
	`height` integer,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_page`("id", "chapter_id", "page_number", "image_url", "width", "height") SELECT "id", "chapter_id", "page_number", "image_url", "width", "height" FROM `page`;--> statement-breakpoint
DROP TABLE `page`;--> statement-breakpoint
ALTER TABLE `__new_page` RENAME TO `page`;--> statement-breakpoint
CREATE TABLE `__new_chapter` (
	`id` text PRIMARY KEY NOT NULL,
	`comic_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`chapter_number` integer,
	`sort_order` integer NOT NULL,
	`published_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`comic_id`) REFERENCES `comic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chapter`("id", "comic_id", "title", "slug", "chapter_number", "sort_order", "published_at", "created_at", "updated_at") SELECT "id", "comic_id", "title", "slug", "chapter_number", "sort_order", "published_at", "created_at", "updated_at" FROM `chapter`;--> statement-breakpoint
DROP TABLE `chapter`;--> statement-breakpoint
ALTER TABLE `__new_chapter` RENAME TO `chapter`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
