CREATE TABLE `quant_research_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`research_run_id` text NOT NULL REFERENCES `quant_research_run`(`id`) ON DELETE CASCADE,
	`summary_version` text NOT NULL,
	`report_version` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`summary_json` text NOT NULL,
	`cited_evidence_keys_json` text NOT NULL,
	`generated_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quant_research_summary_user_run_generated_at` ON `quant_research_summary` (`user_id`, `research_run_id`, `generated_at`);
--> statement-breakpoint
CREATE INDEX `idx_quant_research_summary_user_generated_at` ON `quant_research_summary` (`user_id`, `generated_at`);
