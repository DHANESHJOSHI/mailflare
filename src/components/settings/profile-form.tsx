"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";
import type { ProfileFormProps, ProfileFormResponse } from "./types";

export function ProfileForm({ initialName, initialResetEmail, initialForwardingEmail, canForwardEmail, email }: ProfileFormProps) {
	const [name, setName] = useState(initialName);
	const [resetEmail, setResetEmail] = useState(initialResetEmail);
	const [forwardingEmail, setForwardingEmail] = useState(initialForwardingEmail);
	const [savedName, setSavedName] = useState(initialName);
	const [savedResetEmail, setSavedResetEmail] = useState(initialResetEmail);
	const [savedForwardingEmail, setSavedForwardingEmail] = useState(initialForwardingEmail);
	const [status, setStatus] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const hasChanges =
		name.trim() !== savedName ||
		resetEmail.trim() !== savedResetEmail ||
		forwardingEmail.trim() !== savedForwardingEmail;

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setStatus(null);

		try {
			const res = await authFetch("/api/settings/profile", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, resetEmail, forwardingEmail }),
			});
			const data = (await res.json()) as ProfileFormResponse;

			if (!res.ok) {
				setStatus(typeof data.error === "string" ? data.error : "Failed to update account");
				return;
			}

			const nextName = data.user?.name ?? name.trim();
			const nextResetEmail = data.user?.resetEmail ?? "";
			const nextForwardingEmail = data.user?.forwardingEmail ?? "";
			setName(nextName);
			setResetEmail(nextResetEmail);
			setForwardingEmail(nextForwardingEmail);
			setSavedName(nextName);
			setSavedResetEmail(nextResetEmail);
			setSavedForwardingEmail(nextForwardingEmail);
			setStatus("Saved");
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to update account");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="accountEmail">Current email</Label>
				<Input id="accountEmail" value={email} type="email" readOnly aria-readonly="true" className="bg-neutral-50" />
			</div>
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
			</div>
			<div className="space-y-2">
				<Label htmlFor="resetEmail">Recovery email</Label>
				<Input
					id="resetEmail"
					value={resetEmail}
					onChange={(event) => setResetEmail(event.target.value)}
					type="email"
					placeholder="recovery@example.com"
				/>
			</div>
			{canForwardEmail && <div className="space-y-2">
				<Label htmlFor="forwardingEmail">Forwarding email (optional)</Label>
				<Input
					id="forwardingEmail"
					value={forwardingEmail}
					onChange={(event) => setForwardingEmail(event.target.value)}
					type="email"
					placeholder="destination@example.com"
				/>
				<p className="text-xs leading-5 text-neutral-500">
					Incoming mail will also be sent to this verified Cloudflare Email Routing destination.
				</p>
			</div>}
			<div className="flex items-center gap-3">
				<Button type="submit" disabled={loading || !hasChanges}>
					{loading ? "Saving..." : "Save"}
				</Button>
				{status && <p className="text-sm text-neutral-500">{status}</p>}
			</div>
		</form>
	);
}
