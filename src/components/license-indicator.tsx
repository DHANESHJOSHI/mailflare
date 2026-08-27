"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LICENSE_STATUS_CHANGED_EVENT } from "@/lib/licenses/constants";
import type { LicenseStatus } from "@/lib/licenses/types";
import { loadLicenseIndicatorStatus } from "./license-indicator-utils";

export function LicenseIndicator() {
	const [license, setLicense] = useState<LicenseStatus | null>(null);

	useEffect(() => {
		let cancelled = false;

		function load() {
			void loadLicenseIndicatorStatus().then((nextLicense) => {
				if (!cancelled) setLicense(nextLicense);
			});
		}

		load();
		window.addEventListener(LICENSE_STATUS_CHANGED_EVENT, load);
		return () => {
			cancelled = true;
			window.removeEventListener(LICENSE_STATUS_CHANGED_EVENT, load);
		};
	}, []);

	if (!license) return null;

	if (license.active) {
		return (
			<Link
				href="/licenses"
				className="rounded-full bg-blue-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-800 hover:bg-blue-200"
			>
				{license.plan}
			</Link>
		);
	}

	return (
		<Button asChild size="sm">
			<Link href="/licenses">Upgrade</Link>
		</Button>
	);
}
