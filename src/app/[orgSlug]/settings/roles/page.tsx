"use client";

import { Shield } from "lucide-react";
import { RolesPageContent } from "@/components/organization/roles-page-content";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";

interface RolesSettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default function RolesSettingsPage({ params }: RolesSettingsPageProps) {
  const paramsObj = useParams();
  const orgSlug = paramsObj.orgSlug as string;

  const user = useQuery(api.users.currentUser);
  const members = useQuery(api.organizations.listMembersWithRoles, { orgSlug });

  const userRole =
    members?.find((m) => m.userId === user?._id)?.role || "member";
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin" || isOwner;

  // Only admins can access role management
  if (user !== undefined && members !== undefined && !isAdmin) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Shield className="size-5" />
          Roles & Permissions
        </h1>
        <p className="text-muted-foreground text-sm">
          Create custom roles and configure permissions for your organization
        </p>
      </div>

      {/* Roles Management */}
      <RolesPageContent orgSlug={orgSlug} />
    </div>
  );
}
