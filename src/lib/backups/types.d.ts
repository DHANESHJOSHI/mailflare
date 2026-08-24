export type BackupScheduleType = "daily" | "weekly" | "monthly";

export type BackupWorkflowParams = {
	backupId?: string;
	force?: boolean;
};

export type D1ExportResult = {
	at_bookmark?: string;
	status?: string;
	error?: string;
	signed_url?: string;
	filename?: string;
	result?: {
		signed_url?: string;
		filename?: string;
	};
};

export type D1ExportResponse = {
	success: boolean;
	errors?: Array<{ message?: string }>;
	result?: D1ExportResult;
};
