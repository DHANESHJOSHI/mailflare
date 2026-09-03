import { InboxRules } from "@/components/settings/inbox-rules";
import { DomainRouting } from "@/components/settings/domain-routing/domain-routing";

export default function SettingsRulesPage() {
	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-3xl font-medium text-neutral-900">Rules</h1>
				<p className="mt-1 text-sm text-neutral-500">
					Manage domain routing and mailbox filtering rules.
				</p>
			</div>
			<div className="rounded-3xl bg-white p-6">
				<DomainRouting />
			</div>
			<div className="rounded-3xl bg-white p-6">
				<h2 className="text-2xl font-semibold text-neutral-900">Mailbox rules</h2>
				<p className="mt-1 text-sm text-neutral-500">
					Filter mail after it reaches the selected mailbox.
				</p>
				<div className="mt-6">
				<InboxRules />
				</div>
			</div>
		</div>
	);
}
