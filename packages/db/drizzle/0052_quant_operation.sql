CREATE TABLE `quant_operation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`ts_code` text NOT NULL,
	`name` text,
	`side` text NOT NULL,
	`price` real NOT NULL,
	`quantity` real NOT NULL,
	`traded_at` integer NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quant_operation_user_traded_at` ON `quant_operation` (`user_id`, `traded_at`);
