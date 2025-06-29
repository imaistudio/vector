"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building, Users, Settings2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  requiresAdmin?: boolean;
  requiresOwner?: boolean;
}

interface OrgSettingsSidebarProps {
  orgId: string;
  userRole: string;
}

export function OrgSettingsSidebar({
  orgId,
  userRole,
}: OrgSettingsSidebarProps) {
  const pathname = usePathname();

  const isAdmin = userRole === "admin" || userRole === "owner";
  const isOwner = userRole === "owner";

  const settingsItems: SettingsNavItem[] = [
    {
      label: "General",
      href: `/${orgId}/settings`,
      icon: Building,
      description: "Organization info and branding",
    },
    {
      label: "Members",
      href: `/${orgId}/settings/members`,
      icon: Users,
      description: "Manage team members and roles",
      requiresAdmin: true,
    },
    {
      label: "States",
      href: `/${orgId}/settings/states`,
      icon: Settings2,
      description: "Configure issue and project states",
      requiresAdmin: true,
    },
    {
      label: "Priorities",
      href: `/${orgId}/settings/priorities`,
      icon: Settings2,
      description: "Configure issue priority levels",
      requiresAdmin: true,
    },
  ];

  // Filter items based on user permissions
  const visibleItems = settingsItems.filter((item) => {
    if (item.requiresOwner && !isOwner) return false;
    if (item.requiresAdmin && !isAdmin) return false;
    return true;
  });

  return (
    <nav className="space-y-1 p-3">
      <div className="pb-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Organization Settings
        </h2>
      </div>

      {visibleItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== `/${orgId}/settings` &&
            pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group block rounded-md px-3 py-1.5 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <div className="flex items-center gap-2">
              <item.icon className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{item.label}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
