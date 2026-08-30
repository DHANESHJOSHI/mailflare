import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { routingRules } from "@/db/schema";
import { requireSessionUser } from "@/lib/api/auth";
import { assertAdmin } from "@/lib/auth/admin";
import { getEnv } from "@/lib/cloudflare";
import { newId } from "@/lib/ids";
import { domainRoutingRuleSchema } from "@/lib/validators";
import {
	assertRuleMailbox,
	getDomainOwnerId,
	getOwnedDomain,
	listDomainMailboxes,
	listDomainRules,
	toRuleColumns,
} from "@/lib/domains/routing-rules";

export async function GET(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	const user = auth.user;
	try {
		assertAdmin(user);
	} catch {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const domainId = new URL(request.url).searchParams.get("domainId");
	if (!domainId) {
		return NextResponse.json({ error: "domainId is required" }, { status: 400 });
	}

	const db = getDb(env);
	const domain = await getOwnedDomain(db, getDomainOwnerId(user), domainId);
	if (!domain) {
		return NextResponse.json({ error: "Domain not found" }, { status: 404 });
	}

	return NextResponse.json({
		rules: await listDomainRules(db, domainId),
		mailboxes: await listDomainMailboxes(db, domainId),
	});
}

export async function POST(request: Request) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return auth.error;
	const user = auth.user;
	try {
		assertAdmin(user);
	} catch {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const parsed = domainRoutingRuleSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	const db = getDb(env);
	const domain = await getOwnedDomain(db, getDomainOwnerId(user), parsed.data.domainId);
	if (!domain) {
		return NextResponse.json({ error: "Domain not found" }, { status: 404 });
	}

	if (parsed.data.mailboxId && !(await assertRuleMailbox(db, parsed.data.mailboxId, domain.id))) {
		return NextResponse.json({ error: "Mailbox not found on this domain" }, { status: 404 });
	}

	const id = newId("rule");
	await db.insert(routingRules).values({
		id,
		userId: user.id,
		domainId: domain.id,
		...toRuleColumns(parsed.data),
	});

	return NextResponse.json({ id });
}
