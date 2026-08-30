"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Forward, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CardGridSkeleton } from "@/components/page-skeletons";
import type { DomainRule, DomainRuleInput } from "./types";
import {
	ACTION_LABELS,
	MATCH_FIELD_LABELS,
	MATCH_OPERATOR_LABELS,
	createDomainRule,
	deleteDomainRule,
	describeRule,
	emptyRuleInput,
	fetchDomainRules,
	fetchRoutingDomains,
	formatLastMatched,
	ruleToInput,
	updateDomainRule,
} from "./utils";

const ACTION_ICONS = {
	store: Inbox,
	forward: Forward,
	reject: Ban,
} as const;

export default function RoutingPage() {
	const qc = useQueryClient();
	const [selectedDomainId, setSelectedDomainId] = useState("");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<DomainRule | null>(null);
	const [form, setForm] = useState<DomainRuleInput>(emptyRuleInput(""));
	const [error, setError] = useState<string | null>(null);

	const domains = useQuery({ queryKey: ["routing-domains"], queryFn: fetchRoutingDomains });

	// Derive the active domain rather than syncing it in an effect: until the operator picks one,
	// it is simply the first domain that loaded.
	const domainId = selectedDomainId || (domains.data?.[0]?.id ?? "");

	const rules = useQuery({
		queryKey: ["domain-rules", domainId],
		enabled: !!domainId,
		queryFn: () => fetchDomainRules(domainId),
	});

	const hostname = useMemo(
		() => domains.data?.find((d) => d.id === domainId)?.hostname ?? "",
		[domains.data, domainId],
	);
	const mailboxes = rules.data?.mailboxes ?? [];

	const save = useMutation({
		mutationFn: () => {
			const payload: DomainRuleInput = { ...form, domainId };
			return editing ? updateDomainRule(editing.id, payload) : createDomainRule(payload);
		},
		onSuccess: () => {
			setDialogOpen(false);
			setEditing(null);
			setError(null);
			qc.invalidateQueries({ queryKey: ["domain-rules", domainId] });
		},
		onError: (e: Error) => setError(e.message),
	});

	const remove = useMutation({
		mutationFn: deleteDomainRule,
		onSuccess: () => qc.invalidateQueries({ queryKey: ["domain-rules", domainId] }),
	});

	const toggle = useMutation({
		mutationFn: (rule: DomainRule) =>
			updateDomainRule(rule.id, { ...ruleToInput(rule), enabled: !rule.enabled }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["domain-rules", domainId] }),
	});

	function openCreate() {
		setEditing(null);
		setError(null);
		setForm(emptyRuleInput(domainId));
		setDialogOpen(true);
	}

	function openEdit(rule: DomainRule) {
		setEditing(rule);
		setError(null);
		setForm(ruleToInput(rule));
		setDialogOpen(true);
	}

	const blockRules = (rules.data?.rules ?? []).filter((r) => r.action === "reject");
	const fallbackRules = (rules.data?.rules ?? []).filter((r) => r.action !== "reject");

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold">Routing</h1>
					<p className="mt-1 text-sm text-neutral-500">
						Catch-all, forwarding, and block rules applied to mail arriving on a domain.
					</p>
				</div>
				<div className="flex items-end gap-2">
					<div className="space-y-1">
						<Label htmlFor="routing-domain">Domain</Label>
						<Select
							id="routing-domain"
							value={domainId}
							onChange={(e) => setSelectedDomainId(e.target.value)}
							className="h-9"
						>
							{(domains.data ?? []).map((domain) => (
								<option key={domain.id} value={domain.id}>
									{domain.hostname}
								</option>
							))}
						</Select>
					</div>
					<Button onClick={openCreate} disabled={!domainId}>
						<Plus className="h-4 w-4" /> Add rule
					</Button>
				</div>
			</div>

			<Card>
				<CardContent className="pt-6 text-sm text-neutral-600">
					<p className="font-medium text-neutral-900">How these rules are applied</p>
					<ol className="mt-2 list-decimal space-y-1 pl-5">
						<li>Block rules run first and can reject a message before any mailbox is matched.</li>
						<li>A real mailbox on the domain always wins over a catch-all.</li>
						<li>
							Remaining catch-all and forwarding rules run only when no mailbox matched, highest
							priority first.
						</li>
					</ol>
					<p className="mt-2">
						Forwarding destinations must be verified destination addresses in Cloudflare Email
						Routing.
					</p>
				</CardContent>
			</Card>

			{domains.isLoading || rules.isLoading ? (
				<CardGridSkeleton />
			) : !domains.data?.length ? (
				<Card>
					<CardContent className="pt-6 text-sm text-neutral-500">
						Add a domain before creating routing rules.
					</CardContent>
				</Card>
			) : (
				<div className="space-y-6">
					<RuleSection
						title="Block rules"
						description="Evaluated before delivery. Matching mail is rejected at the edge."
						rules={blockRules}
						hostname={hostname}
						mailboxes={mailboxes}
						onEdit={openEdit}
						onDelete={(id) => remove.mutate(id)}
						onToggle={(rule) => toggle.mutate(rule)}
					/>
					<RuleSection
						title="Catch-all and forwarding"
						description="Evaluated only when no mailbox on the domain matched the recipient."
						rules={fallbackRules}
						hostname={hostname}
						mailboxes={mailboxes}
						onEdit={openEdit}
						onDelete={(id) => remove.mutate(id)}
						onToggle={(rule) => toggle.mutate(rule)}
					/>
				</div>
			)}

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				{/* The form grows when the action changes, so the dialog must scroll rather than overflow the viewport. */}
				<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>{editing ? "Edit rule" : "Add routing rule"}</DialogTitle>
						<DialogDescription>
							Rules run in descending priority order within their phase.
						</DialogDescription>
					</DialogHeader>

					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							save.mutate();
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="rule-name">Name</Label>
							<Input
								id="rule-name"
								value={form.name ?? ""}
								placeholder="Optional label"
								onChange={(e) => setForm({ ...form, name: e.target.value })}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="rule-action">Action</Label>
							<Select
								id="rule-action"
								value={form.action}
								onChange={(e) =>
									setForm({ ...form, action: e.target.value as DomainRuleInput["action"] })
								}
							>
								{Object.entries(ACTION_LABELS).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor="rule-field">Match on</Label>
								<Select
									id="rule-field"
									value={form.matchField}
									onChange={(e) =>
										setForm({ ...form, matchField: e.target.value as DomainRuleInput["matchField"] })
									}
								>
									{Object.entries(MATCH_FIELD_LABELS).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="rule-operator">Condition</Label>
								<Select
									id="rule-operator"
									value={form.matchOperator}
									onChange={(e) =>
										setForm({
											...form,
											matchOperator: e.target.value as DomainRuleInput["matchOperator"],
										})
									}
								>
									{Object.entries(MATCH_OPERATOR_LABELS).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</Select>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="rule-value">Value</Label>
							<Input
								id="rule-value"
								required
								value={form.matchValue}
								placeholder="* to match everything"
								onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
							/>
							<p className="text-xs text-neutral-500">
								Use <code>*</code> for a catch-all that matches every message.
							</p>
						</div>

						{form.action !== "reject" && (
							<div className="space-y-2">
								<Label htmlFor="rule-mailbox">
									{form.action === "forward" ? "Mailbox for the kept copy" : "Destination mailbox"}
								</Label>
								<Select
									id="rule-mailbox"
									value={form.mailboxId ?? ""}
									onChange={(e) => setForm({ ...form, mailboxId: e.target.value || null })}
								>
									<option value="">Select a mailbox</option>
									{mailboxes.map((mailbox) => (
										<option key={mailbox.id} value={mailbox.id}>
											{mailbox.localPart}@{hostname}
											{mailbox.disabled ? " (disabled)" : ""}
										</option>
									))}
								</Select>
							</div>
						)}

						{form.action === "forward" && (
							<>
								<div className="space-y-2">
									<Label htmlFor="rule-forward">Forward to</Label>
									<Input
										id="rule-forward"
										type="email"
										required
										value={form.forwardTo ?? ""}
										onChange={(e) => setForm({ ...form, forwardTo: e.target.value })}
									/>
								</div>
								<div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
									<div>
										<p className="text-sm font-medium">Keep a copy</p>
										<p className="text-xs text-neutral-500">
											Also store the message in the selected mailbox.
										</p>
									</div>
									<Switch
										checked={form.keepCopy}
										onCheckedChange={(keepCopy) => setForm({ ...form, keepCopy })}
									/>
								</div>
							</>
						)}

						{form.action === "reject" && (
							<div className="space-y-2">
								<Label htmlFor="rule-reason">Rejection reason</Label>
								<Input
									id="rule-reason"
									value={form.rejectReason ?? ""}
									placeholder="Message rejected by routing rule"
									onChange={(e) => setForm({ ...form, rejectReason: e.target.value })}
								/>
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="rule-priority">Priority</Label>
							<Input
								id="rule-priority"
								type="number"
								min={0}
								max={1000}
								value={form.priority}
								onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
							/>
							<p className="text-xs text-neutral-500">Higher numbers are evaluated first.</p>
						</div>

						{error && <p className="text-sm text-red-600">{error}</p>}

						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={save.isPending}>
								{editing ? "Save changes" : "Create rule"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function RuleSection({
	title,
	description,
	rules,
	hostname,
	mailboxes,
	onEdit,
	onDelete,
	onToggle,
}: {
	title: string;
	description: string;
	rules: DomainRule[];
	hostname: string;
	mailboxes: { id: string; localPart: string; displayName: string | null; disabled: boolean }[];
	onEdit: (rule: DomainRule) => void;
	onDelete: (id: string) => void;
	onToggle: (rule: DomainRule) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<p className="text-sm text-neutral-500">{description}</p>
			</CardHeader>
			<CardContent className="space-y-2">
				{rules.length === 0 ? (
					<p className="text-sm text-neutral-500">No rules yet.</p>
				) : (
					rules.map((rule) => {
						const Icon = ACTION_ICONS[rule.action];
						return (
							<div
								key={rule.id}
								className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2"
							>
								<Icon className="h-4 w-4 shrink-0 text-neutral-500" />
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="truncate text-sm font-medium">
											{rule.name || describeRule(rule, mailboxes, hostname)}
										</p>
										{!rule.enabled && <Badge variant="secondary">Disabled</Badge>}
									</div>
									{rule.name && (
										<p className="truncate text-xs text-neutral-500">
											{describeRule(rule, mailboxes, hostname)}
										</p>
									)}
									<p className="text-xs text-neutral-400">
										Priority {rule.priority} · matched {rule.matchCount}× · last{" "}
										{formatLastMatched(rule.lastMatchedAt)}
									</p>
								</div>
								<Switch checked={rule.enabled} onCheckedChange={() => onToggle(rule)} />
								<Button variant="ghost" size="sm" onClick={() => onEdit(rule)}>
									<Pencil className="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="sm" onClick={() => onDelete(rule.id)}>
									<Trash2 className="h-4 w-4 text-red-600" />
								</Button>
							</div>
						);
					})
				)}
			</CardContent>
		</Card>
	);
}
