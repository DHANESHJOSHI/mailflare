import { authFetch } from "@/lib/auth/client";
import type { CachedMessageDetail } from "./detail-cache-types";

const detailCache = new Map<string, CachedMessageDetail>();
const detailRequests = new Map<string, Promise<CachedMessageDetail>>();

export function clearMessageDetailCache() {
	detailCache.clear();
	detailRequests.clear();
}

export async function fetchCachedMessageDetail(messageId: string, force = false): Promise<CachedMessageDetail> {
	if (!force && detailCache.has(messageId)) return detailCache.get(messageId) ?? {};
	if (!force && detailRequests.has(messageId)) return detailRequests.get(messageId) ?? {};
	const request = authFetch(`/api/messages/${messageId}`)
		.then((response) => response.json() as Promise<CachedMessageDetail>)
		.then((data) => {
			detailCache.set(messageId, data);
			return data;
		})
		.finally(() => detailRequests.delete(messageId));
	detailRequests.set(messageId, request);
	return request;
}
