CREATE TABLE `quant_research_run` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`ts_code` text NOT NULL,
	`name` text,
	`status` text NOT NULL,
	`report_version` text NOT NULL,
	`source_snapshot_id` text,
	`report_json` text NOT NULL,
	`generated_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quant_research_run_user_generated_at` ON `quant_research_run` (`user_id`, `generated_at`);
--> statement-breakpoint
CREATE INDEX `idx_quant_research_run_user_ts_code_generated_at` ON `quant_research_run` (`user_id`, `ts_code`, `generated_at`);
