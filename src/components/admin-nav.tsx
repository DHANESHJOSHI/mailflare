"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DatabaseBackup,
  Globe2,
  Activity,
  Mail,
  Settings,
  Palette,
  BadgeDollarSign,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavItem } from "./components-nav";
import { SidebarFooter } from "./sidebar-footer";
import { useBranding } from "./branding-provider";

const links = [
  { href: "/admin", label: "Overview", icon: Settings },
  { href: "/mailboxes", label: "Mailboxes", icon: Mail },
  { href: "/domains", label: "Domains", icon: Globe2 },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/backups", label: "Backups", icon: DatabaseBackup },
  { href: "/branding", label: "Branding", icon: Palette },
  { href: "/licenses", label: "Licenses", icon: BadgeDollarSign },
  { href: "/accounts", label: "Accounts", icon: Users },
  // { href: "/api-keys", label: "API Keys", icon: KeyRound },
  // { href: "/webhooks", label: "Webhooks", icon: Webhook }
];

export function AdminNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const branding = useBranding();

  return (
    <nav className={cn("flex min-h-full flex-col gap-1", className)}>
      <Link
        href="/inbox"
        className="mb-3 flex h-10 items-center gap-3 px-3 text-neutral-600"
      >
        <img src={branding.iconUrl} height={28} width={28} alt="" />
        <span className="text-lg font-semibold text-neutral-800">Admin</span>
      </Link>
      {links
        .filter((link) => link.href !== "/branding" || branding.canCustomizeBranding)
        .map((link) => <NavItem link={link} key={link.href} />)}
      <span className="flex-1" />
      <SidebarFooter />
    </nav>
  );
}
