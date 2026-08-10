CREATE TABLE `crawler_availability_observation` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`run_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`provider` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`content_id` text NOT NULL,
	`source_revision` integer NOT NULL,
	`policy_version` text NOT NULL,
	`observation_identity` text NOT NULL,
	`event_sequence` integer NOT NULL,
	`freshness` text NOT NULL,
	`status` text NOT NULL,
	`reason_code` text NOT NULL,
	`next_action` text NOT NULL,
	`summary_json` text NOT NULL,
	`observed_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `crawler_task`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`,`run_id`) REFERENCES `crawler_run`(`task_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_availability_observation_identity` ON `crawler_availability_observation` (`observation_identity`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_availability_observation_event` ON `crawler_availability_observation` (`run_id`,`attempt_number`,`event_sequence`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_availability_observation_task_attempt` ON `crawler_availability_observation` (`task_id`,`run_id`,`attempt_number`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_availability_observation_target_revision` ON `crawler_availability_observation` (`target_kind`,`target_id`,`content_id`,`source_revision`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_availability_observation_observed` ON `crawler_availability_observation` (`observed_at`);
--> statement-breakpoint
CREATE TABLE `crawler_availability_current` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`run_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`provider` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`content_id` text NOT NULL,
	`source_revision` integer NOT NULL,
	`policy_version` text NOT NULL,
	`observation_identity` text NOT NULL,
	`event_sequence` integer NOT NULL,
	`projection_version` integer DEFAULT 0 NOT NULL,
	`freshness` text NOT NULL,
	`status` text NOT NULL,
	`reason_code` text NOT NULL,
	`next_action` text NOT NULL,
	`summary_json` text NOT NULL,
	`observed_at` integer NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `crawler_task`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`,`run_id`) REFERENCES `crawler_run`(`task_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_availability_current_target` ON `crawler_availability_current` (`target_kind`,`target_id`,`content_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_availability_current_observation` ON `crawler_availability_current` (`observation_identity`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_availability_current_task_attempt` ON `crawler_availability_current` (`task_id`,`run_id`,`attempt_number`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_availability_current_target_revision` ON `crawler_availability_current` (`target_kind`,`target_id`,`content_id`,`source_revision`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_availability_current_policy_version` ON `crawler_availability_current` (`policy_version`,`projection_version`);
