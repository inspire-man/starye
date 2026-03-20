-- 修复脚本：重新创建 movie_actor 和 movie_publisher 表
-- 使用方式：wrangler d1 execute starye-db --remote --file=./scripts/fix-missing-tables.sql

-- 1. 创建 movie_actor 表（如果不存在）
CREATE TABLE IF NOT EXISTS `movie_actor` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `actor`(`id`) ON UPDATE no action ON DELETE cascade
);

-- 2. 创建 movie_publisher 表（如果不存在）
CREATE TABLE IF NOT EXISTS `movie_publisher` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`publisher_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`movie_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`publisher_id`) REFERENCES `publisher`(`id`) ON UPDATE no action ON DELETE cascade
);

-- 3. 创建索引（如果不存在）
CREATE UNIQUE INDEX IF NOT EXISTS `idx_movie_actor` ON `movie_actor` (`movie_id`,`actor_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_movie_actor_actor_id` ON `movie_actor` (`actor_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_movie_pub` ON `movie_publisher` (`movie_id`,`publisher_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_movie_pub_publisher_id` ON `movie_publisher` (`publisher_id`);

SELECT 'movie_actor 和 movie_publisher 表已修复' as status;
