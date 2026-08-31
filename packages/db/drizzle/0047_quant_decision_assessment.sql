CREATE TABLE `quant_decision_assessment` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`research_run_id` text NOT NULL REFERENCES `quant_research_run`(`id`) ON DELETE CASCADE,
	`ts_code` text NOT NULL,
	`mode` text NOT NULL,
	`current_price` real NOT NULL,
	`cost_basis` real,
	`quantity` real,
	`snapshot_json` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quant_decision_assessment_user_ts_code_created_at` ON `quant_decision_assessment` (`user_id`, `ts_code`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_quant_decision_assessment_user_run_created_at` ON `quant_decision_assessment` (`user_id`, `research_run_id`, `created_at`);
