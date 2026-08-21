"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authFetch } from "@/lib/auth/client";

export function ProfileAvatarForm() {
	const [hasAvatar, setHasAvatar] = useState(false);
	const [preview, setPreview] = useState<string | null>(null);
	const [file, setFile] = useState<File | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		authFetch("/api/auth/me", { redirectOnUnauthorized: false })
			.then((response) => (response.ok ? response.json() : null))
			.then((data) => {
				const authData = data as { user?: { hasAvatar?: boolean } } | null;
				setHasAvatar(!!authData?.user?.hasAvatar);
			})
			.catch(() => setHasAvatar(false));
	}, []);

	useEffect(() => {
		if (!file) {
			setPreview(null);
			return;
		}
		const url = URL.createObjectURL(file);
		setPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	function onPick(event: React.ChangeEvent<HTMLInputElement>) {
		const picked = event.target.files?.[0] ?? null;
		setStatus(null);
		if (picked && picked.size > 2 * 1024 * 1024) {
			setStatus("Image must be 2 MB or smaller");
			return;
		}
		setFile(picked);
	}

	async function upload() {
		if (!file) return;
		setBusy(true);
		setStatus(null);
		try {
			const body = new FormData();
			body.append("file", file);
			const response = await authFetch("/api/profile/avatar", { method: "POST", body });
			if (!response.ok) {
				const json = (await response.json().catch(() => null)) as { error?: string } | null;
				throw new Error(json?.error ?? "Upload failed");
			}
			window.location.reload();
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Upload failed");
			setBusy(false);
		}
	}

	async function remove() {
		setBusy(true);
		setStatus(null);
		try {
			const response = await authFetch("/api/profile/avatar", { method: "DELETE" });
			if (!response.ok) throw new Error("Failed to remove picture");
			window.location.reload();
		} catch (err) {
			setStatus(err instanceof Error ? err.message : "Failed to remove picture");
			setBusy(false);
		}
	}

	const shownImage = preview ?? (hasAvatar ? "/api/profile/avatar" : null);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Profile picture</CardTitle>
				<CardDescription>
					Shown in the top-right corner of your dashboard. JPEG, PNG, WebP, or GIF up to 2 MB.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-4">
					{shownImage ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={shownImage}
							alt="Profile picture"
							className="h-16 w-16 rounded-full border border-neutral-200 object-cover"
						/>
					) : (
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white">
							<User className="h-7 w-7" />
						</div>
					)}
					<div className="flex flex-wrap items-center gap-2">
						<input
							ref={inputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							className="hidden"
							onChange={onPick}
						/>
						<Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
							Choose image
						</Button>
						<Button type="button" onClick={upload} disabled={busy || !file}>
							<Upload className="h-4 w-4" />
							{busy ? "Saving..." : "Save picture"}
						</Button>
						{hasAvatar && (
							<Button type="button" variant="destructive" onClick={remove} disabled={busy}>
								<Trash2 className="h-4 w-4" />
								Remove
							</Button>
						)}
					</div>
				</div>
				{status && <p className="text-sm text-red-600">{status}</p>}
			</CardContent>
		</Card>
	);
}
