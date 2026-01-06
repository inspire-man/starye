ALTER TABLE `chapter` ADD `created_at` integer DEFAULT (strftime('%s', 'now'));--> statement-breakpoint
ALTER TABLE `chapter` ADD `updated_at` integer DEFAULT (strftime('%s', 'now'));--> statement-breakpoint
ALTER TABLE `chapter` DROP COLUMN `number`;--> statement-breakpoint
ALTER TABLE `post` ADD `author_id` text REFERENCES user(id);