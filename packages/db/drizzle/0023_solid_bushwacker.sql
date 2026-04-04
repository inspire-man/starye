ALTER TABLE `player` ADD `report_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `player` ADD `is_active` integer DEFAULT true;--> statement-breakpoint
CREATE INDEX `idx_player_active` ON `player` (`is_active`);