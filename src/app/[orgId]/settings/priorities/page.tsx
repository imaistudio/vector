import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth/auth";
import { PrioritiesPageContent } from "./priorities-page-content";

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function PrioritiesPage({ params }: PageProps) {
  const { orgId: orgSlug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth");
  }

  return <PrioritiesPageContent orgSlug={orgSlug} />;
}
