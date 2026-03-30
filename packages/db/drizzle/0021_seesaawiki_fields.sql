-- 为 actor 表添加 SeesaaWiki 字段
ALTER TABLE `actor` ADD `blog` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `twitter` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `instagram` text;--> statement-breakpoint
ALTER TABLE `actor` ADD `wiki_url` text;--> statement-breakpoint

-- 为 publisher 表添加 SeesaaWiki 字段  
ALTER TABLE `publisher` ADD `twitter` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `instagram` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `wiki_url` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `parent_publisher` text;--> statement-breakpoint
ALTER TABLE `publisher` ADD `brand_series` text;
