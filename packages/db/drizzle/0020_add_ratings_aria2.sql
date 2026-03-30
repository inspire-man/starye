-- 创建评分表
CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`user_id` text NOT NULL,
	`score` integer NOT NULL CHECK(score >= 1 AND score <= 5),
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- 评分表唯一索引：每个用户对每个播放源只能评分一次
CREATE UNIQUE INDEX `idx_ratings_player_user` ON `ratings` (`player_id`,`user_id`);
--> statement-breakpoint
-- 评分表索引：按播放源查询
CREATE INDEX `idx_ratings_player` ON `ratings` (`player_id`);
--> statement-breakpoint
-- 评分表索引：按用户查询
CREATE INDEX `idx_ratings_user` ON `ratings` (`user_id`);
--> statement-breakpoint
-- 评分表索引：按时间查询
CREATE INDEX `idx_ratings_created_at` ON `ratings` (`created_at`);
--> statement-breakpoint

-- 创建 Aria2 配置表
CREATE TABLE `aria2_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL UNIQUE,
	`rpc_url` text NOT NULL,
	`secret` text,
	`use_proxy` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- 扩展 player 表：添加评分字段
ALTER TABLE `player` ADD COLUMN `average_rating` real;
--> statement-breakpoint
ALTER TABLE `player` ADD COLUMN `rating_count` integer DEFAULT 0;
--> statement-breakpoint
-- 按评分降序索引
CREATE INDEX `idx_player_rating` ON `player` (`average_rating` DESC);
