CREATE TABLE `comic_chapter_source_snapshot` (
  `id` text PRIMARY KEY NOT NULL,
  `comic_id` text NOT NULL,
  `source_revision` integer NOT NULL,
  `source_url` text,
  `terminal_state` text NOT NULL,
  `source_count` integer NOT NULL,
  `row_count` integer NOT NULL,
  `snapshot_identity` text NOT NULL,
  `source_fingerprint` text NOT NULL,
  `observed_at` integer NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  FOREIGN KEY (`comic_id`) REFERENCES `comic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_comic_chapter_source_snapshot_revision` ON `comic_chapter_source_snapshot` (`comic_id`,`source_revision`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_comic_chapter_source_snapshot_identity` ON `comic_chapter_source_snapshot` (`snapshot_identity`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_comic_chapter_source_snapshot_fingerprint` ON `comic_chapter_source_snapshot` (`comic_id`,`source_fingerprint`);
--> statement-breakpoint
CREATE INDEX `idx_comic_chapter_source_snapshot_observed` ON `comic_chapter_source_snapshot` (`comic_id`,`observed_at`);
--> statement-breakpoint
CREATE TABLE `comic_chapter_source_row` (
  `id` text PRIMARY KEY NOT NULL,
  `snapshot_id` text NOT NULL,
  `comic_id` text NOT NULL,
  `source_ordinal` integer NOT NULL,
  `identity` text NOT NULL,
  `title` text NOT NULL,
  `slug` text,
  `chapter_number` integer,
  `source_url` text,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  FOREIGN KEY (`snapshot_id`) REFERENCES `comic_chapter_source_snapshot`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`comic_id`) REFERENCES `comic`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_comic_chapter_source_row_ordinal` ON `comic_chapter_source_row` (`snapshot_id`,`source_ordinal`);
--> statement-breakpoint
CREATE INDEX `idx_comic_chapter_source_row_identity` ON `comic_chapter_source_row` (`snapshot_id`,`identity`);
--> statement-breakpoint
CREATE INDEX `idx_comic_chapter_source_row_comic` ON `comic_chapter_source_row` (`comic_id`,`snapshot_id`);
--> statement-breakpoint
CREATE TABLE `chapter_completeness_observation` (
  `id` text PRIMARY KEY NOT NULL,
  `comic_id` text NOT NULL,
  `snapshot_id` text NOT NULL,
  `source_revision` integer NOT NULL,
  `status` text NOT NULL,
  `reason_code` text NOT NULL,
  `counts_json` text NOT NULL,
  `findings_json` text NOT NULL,
  `observation_identity` text NOT NULL,
  `event_sequence` integer DEFAULT 0 NOT NULL,
  `task_id` text,
  `run_id` text,
  `attempt_number` integer,
  `provider` text DEFAULT 'sync' NOT NULL,
  `observed_at` integer NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  FOREIGN KEY (`comic_id`) REFERENCES `comic`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`snapshot_id`) REFERENCES `comic_chapter_source_snapshot`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_completeness_observation_identity` ON `chapter_completeness_observation` (`observation_identity`);
--> statement-breakpoint
CREATE INDEX `idx_chapter_completeness_observation_comic_revision` ON `chapter_completeness_observation` (`comic_id`,`source_revision`);
--> statement-breakpoint
CREATE INDEX `idx_chapter_completeness_observation_tuple` ON `chapter_completeness_observation` (`run_id`,`attempt_number`,`event_sequence`);
--> statement-breakpoint
CREATE TABLE `chapter_completeness_current` (
  `comic_id` text PRIMARY KEY NOT NULL,
  `snapshot_id` text NOT NULL,
  `source_revision` integer NOT NULL,
  `status` text NOT NULL,
  `reason_code` text NOT NULL,
  `counts_json` text NOT NULL,
  `findings_json` text NOT NULL,
  `observation_identity` text NOT NULL,
  `projection_version` integer DEFAULT 0 NOT NULL,
  `observed_at` integer NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  FOREIGN KEY (`comic_id`) REFERENCES `comic`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`snapshot_id`) REFERENCES `comic_chapter_source_snapshot`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_completeness_current_observation` ON `chapter_completeness_current` (`observation_identity`);
--> statement-breakpoint
CREATE INDEX `idx_chapter_completeness_current_revision` ON `chapter_completeness_current` (`comic_id`,`source_revision`);
--> statement-breakpoint
CREATE TABLE `chapter_page_availability_observation` (
  `id` text PRIMARY KEY NOT NULL,
  `chapter_id` text NOT NULL,
  `source_revision` integer NOT NULL,
  `policy_version` text NOT NULL,
  `page_number` integer NOT NULL,
  `page_identity` text NOT NULL,
  `status` text NOT NULL,
  `reason_code` text NOT NULL,
  `http_status` integer,
  `content_type` text,
  `url_identity` text NOT NULL,
  `summary_json` text NOT NULL,
  `observation_identity` text NOT NULL,
  `event_sequence` integer DEFAULT 0 NOT NULL,
  `task_id` text,
  `run_id` text,
  `attempt_number` integer,
  `provider` text DEFAULT 'integrity' NOT NULL,
  `observed_at` integer NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_page_availability_observation_identity` ON `chapter_page_availability_observation` (`observation_identity`);
--> statement-breakpoint
CREATE INDEX `idx_chapter_page_availability_observation_chapter_revision` ON `chapter_page_availability_observation` (`chapter_id`,`source_revision`);
--> statement-breakpoint
CREATE INDEX `idx_chapter_page_availability_observation_page` ON `chapter_page_availability_observation` (`chapter_id`,`page_number`);
--> statement-breakpoint
CREATE TABLE `chapter_page_availability_current` (
  `chapter_id` text PRIMARY KEY NOT NULL,
  `source_revision` integer NOT NULL,
  `policy_version` text NOT NULL,
  `status` text NOT NULL,
  `expected_page_count` integer NOT NULL,
  `stored_page_count` integer NOT NULL,
  `available_page_count` integer NOT NULL,
  `unavailable_page_count` integer NOT NULL,
  `unknown_page_count` integer NOT NULL,
  `findings_json` text NOT NULL,
  `samples_json` text NOT NULL,
  `observation_identity` text NOT NULL,
  `projection_version` integer DEFAULT 0 NOT NULL,
  `observed_at` integer NOT NULL,
  `updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  FOREIGN KEY (`chapter_id`) REFERENCES `chapter`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_page_availability_current_observation` ON `chapter_page_availability_current` (`observation_identity`);
--> statement-breakpoint
CREATE INDEX `idx_chapter_page_availability_current_revision` ON `chapter_page_availability_current` (`chapter_id`,`source_revision`);
