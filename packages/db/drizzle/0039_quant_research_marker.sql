CREATE TABLE `quant_research_marker` (
	`id` text PRIMARY KEY NOT NULL,
	`ts_code` text NOT NULL,
	`status` text DEFAULT 'unreviewed' NOT NULL,
	`note` text,
	`review_date` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_research_marker_ts_code` ON `quant_research_marker` (`ts_code`);
--> statement-breakpoint
CREATE INDEX `idx_quant_research_marker_status` ON `quant_research_marker` (`status`);
