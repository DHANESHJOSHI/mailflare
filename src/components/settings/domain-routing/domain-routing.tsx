"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Forward, Inbox, Info, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Tooltip } from "@/components/ui/tooltip";
import { CardGridSkeleton } from "@/components/page-skeletons";
import { useSelectedMailbox } from "@/components/mailbox-provider";
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
	formatLastMatched,
	ruleToInput,
	updateDomainRule,
} from "./utils";

const ACTION_ICONS = {
	store: Inbox,
	forward: Forward,
	reject: Ban,
} as const;

export function DomainRouting() {
	const qc = useQueryClient();
	const { selectedMailbox, isLoading: isMailboxLoading } = useSelectedMailbox();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<DomainRule | null>(null);
	const [form, setForm] = useState<DomainRuleInput>(emptyRuleInput(""));
	const [error, setError] = useState<string | null>(null);

	const domainId = selectedMailbox?.domainId ?? "";
	const mailboxId = selectedMailbox?.id ?? "";
	const canManage = selectedMailbox?.permission === "full_access";

	const rules = useQuery({
		queryKey: ["domain-rules", domainId, mailboxId],
		enabled: !!domainId && !!mailboxId && canManage,
		queryFn: () => fetchDomainRules(domainId, mailboxId),
	});

	const hostname = selectedMailbox?.hostname ?? "";
	const mailboxes = rules.data?.mailboxes ?? [];

	const save = useMutation({
		mutationFn: () => {
			const payload: DomainRuleInput = { ...form, domainId };
			return editing
				? updateDomainRule(editing.id, payload, mailboxId)
				: createDomainRule(payload, mailboxId);
		},
		onSuccess: () => {
			setDialogOpen(false);
			setEditing(null);
			setError(null);
			qc.invalidateQueries({ queryKey: ["domain-rules", domainId, mailboxId] });
		},
		onError: (e: Error) => setError(e.message),
	});

	const remove = useMutation({
		mutationFn: (id: string) => deleteDomainRule(id, mailboxId),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["domain-rules", domainId, mailboxId] }),
	});

	const toggle = useMutation({
		mutationFn: (rule: DomainRule) =>
			updateDomainRule(rule.id, { ...ruleToInput(rule), enabled: !rule.enabled }, mailboxId),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["domain-rules", domainId, mailboxId] }),
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
					<div className="flex items-center gap-2">
						<h2 className="text-2xl font-semibold">Domain routing</h2>
						<Tooltip label="Block, forward, or deliver mail arriving at this domain.">
							<button type="button" aria-label="About domain routing" className="text-neutral-400 hover:text-neutral-700">
								<Info className="h-4 w-4" />
							</button>
						</Tooltip>
					</div>
					<p className="mt-1 text-sm text-neutral-500">{hostname || "Select an inbox"}</p>
				</div>
				<div className="flex items-end gap-2">
					<Button onClick={openCreate} disabled={!mailboxId || !canManage}>
						<Plus className="h-4 w-4" /> Add rule
					</Button>
				</div>
			</div>

			{isMailboxLoading || rules.isLoading ? (
				<CardGridSkeleton />
			) : !mailboxId ? (
				<Card>
					<CardContent className="pt-6 text-sm text-neutral-500">
						Select an inbox before creating routing rules.
					</CardContent>
				</Card>
			) : !canManage ? (
				<Card>
					<CardContent className="pt-6 text-sm text-neutral-500">
						Full access to the selected inbox is required to manage domain routing.
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
				<DialogContent className="max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-[560px]">
					<DialogHeader>
						<DialogTitle>{editing ? "Edit rule" : "Add routing rule"}</DialogTitle>
						<DialogDescription>Choose what happens to matching mail.</DialogDescription>
					</DialogHeader>

					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							save.mutate();
						}}
					>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
						</div>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
							<div className="flex items-center gap-2">
								<Label htmlFor="rule-value">Match value</Label>
								<Tooltip label="Use * to match every message.">
									<span className="text-neutral-400"><Info className="h-4 w-4" /></span>
								</Tooltip>
							</div>
							<Input
								id="rule-value"
								required
								value={form.matchValue}
								placeholder="* to match everything"
								onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
							/>
						</div>

						{form.action !== "reject" && (
							<div className={form.action === "forward" ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "space-y-2"}>
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
							{form.action === "forward" && (
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
							)}
							</div>
						)}

						{form.action === "forward" && (
							<div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
								<div>
									<div className="flex items-center gap-2">
										<p className="text-sm font-medium">Keep a copy</p>
										<Tooltip label="Also store the message in the selected inbox.">
											<span className="text-neutral-400"><Info className="h-4 w-4" /></span>
										</Tooltip>
									</div>
								</div>
								<Switch
									checked={form.keepCopy}
									onCheckedChange={(keepCopy) => setForm({ ...form, keepCopy })}
								/>
							</div>
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

						<div className="space-y-2 sm:w-1/2">
							<div className="flex items-center gap-2">
								<Label htmlFor="rule-priority">Priority</Label>
								<Tooltip label="Higher numbers run first.">
									<span className="text-neutral-400"><Info className="h-4 w-4" /></span>
								</Tooltip>
							</div>
							<Input
								id="rule-priority"
								type="number"
								min={0}
								max={1000}
								value={form.priority}
								onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
							/>
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
				<div className="flex items-center gap-2">
					<CardTitle>{title}</CardTitle>
					<Tooltip label={description}>
						<span className="text-neutral-400"><Info className="h-4 w-4" /></span>
					</Tooltip>
				</div>
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
