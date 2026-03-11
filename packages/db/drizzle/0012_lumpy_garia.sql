ALTER TABLE `comic` ADD `crawl_status` text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `comic` ADD `last_crawled_at` integer;--> statement-breakpoint
ALTER TABLE `comic` ADD `total_chapters` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `comic` ADD `crawled_chapters` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `comic` ADD `is_serializing` integer DEFAULT true;