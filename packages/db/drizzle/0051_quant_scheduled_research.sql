CREATE TABLE `quant_scheduled_research_run` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`status` text NOT NULL,
	`due_count` integer DEFAULT 0 NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`cursor_ts_code` text,
	`lease_expires_at` integer,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quant_scheduled_research_run_user_started_at` ON `quant_scheduled_research_run` (`user_id`, `started_at`);
--> statement-breakpoint
CREATE INDEX `idx_quant_scheduled_research_run_user_status` ON `quant_scheduled_research_run` (`user_id`, `status`);
--> statement-breakpoint
CREATE TABLE `quant_scheduled_research_item` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL REFERENCES `quant_scheduled_research_run`(`id`) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`ts_code` text NOT NULL,
	`name` text,
	`reasons_json` text NOT NULL,
	`stage` text NOT NULL,
	`ai_status` text NOT NULL,
	`error_stage` text,
	`error_code` text,
	`research_run_id` text,
	`review_date_before` text,
	`review_date_after` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_scheduled_research_item_run_ts_code` ON `quant_scheduled_research_item` (`run_id`, `ts_code`);
--> statement-breakpoint
CREATE INDEX `idx_quant_scheduled_research_item_user_run` ON `quant_scheduled_research_item` (`user_id`, `run_id`);
