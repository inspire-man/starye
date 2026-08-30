CREATE TABLE `quant_factor_config` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL UNIQUE REFERENCES `user`(`id`) ON DELETE CASCADE,
	`version` text NOT NULL,
	`weights_json` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
