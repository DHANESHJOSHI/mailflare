"use client";

import Link from "next/link";
import { HelpCircle, Search } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ComposeProvider } from "@/components/compose/compose-context";
import { FloatingComposer } from "@/components/compose/floating-composer";
import { MailboxProvider } from "@/components/mailbox-provider";
import { MailboxSelector } from "@/components/mailbox-selector";
import { LicenseIndicator } from "@/components/license-indicator";
import { AdminNav } from "@/components/admin-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard requireMailbox requireRole="admin">
      <MailboxProvider>
        <ComposeProvider>
          <div className="grid h-dvh grid-cols-[256px_minmax(0,1fr)] overflow-hidden bg-[#eef3fb]">
            <aside className="min-h-0 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-gutter-stable">
              <AdminNav />
            </aside>
            <div className="flex min-h-0 min-w-0 flex-col">
              <span className="fixed top-6 right-6 flex items-center gap-2">
                <LicenseIndicator />
                <MailboxSelector />
              </span>
              <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-6 py-10 scrollbar-gutter-stable lg:px-12">
                <div className="w-full max-w-3xl">{children}</div>
              </main>
            </div>
            <FloatingComposer />
          </div>
        </ComposeProvider>
      </MailboxProvider>
    </AuthGuard>
  );
}
