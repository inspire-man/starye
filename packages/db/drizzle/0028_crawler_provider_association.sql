CREATE TABLE `crawler_run_provider_association` (
	`run_id` text PRIMARY KEY NOT NULL,
	`application_attempt` integer NOT NULL,
	`provider` text NOT NULL,
	`template_key` text NOT NULL,
	`target` text NOT NULL,
	`workflow` text NOT NULL,
	`repository` text NOT NULL,
	`ref` text NOT NULL,
	`environment` text NOT NULL,
	`crawler_entrypoint` text NOT NULL,
	`provider_run_id` text,
	`provider_run_attempt` integer,
	`sha` text,
	`provider_status` text,
	`provider_conclusion` text,
	`reconciliation_window_ends_at` integer,
	`safe_facts_json` text,
	`schedule_bucket` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_provider_run_attempt` ON `crawler_run_provider_association` (`provider_run_id`,`provider_run_attempt`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_provider_application_run_attempt` ON `crawler_run_provider_association` (`run_id`,`application_attempt`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_provider_schedule_bucket` ON `crawler_run_provider_association` (`template_key`,`target`,`workflow`,`schedule_bucket`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_provider_reconciliation_window` ON `crawler_run_provider_association` (`reconciliation_window_ends_at`);
