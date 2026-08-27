"use client";

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
import { SidebarHeader } from "./sidebar-header";

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
  const branding = useBranding();

  return (
    <nav className={cn("flex min-h-full flex-col gap-1", className)}>
      <SidebarHeader href="/inbox" label="Admin" />
      {links
        .filter((link) => link.href !== "/branding" || branding.canCustomizeBranding)
        .map((link) => <NavItem link={link} key={link.href} />)}
      <span className="flex-1" />
      <SidebarFooter />
    </nav>
  );
}
