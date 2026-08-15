-- Remove legacy indexes before recreating them with the schema-owned definitions.
DROP INDEX IF EXISTS `idx_movie_actor`;
DROP INDEX IF EXISTS `idx_movie_actor_actor_id`;
DROP INDEX IF EXISTS `idx_movie_pub`;
DROP INDEX IF EXISTS `idx_movie_pub_publisher_id`;

-- Keep one deterministic row for each logical movie/entity association.
DELETE FROM `movie_actor`
WHERE `id` NOT IN (
  SELECT MIN(`id`)
  FROM `movie_actor`
  GROUP BY `movie_id`, `actor_id`
);

DELETE FROM `movie_publisher`
WHERE `id` NOT IN (
  SELECT MIN(`id`)
  FROM `movie_publisher`
  GROUP BY `movie_id`, `publisher_id`
);

CREATE UNIQUE INDEX IF NOT EXISTS `idx_movie_actor`
  ON `movie_actor` (`movie_id`, `actor_id`);
CREATE INDEX IF NOT EXISTS `idx_movie_actor_actor_id`
  ON `movie_actor` (`actor_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_movie_pub`
  ON `movie_publisher` (`movie_id`, `publisher_id`);
CREATE INDEX IF NOT EXISTS `idx_movie_pub_publisher_id`
  ON `movie_publisher` (`publisher_id`);
