import type { BackupScheduleType, BackupWorkflowBinding } from "./types";

export const BACKUP_SETTINGS_ID = "default";
export const BACKUP_PREFIX = "backups/database";

export class BackupWorkflowUnavailableError extends Error {
	constructor() {
		super(
			"Database backups are unavailable because the DATABASE_BACKUP_WORKFLOW binding is missing. Deploy the app with `npm run deploy` so Wrangler applies the workflow configuration.",
		);
		this.name = "BackupWorkflowUnavailableError";
	}
}

export function getBackupWorkflowBinding(env: CloudflareEnv): BackupWorkflowBinding {
	const workflow = env.DATABASE_BACKUP_WORKFLOW as BackupWorkflowBinding | undefined;
	if (!workflow || typeof workflow.create !== "function") {
		throw new BackupWorkflowUnavailableError();
	}
	return workflow;
}

export function isBackupDue(
	scheduleType: BackupScheduleType,
	scheduleValue: number | null,
	now: Date,
): boolean {
	if (scheduleType === "daily") return true;
	if (scheduleType === "weekly") return now.getUTCDay() === scheduleValue;
	return now.getUTCDate() === scheduleValue;
}

export function getUtcDayBounds(now: Date): { start: number; end: number } {
	const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	return { start, end: start + 86_400_000 };
}

export function createBackupFilename(now: Date): string {
	return `mailflare-${now.toISOString().replace(/[:.]/g, "-")}.json`;
}
