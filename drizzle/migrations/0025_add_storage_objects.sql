CREATE TABLE IF NOT EXISTS `storage_objects` (
	`key` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`total_chunks` integer NOT NULL,
	`data` blob NOT NULL,
	`content_type` text,
	`custom_metadata` text,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`key`, `chunk_index`)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `storage_objects_key_idx` ON `storage_objects` (`key`);
