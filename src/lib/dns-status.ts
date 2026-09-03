import type { CfDnsRecord } from "@/lib/cloudflare-api";

export type DnsStatusSummary = {
	routing: {
		configured: boolean;
		missing: string[];
	};
	sending: {
		configured: boolean;
		records: string[];
	};
};

export function summariseDns(
	routingRecords: CfDnsRecord[],
	routingMissing: CfDnsRecord[],
	sendingRecords: CfDnsRecord[],
	routingEnabled = false,
	sendingEnabled = false,
): DnsStatusSummary {
	const recordTypes = (
		type: "routing-records" | "routing-missing" | "sending",
	) => {
		const list =
			type === "routing-records"
				? routingRecords
				: type === "routing-missing"
					? routingMissing
					: sendingRecords;
		return Array.from(new Set(list.map((r) => r.type).filter(Boolean))) as string[];
	};

	return {
		routing: {
			configured: routingMissing.length === 0 && (routingRecords.length > 0 || routingEnabled),
			missing: recordTypes("routing-missing"),
		},
		sending: {
			configured: sendingRecords.length > 0 || sendingEnabled,
			records: recordTypes("sending"),
		},
	};
}
