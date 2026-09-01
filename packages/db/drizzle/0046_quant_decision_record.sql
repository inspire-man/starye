CREATE TABLE `quant_decision_record` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`research_run_id` text NOT NULL REFERENCES `quant_research_run`(`id`) ON DELETE CASCADE,
	`ts_code` text NOT NULL,
	`action` text NOT NULL,
	`note` text,
	`snapshot_json` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_decision_record_user_run` ON `quant_decision_record` (`user_id`, `research_run_id`);
--> statement-breakpoint
CREATE INDEX `idx_quant_decision_record_user_ts_code_updated_at` ON `quant_decision_record` (`user_id`, `ts_code`, `updated_at`);
