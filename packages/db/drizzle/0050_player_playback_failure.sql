ALTER TABLE `player` ADD `last_playback_status` text;
--> statement-breakpoint
ALTER TABLE `player` ADD `last_playback_reason` text;
--> statement-breakpoint
ALTER TABLE `player` ADD `last_playback_at` integer;
--> statement-breakpoint
CREATE INDEX `idx_player_last_playback_status` ON `player` (`last_playback_status`);
