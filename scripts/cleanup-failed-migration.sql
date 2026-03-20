-- 清理脚本：确保失败的迁移没有留下部分更改
-- 使用方式：wrangler d1 execute starye-db --remote --file=./scripts/cleanup-failed-migration.sql
--
-- 注意：D1 通常会在迁移失败时自动回滚，但这个脚本可以确保清理任何遗留对象

-- 1. 清理可能已创建的关联表
DROP TABLE IF EXISTS `movie_actor`;
DROP TABLE IF EXISTS `movie_publisher`;

-- 2. 清理可能已创建的索引（按创建顺序的反序删除）
DROP INDEX IF EXISTS `idx_watching_progress_user_movie`;
DROP INDEX IF EXISTS `idx_reading_progress_user_chapter`;
DROP INDEX IF EXISTS `idx_publisher_source_id`;
DROP INDEX IF EXISTS `idx_actor_source_id`;
DROP INDEX IF EXISTS `idx_movie_pub_publisher_id`;
DROP INDEX IF EXISTS `idx_movie_pub`;
DROP INDEX IF EXISTS `idx_movie_actor_actor_id`;
DROP INDEX IF EXISTS `idx_movie_actor`;

-- 3. 注意事项：
-- - SQLite 不支持 DROP COLUMN，所以无法删除已添加的列
-- - 如果列已经添加，0016 迁移会重建表来修复
-- - 执行后请运行：wrangler d1 migrations apply starye-db --remote

SELECT '清理完成，现在可以重新应用迁移' as status;
