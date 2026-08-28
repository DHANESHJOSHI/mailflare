"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { authFetch } from "@/lib/auth/client";
import type { ManagedAccount, ManagedDomain, ManagedMailbox } from "./types";

export default function AccountDetailsPage() {
	const { id } = useParams<{ id: string }>();
	const [account, setAccount] = useState<ManagedAccount | null>(null);
	const [mailboxes, setMailboxes] = useState<ManagedMailbox[]>([]);
	const [domains, setDomains] = useState<ManagedDomain[]>([]);
	const [localPart, setLocalPart] = useState("");
	const [domainId, setDomainId] = useState("");
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [avatarVersion, setAvatarVersion] = useState(0);

	async function load() {
		const [accountResponse, mailboxResponse, domainResponse] = await Promise.all([
			authFetch(`/api/accounts/${id}`),
			authFetch(`/api/accounts/${id}/mailboxes`),
			authFetch("/api/domains"),
		]);
		const accountData = (await accountResponse.json()) as { account?: ManagedAccount; error?: string };
		if (!accountResponse.ok || !accountData.account) throw new Error(accountData.error ?? "Unable to load account");
		setAccount(accountData.account);
		setMailboxes(((await mailboxResponse.json()) as { mailboxes?: ManagedMailbox[] }).mailboxes ?? []);
		const nextDomains = ((await domainResponse.json()) as { domains?: ManagedDomain[] }).domains ?? [];
		setDomains(nextDomains);
		setDomainId((current) => current || nextDomains[0]?.id || "");
	}

	useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load account")); }, [id]);

	async function saveAccount() {
		if (!account) return;
		setSaving(true);
		const response = await authFetch(`/api/accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: account.name, role: account.role, disabled: account.disabled, canManageMailboxes: account.canManageMailboxes }) });
		const data = (await response.json()) as { error?: string };
		setMessage(response.ok ? "Account updated" : data.error ?? "Unable to update account");
		setSaving(false);
	}

	async function uploadAvatar(file: File | undefined) {
		if (!file) return;
		const form = new FormData();
		form.set("file", file);
		const response = await authFetch(`/api/accounts/${id}/avatar`, { method: "POST", body: form });
		if (response.ok) {
			setAccount((current) => current ? { ...current, hasAvatar: true } : current);
			setAvatarVersion(Date.now());
		}
	}

	async function addMailbox(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!account) return;
		const response = await authFetch("/api/mailboxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerUserId: account.id, domainId, localPart, displayName: account.name }) });
		const data = (await response.json()) as { error?: string };
		if (!response.ok) return setMessage(data.error ?? "Unable to add inbox");
		setLocalPart("");
		await load();
	}

	async function removeMailbox(mailboxId: string) {
		const response = await authFetch(`/api/mailboxes/${mailboxId}`, { method: "DELETE" });
		if (!response.ok) return setMessage("Unable to remove inbox");
		await load();
	}

	if (!account) return <p className="text-sm text-neutral-500">{message ?? "Loading account..."}</p>;
	return <div className="space-y-6">
		<div><h1 className="text-3xl font-medium">{account.name}</h1><p className="mt-2 text-sm text-neutral-500">{account.email}</p></div>
		<section className="space-y-5 rounded-3xl bg-white p-6">
			<div className="flex items-center gap-4"><span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xl font-semibold text-blue-700">{account.name.charAt(0).toUpperCase()}{account.hasAvatar && <img src={`/api/accounts/${id}/avatar?v=${avatarVersion}`} alt="" className="absolute inset-0 h-full w-full object-cover" />}</span><Label className="cursor-pointer"><span className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-sm"><Upload className="h-4 w-4" />Change avatar</span><Input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => void uploadAvatar(event.target.files?.[0])} /></Label></div>
			<div className="space-y-2"><Label htmlFor="account-name">Name</Label><Input id="account-name" value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} /></div>
			<div className="space-y-2"><Label htmlFor="account-role">Role</Label><Select id="account-role" value={account.role} onChange={(event) => setAccount({ ...account, role: event.target.value as "admin" | "user" })} className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm"><option value="user">User</option><option value="admin">Admin</option></Select></div>
			<label className="flex items-center gap-3 text-sm"><Checkbox checked={account.canManageMailboxes} onChange={(event) => setAccount({ ...account, canManageMailboxes: event.target.checked })} />Allow this account to add and remove inboxes</label>
			<label className="flex items-center gap-3 text-sm"><Checkbox checked={!account.disabled} onChange={(event) => setAccount({ ...account, disabled: !event.target.checked })} />Account enabled</label>
			<Button onClick={() => void saveAccount()} disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
		</section>
		<section className="space-y-4 rounded-3xl bg-white p-6"><div><h2 className="font-semibold">Inboxes</h2><p className="text-sm text-neutral-500">Mailboxes owned by this account.</p></div><div className="space-y-2">{mailboxes.map((mailbox) => <div key={mailbox.id} className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3"><span><span className="block font-medium">{mailbox.displayName || mailbox.localPart}</span><span className="block text-sm text-neutral-500">{mailbox.localPart}@{mailbox.hostname}</span></span><Button type="button" variant="ghost" size="icon" onClick={() => void removeMailbox(mailbox.id)} aria-label="Remove inbox"><Trash2 className="h-4 w-4" /></Button></div>)}</div><form onSubmit={addMailbox} className="flex gap-2"><Input value={localPart} onChange={(event) => setLocalPart(event.target.value)} placeholder="inbox" required /><Select value={domainId} onChange={(event) => setDomainId(event.target.value)} className="rounded-md border border-neutral-200 bg-white px-3 text-sm">{domains.map((domain) => <option key={domain.id} value={domain.id}>@{domain.hostname}</option>)}</Select><Button type="submit"><Plus className="h-4 w-4" />Add inbox</Button></form></section>
		{message && <p className="text-sm text-neutral-500">{message}</p>}
	</div>;
}
