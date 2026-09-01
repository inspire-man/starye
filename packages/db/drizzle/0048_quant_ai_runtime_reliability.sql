ALTER TABLE `quant_ai_config` ADD `response_mode` text DEFAULT 'stream' NOT NULL;
--> statement-breakpoint
ALTER TABLE `quant_ai_config` ADD `generation_timeout_ms` integer DEFAULT 300000 NOT NULL;
