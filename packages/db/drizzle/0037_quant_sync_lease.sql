ALTER TABLE `quant_sync_state` ADD `run_id` text;
--> statement-breakpoint
ALTER TABLE `quant_sync_state` ADD `lease_expires_at` integer;
