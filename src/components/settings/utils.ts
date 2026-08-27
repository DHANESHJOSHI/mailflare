import type { MailboxOption } from "@/components/mailbox-provider";
import { clearMailboxesCache } from "@/components/mailbox-provider-utils";
import { authFetch } from "@/lib/auth/client";
import type { CurrentMailboxFormResponse } from "./types";
import type { AccountSettingsResponse, ChangePasswordResponse } from "./types";

export function getMailboxAddress(mailbox: Pick<MailboxOption, "localPart" | "hostname">): string {
	return `${mailbox.localPart}@${mailbox.hostname}`;
}

export async function updateCurrentMailboxName(id: string, displayName: string): Promise<MailboxOption> {
	const res = await authFetch(`/api/mailboxes/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ displayName }),
	});
	const data = (await res.json()) as CurrentMailboxFormResponse;

	if (!res.ok || !data.mailbox) {
		throw new Error(typeof data.error === "string" ? data.error : "Failed to update mailbox");
	}
	clearMailboxesCache();

	return {
		id: data.mailbox.id,
		localPart: data.mailbox.localPart,
		hostname: data.mailbox.hostname,
		displayName: data.mailbox.displayName,
		hasAvatar: data.mailbox.hasAvatar,
		isPrimary: data.mailbox.isPrimary,
	};
}

export async function loadAccountSettings(): Promise<Required<AccountSettingsResponse>["user"]> {
	const res = await authFetch("/api/auth/me");
	const data = (await res.json()) as AccountSettingsResponse;

	if (!res.ok || !data.user) {
		throw new Error(typeof data.error === "string" ? data.error : "Failed to load account");
	}

	return data.user;
}

export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
	const res = await authFetch("/api/settings/password", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ currentPassword, newPassword }),
	});
	const data = (await res.json()) as ChangePasswordResponse;

	if (!res.ok) {
		throw new Error(typeof data.error === "string" ? data.error : "Failed to change password");
	}
}
