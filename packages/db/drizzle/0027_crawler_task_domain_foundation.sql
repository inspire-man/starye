CREATE TABLE `crawler_task` (
	`id` text PRIMARY KEY NOT NULL,
	`template_key` text NOT NULL,
	`template_version` integer NOT NULL,
	`requested_by_user_id` text NOT NULL,
	`request_snapshot_json` text NOT NULL,
	`idempotency_key` text,
	`latest_run_id` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`requested_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_task_requester_idempotency` ON `crawler_task` (`requested_by_user_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_task_requester_created` ON `crawler_task` (`requested_by_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_task_template_updated` ON `crawler_task` (`template_key`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `crawler_run` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`status` text NOT NULL,
	`state_version` integer DEFAULT 0 NOT NULL,
	`last_event_sequence` integer DEFAULT 0 NOT NULL,
	`lease_expires_at` integer,
	`last_heartbeat_at` integer,
	`cancel_requested_at` integer,
	`failure_code` text,
	`receipt_summary_json` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`terminal_at` integer,
	FOREIGN KEY (`task_id`) REFERENCES `crawler_task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_run_task_attempt` ON `crawler_run` (`task_id`,`attempt_number`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_run_task_created` ON `crawler_run` (`task_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_run_status_lease_expiry` ON `crawler_run` (`status`,`lease_expires_at`);
--> statement-breakpoint
CREATE TABLE `crawler_run_transition` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason_code` text NOT NULL,
	`safe_summary` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_run_transition_run_sequence` ON `crawler_run_transition` (`run_id`,`sequence`);
--> statement-breakpoint
CREATE TABLE `crawler_template_lease` (
	`template_key` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`renewed_at` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `crawler_runner_event` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`event_id` text NOT NULL,
	`nonce` text NOT NULL,
	`sequence` integer NOT NULL,
	`body_sha256` text NOT NULL,
	`key_id` text NOT NULL,
	`outcome` text NOT NULL,
	`received_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_runner_event_run_event` ON `crawler_runner_event` (`run_id`,`event_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_runner_event_run_nonce` ON `crawler_runner_event` (`run_id`,`nonce`);
--> statement-breakpoint
CREATE TABLE `crawler_run_log` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`level` text NOT NULL,
	`code` text NOT NULL,
	`safe_message` text NOT NULL,
	`counts_json` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `crawler_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_crawler_run_log_run_sequence` ON `crawler_run_log` (`run_id`,`sequence`);
--> statement-breakpoint
CREATE INDEX `idx_crawler_run_log_expiry` ON `crawler_run_log` (`expires_at`);
