ALTER TABLE `chapter_completeness_current` ADD `terminal_state` text DEFAULT 'complete' NOT NULL;
--> statement-breakpoint
UPDATE `chapter_completeness_current`
SET `terminal_state` = COALESCE(
  (
    SELECT `snapshot`.`terminal_state`
    FROM `comic_chapter_source_snapshot` AS `snapshot`
    WHERE `snapshot`.`id` = `chapter_completeness_current`.`snapshot_id`
  ),
  `status`
);
