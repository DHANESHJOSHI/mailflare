export type ProfileFormProps = {
	initialName: string;
	initialResetEmail: string;
	initialForwardingEmail: string;
	canForwardEmail: boolean;
	email: string;
};

export type ProfileFormResponse = {
	user?: {
		name: string;
		resetEmail: string | null;
		forwardingEmail: string | null;
		canForwardEmail: boolean;
	};
	error?: unknown;
};

export type AccountSettingsResponse = {
	user?: {
		email: string;
		name: string;
		resetEmail: string | null;
		forwardingEmail: string | null;
		canForwardEmail: boolean;
	};
	error?: unknown;
};

export type ChangePasswordResponse = {
	error?: unknown;
};

export type ProfileAvatarSessionResponse = {
	user?: {
		hasAvatar?: boolean;
	};
};

export type ProfileAvatarUploadResponse = {
	error?: string;
};

export type ProfileAvatarFormProps = {
	mailboxId?: string;
	initialHasAvatar?: boolean;
	name?: string;
};

export type CurrentMailboxFormResponse = {
	mailbox?: {
		id: string;
		localPart: string;
		hostname: string;
		displayName: string | null;
		hasAvatar?: boolean;
		isPrimary?: boolean;
	};
	error?: unknown;
};
