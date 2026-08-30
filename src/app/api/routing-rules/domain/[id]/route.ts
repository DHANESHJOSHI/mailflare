import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { routingRules } from "@/db/schema";
import { assertAdmin } from "@/lib/auth/admin";
import { requireSessionUser } from "@/lib/api/auth";
import { getEnv } from "@/lib/cloudflare";
import { domainRoutingRuleSchema } from "@/lib/validators";
import {
	assertRuleMailbox,
	getDomainOwnerId,
	getOwnedDomain,
	toRuleColumns,
} from "@/lib/domains/routing-rules";
import type { DomainRoutingRuleRouteParams } from "./types";

/** Loads a domain-scope rule the caller is allowed to administer. */
async function loadRule(request: Request, id: string) {
	const env = getEnv();
	const auth = await requireSessionUser(env, request);
	if (auth.error) return { error: auth.error } as const;
	const user = auth.user;
	try {
		assertAdmin(user);
	} catch {
		return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } as const;
	}

	const db = getDb(env);
	const [rule] = await db
		.select()
		.from(routingRules)
		.where(and(eq(routingRules.id, id), eq(routingRules.scope, "domain")))
		.limit(1);
	if (!rule) {
		return { error: NextResponse.json({ error: "Rule not found" }, { status: 404 }) } as const;
	}

	const domain = await getOwnedDomain(db, getDomainOwnerId(user), rule.domainId);
	if (!domain) {
		return { error: NextResponse.json({ error: "Rule not found" }, { status: 404 }) } as const;
	}

	return { env, db, user, rule, domain, error: null } as const;
}

export async function PATCH(request: Request, { params }: DomainRoutingRuleRouteParams) {
	const { id } = await params;
	const loaded = await loadRule(request, id);
	if (loaded.error) return loaded.error;

	const body = (await request.json()) as Record<string, unknown>;
	// The rule's own domain always wins, so a request cannot move a rule to another domain.
	const parsed = domainRoutingRuleSchema.safeParse({ ...body, domainId: loaded.rule.domainId });
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
	}

	if (parsed.data.mailboxId && !(await assertRuleMailbox(loaded.db, parsed.data.mailboxId, loaded.domain.id))) {
		return NextResponse.json({ error: "Mailbox not found on this domain" }, { status: 404 });
	}

	await loaded.db.update(routingRules).set(toRuleColumns(parsed.data)).where(eq(routingRules.id, id));
	return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: DomainRoutingRuleRouteParams) {
	const { id } = await params;
	const loaded = await loadRule(request, id);
	if (loaded.error) return loaded.error;

	await loaded.db.delete(routingRules).where(eq(routingRules.id, id));
	return NextResponse.json({ ok: true });
}
