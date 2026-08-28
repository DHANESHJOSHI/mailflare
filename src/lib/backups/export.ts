import type { D1ExportResponse } from "./types";
import { getExportError } from "./utils";

export function getD1ExportConfigurationStatus(env: CloudflareEnv) {
	const accountId = env.CF_AID?.trim();
	const databaseId = env.D1_DATABASE_ID?.trim();
	const token = env.D1_BACKUP_TOKEN?.trim() || env.CF_TOKEN?.trim();
	const missing = [
		!accountId ? "CF_AID" : null,
		!databaseId ? "D1_DATABASE_ID" : null,
		!token ? "D1_BACKUP_TOKEN or CF_TOKEN" : null,
	].filter((value): value is string => Boolean(value));

	return { configured: missing.length === 0, missing };
}

export function getD1ExportConfiguration(env: CloudflareEnv) {
	const status = getD1ExportConfigurationStatus(env);

	if (!status.configured) {
		throw new Error(
			`Database backups require ${status.missing.join(", ")}. Configure ${status.missing.length === 1 ? "it" : "them"} in the Worker's Variables and Secrets settings.`,
		);
	}

	return {
		token: (env.D1_BACKUP_TOKEN?.trim() || env.CF_TOKEN?.trim())!,
		url: `https://api.cloudflare.com/client/v4/accounts/${env.CF_AID!.trim()}/d1/database/${env.D1_DATABASE_ID!.trim()}/export`,
	};
}

export async function requestD1Export(
	configuration: ReturnType<typeof getD1ExportConfiguration>,
	payload: object,
): Promise<D1ExportResponse> {
	const response = await fetch(configuration.url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${configuration.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});
	const result = (await response.json()) as D1ExportResponse;
	if (!response.ok || !result.success) throw new Error(getExportError(result));
	return result;
}
