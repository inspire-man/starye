CREATE TABLE `quant_candidate_ai_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`snapshot_id` text NOT NULL,
	`snapshot_generated_at` integer NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`scope_key` text NOT NULL,
	`candidate_codes_json` text NOT NULL,
	`briefing_json` text NOT NULL,
	`questions_json` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quant_candidate_ai_session_user_created_at` ON `quant_candidate_ai_session` (`user_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_quant_candidate_ai_session_user_snapshot_generated_at` ON `quant_candidate_ai_session` (`user_id`, `snapshot_generated_at`);
