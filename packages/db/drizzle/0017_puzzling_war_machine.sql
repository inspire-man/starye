DROP INDEX IF EXISTS `idx_movie_actor_actor_id`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_movie_actor_actor_id` ON `movie_actor` (`actor_id`);--> statement-breakpoint
DROP INDEX IF EXISTS `idx_movie_pub_publisher_id`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_movie_pub_publisher_id` ON `movie_publisher` (`publisher_id`);
