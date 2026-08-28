import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { backups } from "@/db/schema";
import { getD1ExportConfiguration, requestD1Export } from "./export";
import { createScheduledBackupIfDue, getBackupSettings } from "./service";
import type { BackupWorkflowParams } from "./types";
import {
	BACKUP_PREFIX,
	createBackupFilename,
} from "./utils";

const EXPORT_RETRIES = 20;

export class DatabaseBackupWorkflow extends WorkflowEntrypoint<CloudflareEnv, BackupWorkflowParams> {
	async run(event: Readonly<WorkflowEvent<BackupWorkflowParams>>, step: WorkflowStep) {
		let backupId = event.payload?.backupId;
		if (!backupId) {
			backupId = await step.do("Check backup schedule", async () =>
				createScheduledBackupIfDue(this.env, event.timestamp),
			);
		}
		if (!backupId) {
			const retention = await step.do("Delete expired backups", async () => this.deleteExpiredBackups());
			return { skipped: true, ...retention };
		}

		try {
			await step.do("Mark backup running", async () => {
				await getDb(this.env)
					.update(backups)
					.set({ status: "running", startedAt: new Date() })
					.where(eq(backups.id, backupId));
			});

			const exportConfiguration = getD1ExportConfiguration(this.env);
			const bookmark = await step.do("Start D1 export", async () => {
				const response = await requestD1Export(exportConfiguration, { output_format: "polling" });
				if (!response.result?.at_bookmark) throw new Error("D1 export did not return a bookmark");
				return response.result.at_bookmark;
			});

			let signedUrl = "";
			let exportFilename = "";
			for (let attempt = 1; attempt <= EXPORT_RETRIES; attempt += 1) {
				const result = await step.do(`Poll D1 export ${attempt}`, async () =>
					requestD1Export(exportConfiguration, { output_format: "polling", current_bookmark: bookmark }),
				);
				// The polling response nests the finished export one level deeper
				// (result.result.result); fall back to the flat shape defensively.
				const finished = result.result?.result ?? result.result;
				if (finished?.signed_url) {
					signedUrl = finished.signed_url;
					exportFilename = finished.filename ?? "";
					break;
				}
				if (attempt < EXPORT_RETRIES) await step.sleep(`Wait for D1 export ${attempt}`, "15 seconds");
			}
			if (!signedUrl) throw new Error("D1 export did not finish before the polling limit");

			const stored = await step.do("Store backup in R2", async () => {
				const response = await fetch(signedUrl);
				if (!response.ok || !response.body) throw new Error("Failed to download the D1 export");
				const filename = exportFilename || createBackupFilename(new Date());
				const r2Key = `${BACKUP_PREFIX}/${backupId}/${filename}`;
				const object = await this.env.BUCKET.put(r2Key, response.body, {
					httpMetadata: { contentType: "application/sql" },
					customMetadata: { backupId },
				});
				return { filename, r2Key, size: object.size };
			});

			await step.do("Complete backup", async () => {
				await getDb(this.env)
					.update(backups)
					.set({
						status: "completed",
						filename: stored.filename,
						r2Key: stored.r2Key,
						size: stored.size,
						completedAt: new Date(),
						error: null,
					})
					.where(eq(backups.id, backupId));
			});

			await step.do("Delete expired backups", async () => this.deleteExpiredBackups());
			return { backupId, ...stored };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Backup failed";
			await getDb(this.env)
				.update(backups)
				.set({ status: "failed", error: message, completedAt: new Date() })
				.where(eq(backups.id, backupId));
			throw error;
		}
	}

	private async deleteExpiredBackups(): Promise<{ deleted: number }> {
		const settings = await getBackupSettings(this.env);
		if (!settings?.retentionEnabled) return { deleted: 0 };
		const cutoff = new Date(Date.now() - settings.retentionDays * 86_400_000);
		const db = getDb(this.env);
		const expired = await db
			.select()
			.from(backups)
			.where(
				and(
					lt(backups.createdAt, cutoff),
					inArray(backups.status, ["completed", "failed"]),
				),
			);
		for (const backup of expired) {
			if (backup.r2Key) await this.env.BUCKET.delete(backup.r2Key);
			await db.delete(backups).where(eq(backups.id, backup.id));
		}
		return { deleted: expired.length };
	}
}
