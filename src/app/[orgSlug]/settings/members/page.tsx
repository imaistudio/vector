"use client";

import { Users } from "lucide-react";
import { MembersList } from "@/components/organization";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import { useParams } from "next/navigation";
import { notFound } from "next/navigation";

interface MembersSettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default function MembersSettingsPage({
  params,
}: MembersSettingsPageProps) {
  const paramsObj = useParams();
  const orgSlug = paramsObj.orgSlug as string;

  const user = useQuery(api.users.currentUser);
  const members = useQuery(api.organizations.listMembersWithRoles, { orgSlug });

  const userRole =
    members?.find((m) => m.userId === user?._id)?.role || "member";
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin" || isOwner;

  // Only admins can access member management
  if (user !== undefined && members !== undefined && !isAdmin) {
    notFound();
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Users className="size-5" />
          Members & Access
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage organization members, roles, and invitations
        </p>
      </div>

      {/* Members List */}
      <div className="space-y-4">
        <MembersList orgSlug={orgSlug} memberCount={members?.length || 0} />
      </div>
    </div>
  );
}
