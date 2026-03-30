-- 使用 IF NOT EXISTS 避免表已存在的错误
-- 此迁移仅创建 aria2_configs 和 ratings 表（如果不存在）
-- actor/publisher 字段由 0021_seesaawiki_fields.sql 处理
-- player 的评分字段已在之前的迁移中添加
CREATE TABLE IF NOT EXISTS `aria2_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rpc_url` text NOT NULL,
	`secret` text,
	`use_proxy` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `aria2_configs_user_id_unique` ON `aria2_configs` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`user_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_ratings_player_user` ON `ratings` (`player_id`,`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ratings_player` ON `ratings` (`player_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ratings_user` ON `ratings` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ratings_created_at` ON `ratings` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_player_rating` ON `player` (`average_rating`);
