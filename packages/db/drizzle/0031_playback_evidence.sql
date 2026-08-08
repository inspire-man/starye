-- Custom SQL migration file, put your code below! --
CREATE UNIQUE INDEX `idx_crawler_run_task_pair` ON `crawler_run` (`task_id`,`id`);
--> statement-breakpoint
CREATE TABLE `playback_evidence_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`run_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`provider` text NOT NULL,
	`content_id` text NOT NULL,
	`source_revision` integer NOT NULL,
	`evidence_identity` text NOT NULL,
	`evidence_hash` text NOT NULL,
	`playback_status` text NOT NULL,
	`summary_json` text NOT NULL,
	`artifact_reference` text NOT NULL,
	`artifact_stem` text NOT NULL,
	`artifact_hash` text NOT NULL,
	`observed_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `crawler_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`,`run_id`) REFERENCES `crawler_run`(`task_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_playback_evidence_summary_tuple` ON `playback_evidence_summary` (`task_id`,`run_id`,`attempt_number`,`provider`,`content_id`,`source_revision`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_playback_evidence_summary_content_revision` ON `playback_evidence_summary` (`content_id`,`source_revision`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_playback_evidence_summary_identity` ON `playback_evidence_summary` (`evidence_identity`);
--> statement-breakpoint
CREATE INDEX `idx_playback_evidence_summary_run_observed` ON `playback_evidence_summary` (`run_id`,`observed_at`);
--> statement-breakpoint
CREATE TABLE `playback_evidence_rejection` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`run_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`provider` text NOT NULL,
	`content_id` text NOT NULL,
	`source_revision` integer NOT NULL,
	`evidence_identity` text NOT NULL,
	`evidence_hash` text NOT NULL,
	`artifact_reference` text NOT NULL,
	`artifact_stem` text NOT NULL,
	`artifact_hash` text NOT NULL,
	`outcome` text NOT NULL,
	`reason_code` text NOT NULL,
	`observed_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `crawler_task`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`content_id`) REFERENCES `movie`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`,`run_id`) REFERENCES `crawler_run`(`task_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_playback_evidence_rejection_tuple` ON `playback_evidence_rejection` (`task_id`,`run_id`,`attempt_number`,`provider`,`content_id`,`source_revision`);
--> statement-breakpoint
CREATE INDEX `idx_playback_evidence_rejection_run_created` ON `playback_evidence_rejection` (`run_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_playback_evidence_rejection_outcome_created` ON `playback_evidence_rejection` (`outcome`,`created_at`);
