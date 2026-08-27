"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { waitForNavigationProgress } from "@/components/components-nav-utils";
import { fetchCachedMessageDetail } from "@/lib/messages/detail-cache";
import type { MessageNavigationState } from "./message-navigation-types";

export function useMessageNavigation(href: string, messageId: string): MessageNavigationState {
	const pathname = usePathname();
	const router = useRouter();
	const [progress, setProgress] = useState<number | null>(null);

	useEffect(() => {
		if (progress === null) return;
		setProgress(100);
		const timer = window.setTimeout(() => setProgress(null), 220);
		return () => window.clearTimeout(timer);
	}, [pathname]);

	async function onNavigate(event: MouseEvent<HTMLAnchorElement>) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		setProgress(12);
		const timer = window.setInterval(() => {
			setProgress((current) => current === null ? 12 : Math.min(90, current + 8));
		}, 80);
		try {
			router.prefetch(href);
			await Promise.all([fetchCachedMessageDetail(messageId), waitForNavigationProgress()]);
			setProgress(100);
			await waitForNavigationProgress(160);
			router.push(href);
		} catch {
			setProgress(null);
		} finally {
			window.clearInterval(timer);
		}
	}

	return { progress, onNavigate };
}

export function MessageNavigationProgress({ progress }: { progress: number | null }) {
	if (progress === null) return null;
	return (
		<div className="fixed inset-x-0 top-0 z-[120] h-1 bg-blue-100">
			<div className="h-full bg-blue-600 transition-[width] duration-100 ease-out" style={{ width: `${progress}%` }} />
		</div>
	);
}
