export type ManagedAccount = {
	id: string;
	email: string;
	name: string;
	role: "admin" | "user";
	disabled: boolean;
	canManageMailboxes: boolean;
	hasAvatar: boolean;
};

export type ManagedMailbox = {
	id: string;
	localPart: string;
	displayName: string | null;
	domainId: string;
	hostname: string;
};

export type ManagedDomain = { id: string; hostname: string };
