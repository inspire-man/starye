CREATE TABLE `quant_ai_run_audit` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `research_run_id` text NOT NULL REFERENCES `quant_research_run`(`id`) ON DELETE CASCADE,
  `summary_id` text REFERENCES `quant_research_summary`(`id`) ON DELETE SET NULL,
  `operation` text DEFAULT 'research-summary' NOT NULL,
  `provider` text NOT NULL,
  `model` text NOT NULL,
  `response_mode` text NOT NULL,
  `generation_timeout_ms` integer NOT NULL,
  `status` text NOT NULL,
  `received_chars` integer DEFAULT 0 NOT NULL,
  `duration_ms` integer NOT NULL,
  `finish_reason` text,
  `error_code` text,
  `error_message` text,
  `started_at` integer NOT NULL,
  `completed_at` integer NOT NULL,
  `created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
  CHECK (`operation` = 'research-summary'),
  CHECK (`provider` IN ('openai_compatible', 'deepseek', 'qwen', 'gemini', 'ollama')),
  CHECK (`response_mode` IN ('stream', 'json')),
  CHECK (`status` IN ('completed', 'failed', 'cancelled')),
  CHECK (`generation_timeout_ms` >= 300000 AND `generation_timeout_ms` <= 600000),
  CHECK (`received_chars` >= 0 AND `received_chars` <= 8000),
  CHECK (`duration_ms` >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_quant_ai_run_audit_user_run_completed_at` ON `quant_ai_run_audit` (`user_id`, `research_run_id`, `completed_at`);
--> statement-breakpoint
CREATE INDEX `idx_quant_ai_run_audit_user_completed_at` ON `quant_ai_run_audit` (`user_id`, `completed_at`);
