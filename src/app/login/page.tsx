import { redirect } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { hasAdminAccount } from "@/lib/auth/setup";
import { getEnv } from "@/lib/cloudflare";
import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
	if (!(await hasAdminAccount(getEnv()))) redirect("/setup");

	return (
		<AuthGuard mode="public">
			<LoginClient />
		</AuthGuard>
	);
}
