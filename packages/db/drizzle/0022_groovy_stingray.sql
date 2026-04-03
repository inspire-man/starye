ALTER TABLE `post` ADD `content_format` text DEFAULT 'html';--> statement-breakpoint
ALTER TABLE `post` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `post` ADD `series` text;--> statement-breakpoint
ALTER TABLE `post` ADD `series_order` integer;