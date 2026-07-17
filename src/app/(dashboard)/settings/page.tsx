import { CurrentMailboxForm } from "@/components/settings/current-mailbox-form";
import { ProfileAvatarForm } from "@/components/settings/profile-avatar-form";

export default function SettingsPage() {
	return (
		<div className="space-y-6">
			<CurrentMailboxForm />
			<div className="max-w-2xl px-8 pb-8">
				<ProfileAvatarForm />
			</div>
		</div>
	);
}
