CREATE TABLE `quant_ai_config` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`base_url` text,
	`encrypted_api_key` text,
	`api_key_hint` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_ai_config_user_id` ON `quant_ai_config` (`user_id`);
--> statement-breakpoint
ALTER TABLE `quant_watchlist` ADD `user_id` text REFERENCES `user`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `quant_research_marker` ADD `user_id` text REFERENCES `user`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `quant_scan_snapshot` ADD `user_id` text REFERENCES `user`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `quant_sync_state` ADD `user_id` text REFERENCES `user`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_quant_watchlist_ts_code`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_quant_watchlist_created_at`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_quant_research_marker_ts_code`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_quant_research_marker_status`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_quant_scan_snapshot_generated_at`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_quant_scan_snapshot_status_generated`;
--> statement-breakpoint
UPDATE `quant_watchlist`
SET `user_id` = (SELECT `id` FROM `user` ORDER BY `created_at`, `id` LIMIT 1)
WHERE `user_id` IS NULL
  AND EXISTS (SELECT 1 FROM `user`);
--> statement-breakpoint
UPDATE `quant_research_marker`
SET `user_id` = (SELECT `id` FROM `user` ORDER BY `created_at`, `id` LIMIT 1)
WHERE `user_id` IS NULL
  AND EXISTS (SELECT 1 FROM `user`);
--> statement-breakpoint
UPDATE `quant_scan_snapshot`
SET `user_id` = (SELECT `id` FROM `user` ORDER BY `created_at`, `id` LIMIT 1)
WHERE `user_id` IS NULL
  AND EXISTS (SELECT 1 FROM `user`);
--> statement-breakpoint
UPDATE `quant_sync_state`
SET
  `user_id` = (SELECT `id` FROM `user` ORDER BY `created_at`, `id` LIMIT 1),
  `id` = 'daily:' || (SELECT `id` FROM `user` ORDER BY `created_at`, `id` LIMIT 1)
WHERE `user_id` IS NULL
  AND EXISTS (SELECT 1 FROM `user`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_watchlist_user_ts_code` ON `quant_watchlist` (`user_id`, `ts_code`);
--> statement-breakpoint
CREATE INDEX `idx_quant_watchlist_user_created_at` ON `quant_watchlist` (`user_id`, `created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_research_marker_user_ts_code` ON `quant_research_marker` (`user_id`, `ts_code`);
--> statement-breakpoint
CREATE INDEX `idx_quant_research_marker_user_status` ON `quant_research_marker` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `idx_quant_scan_snapshot_user_generated_at` ON `quant_scan_snapshot` (`user_id`, `generated_at`);
--> statement-breakpoint
CREATE INDEX `idx_quant_scan_snapshot_user_status_generated` ON `quant_scan_snapshot` (`user_id`, `status`, `generated_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_sync_state_user_id` ON `quant_sync_state` (`user_id`);
