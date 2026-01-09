PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_comic` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`author` text,
	`description` text,
	`cover_image` text,
	`source_url` text,
	`status` text DEFAULT 'serializing',
	`region` text,
	`genres` text,
	`is_r18` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
INSERT INTO `__new_comic`("id", "title", "slug", "author", "description", "cover_image", "source_url", "status", "region", "genres", "is_r18", "created_at", "updated_at") SELECT "id", "title", "slug", "author", "description", "cover_image", "source_url", "status", "region", "genres", "is_r18", "created_at", "updated_at" FROM `comic`;--> statement-breakpoint
DROP TABLE `comic`;--> statement-breakpoint
ALTER TABLE `__new_comic` RENAME TO `comic`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `comic_slug_unique` ON `comic` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `comic_source_url_unique` ON `comic` (`source_url`);