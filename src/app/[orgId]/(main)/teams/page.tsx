import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/auth/auth";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { TeamsPageContent } from "@/components/teams";

interface TeamsPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function TeamsPage({ params }: TeamsPageProps) {
  const { orgId: orgSlug } = await params;

  // Verify user access
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    notFound();
  }

  // Get organization details and verify membership
  const org = await OrganizationService.verifyUserOrganizationAccess(
    session.user.id,
    orgSlug,
  );

  if (!org) {
    notFound();
  }

  const isAdminOrOwner = org.role === "admin" || org.role === "owner";

  return (
    <TeamsPageContent
      orgSlug={orgSlug}
      isAdminOrOwner={isAdminOrOwner}
      orgName={org.organizationName}
    />
  );
}
