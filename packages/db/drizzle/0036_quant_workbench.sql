CREATE TABLE `quant_watchlist` (
	`id` text PRIMARY KEY NOT NULL,
	`ts_code` text NOT NULL,
	`name` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_watchlist_ts_code` ON `quant_watchlist` (`ts_code`);
--> statement-breakpoint
CREATE INDEX `idx_quant_watchlist_created_at` ON `quant_watchlist` (`created_at`);
--> statement-breakpoint
CREATE TABLE `quant_daily_bar` (
	`id` text PRIMARY KEY NOT NULL,
	`ts_code` text NOT NULL,
	`trade_date` text NOT NULL,
	`open` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	`pre_close` real,
	`change` real,
	`pct_chg` real,
	`volume` real NOT NULL,
	`amount` real,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_quant_daily_bar_identity` ON `quant_daily_bar` (`ts_code`,`trade_date`);
--> statement-breakpoint
CREATE INDEX `idx_quant_daily_bar_ts_code_date` ON `quant_daily_bar` (`ts_code`,`trade_date`);
--> statement-breakpoint
CREATE TABLE `quant_scan_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`factor_version` text NOT NULL,
	`input_ts_codes_json` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`candidate_count` integer NOT NULL,
	`candidates_json` text NOT NULL,
	`generated_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_quant_scan_snapshot_generated_at` ON `quant_scan_snapshot` (`generated_at`);
--> statement-breakpoint
CREATE INDEX `idx_quant_scan_snapshot_status_generated` ON `quant_scan_snapshot` (`status`,`generated_at`);
--> statement-breakpoint
CREATE TABLE `quant_sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`requested_count` integer DEFAULT 0 NOT NULL,
	`written_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`reason_code` text,
	`reason` text,
	`snapshot_id` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
