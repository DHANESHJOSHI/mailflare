import type { MouseEvent } from "react";

export type MessageNavigationState = {
	progress: number | null;
	onNavigate(event: MouseEvent<HTMLAnchorElement>): Promise<void>;
};
